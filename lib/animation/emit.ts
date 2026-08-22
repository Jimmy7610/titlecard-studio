import {
  functionValueSource,
  resolveStep,
  type MotionSpec,
  type ResolvedStep,
  type ResolvedVar,
  type SpecContext,
  type SpecStep,
  type SpecTarget,
} from "@/lib/animation/spec";
import {
  countForTarget,
  delaysForTarget,
  type UnitMeta,
} from "@/lib/animation/timing";

/**
 * Prints GSAP source for a `MotionSpec`.
 *
 * The exported file gets literal `tl.to(...)` calls rather than a bundled
 * interpreter: the point of the code exports is that someone can read, edit and
 * keep the result, which a spec plus a 200-line evaluator would not give them.
 *
 * Every number here comes from `resolveStep`, the same function the live
 * preview uses, with the speed divisor left in the printed expression so the
 * `SPEED` constant at the top of the file still means something.
 */

export type EmitContext = {
  /** Emit TypeScript annotations, for the React target. */
  typed?: boolean;
  units: UnitMeta[];
  wordCount: number;
  wordDelays: Record<number, number>;
  speed: number;
  stagger: number;
  easeOverride: string | null;
  hasUnderline: boolean;
  hasCursor: boolean;
  debrisCount: number;
};

/** Identifiers the generated prelude declares for each spec target. */
const TARGET_SOURCE: Record<SpecTarget, string> = {
  chars: "chars",
  plain: "plain",
  gradient: "gradient",
  glyphs: "glyphs",
  reals: "reals",
  flashes: "flashes",
  words: "wordEls",
  underline: "underline",
  cursor: "cursor",
  debris: "debris",
};

const PALETTE_SOURCE = {
  $ink: "INK",
  $canvas: "CANVAS",
  $hot: "HOT",
  $warm: "WARM",
  $sun: "SUN",
  $gradient: "GRADIENT",
} as const;

function number(value: number): string {
  // Long binary tails read as noise in generated source and change nothing.
  return String(Math.round(value * 100000) / 100000);
}

function literal(value: number | string | (number | string)[]): string {
  return JSON.stringify(value);
}

function varsSource(
  resolved: Record<string, ResolvedVar>,
  count: number,
  extra: string[] = [],
  indexParam = "i",
): string {
  const entries = Object.entries(resolved).map(([key, entry]) => {
    const name = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
    if (entry.kind === "palette") return `${name}: ${PALETTE_SOURCE[entry.token]}`;
    if (entry.kind === "function") {
      return `${name}: ${functionValueSource(entry.spec, count, indexParam)}`;
    }
    return `${name}: ${literal(entry.value)}`;
  });

  return `{ ${[...entries, ...extra].join(", ")} }`;
}

function timingSource(step: SpecStep): { at: string; duration: string } {
  const base = step as { at?: number; d?: number };
  return {
    at: base.at ? `${number(base.at)} / SPEED` : "0",
    duration: base.d ? `${number(base.d)} / SPEED` : "0",
  };
}

function staggerSource(
  resolved: ResolvedStep,
  name: string,
  out: string[],
  indexParam: string,
): string | null {
  const { stagger, step } = resolved;
  if (!stagger) return null;

  if (stagger.kind === "simple") {
    const each = (step as { each?: number }).each ?? 0;
    return `{ each: ${number(each)} * STAGGER / SPEED, from: ${JSON.stringify(stagger.from)} }`;
  }

  // Per-word emphasis moved individual units off the even grid, so the offsets
  // are baked as data rather than reconstructed from an expression.
  out.push(`const ${name} = [${stagger.offsets.map(number).join(", ")}];`);
  return `(${indexParam}) => ${name}[i] ?? 0`;
}

/** Start time of every unit, for the effects that build one tween per unit. */
function unitStartsSource(
  resolved: ResolvedStep,
  count: number,
  name: string,
  out: string[],
): string {
  const starts: number[] = [];
  const { stagger, at } = resolved;

  for (let index = 0; index < count; index += 1) {
    if (!stagger) starts.push(at);
    else if (stagger.kind === "offsets") starts.push(at + (stagger.offsets[index] ?? 0));
    else starts.push(at + rank(index, count, stagger.from) * stagger.each);
  }

  out.push(`const ${name} = [${starts.map(number).join(", ")}];`);
  return name;
}

