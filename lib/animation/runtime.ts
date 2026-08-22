import { gsap } from "@/lib/gsap";
import {
  blinkCursor,
  glitchFrames,
  glitchOffset,
  reel,
  scramble,
  sprinkleDebris,
  underlineSweep,
} from "@/lib/animation/effects";
import {
  functionValue,
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
import { selectTargets, type TemplateContext } from "@/lib/animation/units";

/**
 * Builds a GSAP timeline from a `MotionSpec`.
 *
 * This is the half of the spec system that runs; `emit.ts` is the half that
 * prints. Both consume `resolveStep`, so the numbers in an exported file are
 * the numbers the preview is playing — not a second opinion about them.
 */

type GsapVars = Record<string, unknown>;

function applyVars(
  resolved: Record<string, ResolvedVar>,
  count: number,
  into: GsapVars = {},
): GsapVars {
  for (const [key, entry] of Object.entries(resolved)) {
    if (entry.kind === "function") into[key] = functionValue(entry.spec, count);
    else into[key] = entry.value;
  }
  return into;
}

function staggerVar(resolved: ResolvedStep): gsap.TweenVars["stagger"] {
  const { stagger } = resolved;
  if (!stagger) return undefined;
  if (stagger.kind === "simple") return { each: stagger.each, from: stagger.from };
  const offsets = stagger.offsets;
  return (index: number) => offsets[index] ?? 0;
}

/** Per-unit start time, used by the effects that build one tween per unit. */
function unitStarts(
  resolved: ResolvedStep,
  count: number,
): (index: number) => number {
  const { stagger, at } = resolved;
  if (!stagger) return () => at;
  if (stagger.kind === "offsets") return (index) => at + (stagger.offsets[index] ?? 0);
  const order = stagger.from;
  if (order === "start") return (index) => at + index * stagger.each;
  // The generic path: rank the indices the same way `resolveStep` would.
  const ranks = rankFor(count, order);
  return (index) => at + (ranks[index] ?? index) * stagger.each;
}

function rankFor(count: number, from: string): number[] {
  const indices = Array.from({ length: count }, (_, i) => i);
  if (from === "end") return indices.map((i) => count - 1 - i);
  const centre = (count - 1) / 2;
  const compare =
    from === "edges"
      ? (a: number, b: number) => Math.abs(b - centre) - Math.abs(a - centre) || a - b
      : (a: number, b: number) => Math.abs(a - centre) - Math.abs(b - centre) || a - b;
  const sorted = [...indices].sort(compare);
  const rank = new Array<number>(count);
  sorted.forEach((index, position) => (rank[index] = position));
  return rank;
}

function specContextFor(
  target: SpecTarget | null,
  context: TemplateContext,
  metas: UnitMeta[],
  wordDelays: Record<number, number>,
): SpecContext {
  const count = target
    ? countForTarget(target, metas, context.words.length, {
        debris: context.debris.length,
        hasUnderline: context.underline !== null,
        hasCursor: context.cursor !== null,
      })
    : metas.length;

  return {
    speed: context.speed,
    stagger: context.stagger,
    easeOverride: context.easeOverride ?? null,
    palette: context.palette,
    unitDelays: target ? delaysForTarget(target, metas, wordDelays) : [],
    unitCount: count,
  };
}

function targetOf(step: SpecStep): SpecTarget | null {
  return "target" in step ? step.target : null;
}

/** Unit-addressed effects always run against every unit, in phrase order. */
function unitStepTarget(step: SpecStep): SpecTarget | null {
  switch (step.type) {
    case "scramble":
    case "reel":
    case "glitch":
      return "chars";
    default:
      return targetOf(step);
  }
}

export function buildFromSpec(
  timeline: gsap.core.Timeline,
  spec: MotionSpec,
  context: TemplateContext,
): void {
  const metas: UnitMeta[] = context.units.map((unit) => ({
    index: unit.index,
    wordIndex: unit.wordIndex,
    isGradient: unit.isGradient,
  }));

  // Per-word emphasis delays, projected onto whichever array each step targets.
  const wordDelays: Record<number, number> = {};
  (context.unitDelays ?? []).forEach((delay, index) => {
    const meta = metas[index];
    if (meta && delay) wordDelays[meta.wordIndex] = delay;
  });

  for (const step of spec.steps) {
    const target = unitStepTarget(step);
    const specContext = specContextFor(target, context, metas, wordDelays);
    const resolved = resolveStep(step, specContext);
    const count = specContext.unitCount;

    switch (step.type) {
      case "set": {
        const nodes = selectTargets(step.target, context);
        if (!nodes.length) break;
        const vars = applyVars(resolved.vars, count);
        if (resolved.stagger) {
          // GSAP has no staggered `set`, but a zero-length tween is one.
          timeline.to(
            nodes,
            { ...vars, duration: 0, stagger: staggerVar(resolved) },
            resolved.at,
          );
        } else {
          timeline.set(nodes, vars, resolved.at);
        }
        break;
      }

      case "to": {
        const nodes = selectTargets(step.target, context);
        if (!nodes.length) break;
        timeline.to(
          nodes,
          {
            ...applyVars(resolved.vars, count),
            duration: resolved.duration,
            ease: resolved.ease,
            stagger: staggerVar(resolved),
          },
          resolved.at,
        );
        break;
      }

      case "fromTo": {
        const nodes = selectTargets(step.target, context);
        if (!nodes.length) break;
        timeline.fromTo(
          nodes,
          applyVars(resolved.startVars, count),
          {
            ...applyVars(resolved.vars, count),
            duration: resolved.duration,
            ease: resolved.ease,
            stagger: staggerVar(resolved),
          },
          resolved.at,
        );
        break;
      }

      case "scramble": {
        const startAt = unitStarts(resolved, count);
        const tint = step.color ? context.palette[paletteKey(step.color)] : null;

        // The overlays are revealed once, up front — the real text underneath
        // keeps holding the layout until each slot locks.
        timeline.set(
          context.units.map((entry) => entry.glyph),
          { opacity: 1, ...(tint ? { color: tint } : {}) },
          resolved.at,
        );
        timeline.set(
          context.units.map((entry) => entry.real),
          { opacity: 0 },
          resolved.at,
        );

        context.units.forEach((unit, index) => {
          const at = startAt(index);
          scramble(timeline, unit, {
            at,
            duration: resolved.duration,
            pool: context.glyphPool,
            rate: step.rate,
          });
          timeline
            .set(unit.glyph, { opacity: 0 }, at + resolved.duration)
            .set(unit.real, { opacity: 1 }, at + resolved.duration);
        });
        break;
      }

      case "reel": {
        const startAt = unitStarts(resolved, count);
        const stepSeconds = step.step / context.speed;
        const land = step.land / context.speed;

        timeline.set(
          context.units.map((unit) => unit.glyph),
          { opacity: 1, color: context.palette.warm },
          resolved.at,
        );
        timeline.set(
          context.units.map((unit) => unit.real),
          { opacity: 0, yPercent: -100 },
          resolved.at,
        );

        context.units.forEach((unit, index) => {
          const at = startAt(index);
          reel(timeline, unit, {
            at,
            reels: step.reels,
            step: stepSeconds,
            pool: context.glyphPool,
          });
          const landsAt = at + stepSeconds * step.reels;
          timeline
            .set(unit.glyph, { opacity: 0 }, landsAt)
            .fromTo(
              unit.real,
              { yPercent: -100, opacity: 1 },
              { yPercent: 0, duration: land, ease: resolved.ease },
              landsAt,
            );
        });
        break;
      }

      case "glitch": {
        const startAt = unitStarts(resolved, count);
        context.units.forEach((unit, index) => {
          const at = startAt(index);
          timeline.to(
            unit.el,
            {
              keyframes: { clipPath: glitchFrames(unit.index), easeEach: "steps(1)" },
              duration: resolved.duration,
              ease: "none",
            },
            at,
          );
          if (step.jitter) {
            timeline.fromTo(
              unit.el,
              { x: glitchOffset(unit.index, step.jitter) },
              { x: 0, duration: resolved.duration, ease: "steps(3)" },
              at,
            );
          }
        });
        break;
      }

      case "cursorBlink":
        blinkCursor(
          timeline,
          context.cursor,
          step.span / context.speed,
          context.speed,
          step.beat,
        );
        break;

      case "debris":
        sprinkleDebris(timeline, context.debris, context.speed, step.stepped);
        break;

      case "underlineSweep":
        underlineSweep(timeline, context.underline, {
          at: resolved.at,
          duration: resolved.duration,
          hold: step.hold / context.speed,
          ease: resolved.ease,
        });
        break;
    }
  }

  if (spec.tail) {
    // A bare `set` at the end extends the timeline so the resting frame is held
    // before a loop restarts, without inventing motion to fill it.
    timeline.set({}, {}, timeline.duration() + spec.tail / context.speed);
  }
}

function paletteKey(token: string): "ink" | "canvas" | "hot" | "warm" | "sun" | "gradient" {
  const map = {
    $ink: "ink",
    $canvas: "canvas",
    $hot: "hot",
    $warm: "warm",
    $sun: "sun",
    $gradient: "gradient",
  } as const;
  return map[token as keyof typeof map] ?? "ink";
}