function rank(index: number, count: number, from: string): number {
  if (from === "start") return index;
  if (from === "end") return count - 1 - index;
  const centre = (count - 1) / 2;
  const indices = Array.from({ length: count }, (_, i) => i);
  const compare =
    from === "edges"
      ? (a: number, b: number) => Math.abs(b - centre) - Math.abs(a - centre) || a - b
      : from === "center"
        ? (a: number, b: number) => Math.abs(a - centre) - Math.abs(b - centre) || a - b
        : (a: number, b: number) => a - b;
  return indices.sort(compare).indexOf(index);
}

function unitStepTarget(step: SpecStep): SpecTarget | null {
  switch (step.type) {
    case "scramble":
    case "reel":
    case "glitch":
      return "chars";
    default:
      return "target" in step ? step.target : null;
  }
}

function specContextFor(target: SpecTarget | null, context: EmitContext): SpecContext {
  const count = target
    ? countForTarget(target, context.units, context.wordCount, {
        debris: context.debrisCount,
        hasUnderline: context.hasUnderline,
        hasCursor: context.hasCursor,
      })
    : context.units.length;

  return {
    speed: context.speed,
    stagger: context.stagger,
    easeOverride: context.easeOverride,
    // Colours are printed as identifiers, so the concrete values never matter
    // here — only the token each var resolved to.
    palette: { ink: "", canvas: "", hot: "", warm: "", sun: "", gradient: "" },
    unitDelays: target ? delaysForTarget(target, context.units, context.wordDelays) : [],
    unitCount: count,
  };
}

export function specSource(spec: MotionSpec, context: EmitContext): string {
  const out: string[] = [];
  const i = context.typed ? "i: number" : "i";
  let counter = 0;

  for (const step of spec.steps) {
    counter += 1;
    const target = unitStepTarget(step);
    const specContext = specContextFor(target, context);
    const resolved = resolveStep(step, specContext);
    const count = specContext.unitCount;
    const { at, duration } = timingSource(step);
    const ease = JSON.stringify(resolved.ease);

    switch (step.type) {
      case "set": {
        const nodes = TARGET_SOURCE[step.target];
        const stagger = staggerSource(resolved, `OFF_${counter}`, out, i);
        if (stagger) {
          out.push(
            `tl.to(${nodes}, ${varsSource(resolved.vars, count, [
              "duration: 0",
              `stagger: ${stagger}`,
            ], i)}, ${at});`,
          );
        } else {
          out.push(`tl.set(${nodes}, ${varsSource(resolved.vars, count, [], i)}, ${at});`);
        }
        break;
      }

      case "to": {
        const stagger = staggerSource(resolved, `OFF_${counter}`, out, i);
        const extra = [`duration: ${duration}`, `ease: ${ease}`];
        if (stagger) extra.push(`stagger: ${stagger}`);
        out.push(
          `tl.to(${TARGET_SOURCE[step.target]}, ${varsSource(resolved.vars, count, extra, i)}, ${at});`,
        );
        break;
      }

      case "fromTo": {
        const stagger = staggerSource(resolved, `OFF_${counter}`, out, i);
        const extra = [`duration: ${duration}`, `ease: ${ease}`];
        if (stagger) extra.push(`stagger: ${stagger}`);
        out.push(
          `tl.fromTo(${TARGET_SOURCE[step.target]}, ${varsSource(
            resolved.startVars,
            count,
            [],
            i,
          )}, ${varsSource(resolved.vars, count, extra, i)}, ${at});`,
        );
        break;
      }

      case "scramble": {
        const starts = unitStartsSource(resolved, count, `START_${counter}`, out);
        const tint = step.color ? PALETTE_SOURCE[step.color] : null;
        out.push(`tl.set(glyphs, { opacity: 1${tint ? `, color: ${tint}` : ""} }, ${at});
tl.set(reals, { opacity: 0 }, ${at});

units.forEach((unit, index) => {
  const at = ${starts}[index];
  const steps = Math.max(3, Math.round((${duration}) * ${step.rate}));
  const sequence = glyphSequence(steps, index + 1);
  const driver = { progress: 0 };

  // The glyph is derived from tween progress rather than picked inside
  // onUpdate, so scrubbing or restarting reproduces the decode exactly.
  tl.fromTo(driver, { progress: 0 }, {
    progress: 1, duration: ${duration}, ease: "none",
    onUpdate: () => {
      unit.glyph.textContent = sequence[Math.min(steps - 1, Math.floor(driver.progress * steps))];
    },
  }, at);

  tl.set(unit.glyph, { opacity: 0 }, at + (${duration}))
    .set(unit.real, { opacity: 1 }, at + (${duration}));
});`);
        break;
      }

      case "reel": {
        const starts = unitStartsSource(resolved, count, `START_${counter}`, out);
        out.push(`tl.set(glyphs, { opacity: 1, color: WARM }, ${at});
tl.set(reals, { opacity: 0, yPercent: -100 }, ${at});

units.forEach((unit, index) => {
  const at = ${starts}[index];
  const REELS = ${step.reels};
  const STEP = ${number(step.step)} / SPEED;
  const sequence = glyphSequence(REELS, index + 5);
  const setY = gsap.quickSetter(unit.glyph, "yPercent"); // no unit: yPercent takes a bare number
  const driver = { position: 0 };

  // One driver produces both the reel offset and the glyph on screen, so the
  // roll stays in sync however the timeline is scrubbed.
  tl.fromTo(driver, { position: 0 }, {
    position: REELS, duration: STEP * REELS, ease: "none",
    onUpdate: () => {
      const i = Math.min(REELS - 1, Math.floor(driver.position));
      unit.glyph.textContent = sequence[i];
      setY(-100 + (driver.position - i) * 100);
    },
  }, at);

  const landsAt = at + STEP * REELS;
  tl.set(unit.glyph, { opacity: 0 }, landsAt)
    .fromTo(unit.real, { yPercent: -100, opacity: 1 },
      { yPercent: 0, duration: ${number(step.land)} / SPEED, ease: ${ease} }, landsAt);
});`);
        break;
      }

      case "glitch": {
        const starts = unitStartsSource(resolved, count, `START_${counter}`, out);
        out.push(`units.forEach((unit, index) => {
  const at = ${starts}[index];
  tl.to(unit.el, {
    keyframes: { clipPath: glitchFramesFor(index), easeEach: "steps(1)" },
    duration: ${duration}, ease: "none",
  }, at);${
    step.jitter
      ? `
  tl.fromTo(unit.el, { x: glitchOffsetFor(index, ${step.jitter}) },
    { x: 0, duration: ${duration}, ease: "steps(3)" }, at);`
      : ""
  }
});`);
        break;
      }

      case "cursorBlink": {
        out.push(`// Block cursor blinks until the last slot resolves.
const CURSOR_SPAN = ${number(step.span)} / SPEED;
const CURSOR_BEAT = ${number(step.beat)} / SPEED;
tl.set(cursor, { opacity: 1 }, 0)
  .to(cursor, {
    opacity: 0, duration: CURSOR_BEAT, ease: "steps(1)",
    repeat: Math.max(1, Math.ceil(CURSOR_SPAN / CURSOR_BEAT) - 1), yoyo: true,
  }, 0)
  .to(cursor, { opacity: 0, duration: 0.22 / SPEED, ease: "power2.out" }, CURSOR_SPAN + 0.1);`);
        break;
      }

      case "debris": {
        const stepped = step.stepped;
        out.push(`tl.fromTo(debris, { opacity: 0, scale: 0.5 }, {
  opacity: 1, scale: 1, duration: ${stepped ? 0.06 : 0.075} / SPEED, ease: "steps(1)",
  repeat: ${stepped ? 5 : 3}, yoyo: true,
  stagger: { each: ${stepped ? 0.022 : 0.03}, from: "random" },
}, 0)
  .to(debris, {
    opacity: 0, scale: 0.35, duration: 0.32 / SPEED,
    ease: ${stepped ? '"steps(3)"' : '"power2.in"'},
    stagger: { each: 0.02, from: "random" },
  }, 0.55 / SPEED);`);
        break;
      }

      case "underlineSweep": {
        out.push(`const UL_AT_${counter} = ${at};
const UL_HOLD_${counter} = UL_AT_${counter} + ${number(step.hold)} / SPEED;
tl.to(underline, { scaleX: 1, duration: ${duration}, ease: ${ease} }, UL_AT_${counter})
  .set(underline, { transformOrigin: "100% 50%" }, UL_HOLD_${counter})
  .to(underline, { scaleX: 0, duration: (${duration}) * 0.85, ease: "power3.inOut" }, UL_HOLD_${counter});`);
        break;
      }
    }
  }

  if (spec.tail) {
    out.push(
      `// Hold the resting frame before the loop restarts.\ntl.set({}, {}, tl.duration() + ${number(
        spec.tail,
      )} / SPEED);`,
    );
  }

  return out.join("\n\n");
}
