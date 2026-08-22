import { mulberry32 } from "@/lib/random";

/**
 * A declarative description of a timeline.
 *
 * The point of this module is that one description drives three consumers that
 * must never disagree: the live preview builds a GSAP timeline from it, the
 * code exporters print GSAP source from it, and the video exporter records the
 * timeline the first consumer built. Numbers are resolved once, in
 * `resolveStep`, and both the builder and the printer consume that result — so
 * the exported code cannot drift away from what the user is watching.
 */

/* ------------------------------------------------------------------ *
 * Targets
 * ------------------------------------------------------------------ */

export type SpecTarget =
  /** Every animated unit box — a grapheme, a word or a line. */
  | "chars"
  /** Unit boxes without the gradient treatment. */
  | "plain"
  /** Unit boxes carrying the gradient treatment. */
  | "gradient"
  /** Absolutely positioned scramble overlays. */
  | "glyphs"
  /** The real glyph inside each unit — always holds the layout. */
  | "reals"
  /** One colour slab per word, behind the glyphs. */
  | "flashes"
  /** The word mask boxes themselves. */
  | "words"
  | "underline"
  | "cursor"
  | "debris";

/* ------------------------------------------------------------------ *
 * Values
 * ------------------------------------------------------------------ */

/** Palette tokens usable anywhere a colour is expected. */
export type PaletteToken = "$ink" | "$canvas" | "$hot" | "$warm" | "$sun" | "$gradient";

/**
 * Per-index value generators.
 *
 * GSAP accepts a function for any var, which is how a template can start every
 * other character above the mask instead of below it, or scatter a seeded
 * cloud. They are described as data rather than written as closures so the
 * exporters can print the equivalent arrow function.
 */
export type SpecFunctionValue =
  /** `a` on even indices, `b` on odd ones. */
  | { fn: "alternate"; a: number; b: number }
  /** Centred spread: index 0 leftmost, last index rightmost. */
  | { fn: "spread"; amount: number }
  /** `Math.sin(index * freq) * amp`. */
  | { fn: "wave"; amp: number; freq: number }
  /** Deterministic per-index value in `[min, max]`. */
  | { fn: "seeded"; min: number; max: number; seed: number }
  /** `index * mul + add`. */
  | { fn: "ramp"; mul: number; add: number };

export type SpecValue =
  | number
  | string
  | PaletteToken
  | SpecFunctionValue
  | (number | string)[];

export type SpecVars = Record<string, SpecValue>;

export type StaggerFrom = "start" | "end" | "center" | "edges" | "random";

/* ------------------------------------------------------------------ *
 * Steps
 * ------------------------------------------------------------------ */

type StepBase = {
  /** Start time in reference seconds, before the speed divisor. */
  at?: number;
  /** Stagger between units, as a multiple of the project stagger. */
  each?: number;
  from?: StaggerFrom;
};

export type SpecStep =
  | ({ type: "set"; target: SpecTarget; vars: SpecVars } & StepBase)
  | ({ type: "to"; target: SpecTarget; vars: SpecVars; d: number; ease?: string } & StepBase)
  | ({
      type: "fromTo";
      target: SpecTarget;
      start: SpecVars;
      end: SpecVars;
      d: number;
      ease?: string;
    } & StepBase)
  /** TUI scramble on the glyph overlays, one pre-rolled sequence per unit. */
  | ({ type: "scramble"; d: number; rate: number; color?: PaletteToken } & StepBase)
  /** A reel of glyphs rolling down through each slot before the real one lands. */
  | ({ type: "reel"; reels: number; step: number; land: number; ease?: string } & StepBase)
  /** Seeded `inset()` slabs converging on a fully visible glyph. */
  | ({ type: "glitch"; d: number; jitter?: number } & StepBase)
  /** Block cursor that blinks until `span` and then retires. */
  | { type: "cursorBlink"; beat: number; span: number }
  /** Pixel debris flicker around the wordmark. */
  | { type: "debris"; stepped: boolean }
  /** The gradient rule that sweeps under the line and retracts. */
  | { type: "underlineSweep"; d: number; at?: number; hold: number; ease?: string };

export type MotionSpec = {
  steps: SpecStep[];
  /**
   * Extra seconds appended to the timeline after the last tween, so a template
   * whose motion ends abruptly still holds its resting frame before a loop.
   */
  tail?: number;
};

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

export type SpecPalette = {
  ink: string;
  canvas: string;
  hot: string;
  warm: string;
  sun: string;
  gradient: string;
};

export type SpecContext = {
  /** 1 = reference tempo. Higher is faster. */
  speed: number;
  /** Seconds between neighbouring units, before the speed divisor. */
  stagger: number;
  /** `null` keeps whatever curve each step was authored with. */
  easeOverride: string | null;
  palette: SpecPalette;
  /** Extra seconds per unit index, from per-word emphasis. */
  unitDelays: readonly number[];
  unitCount: number;
};

const PALETTE_KEYS: Record<PaletteToken, keyof SpecPalette> = {
  $ink: "ink",
  $canvas: "canvas",
  $hot: "hot",
  $warm: "warm",
  $sun: "sun",
  $gradient: "gradient",
};

export function isPaletteToken(value: unknown): value is PaletteToken {
  return typeof value === "string" && value in PALETTE_KEYS;
}

export function isFunctionValue(value: unknown): value is SpecFunctionValue {
  return typeof value === "object" && value !== null && "fn" in value;
}

/** Builds the actual per-index function a `SpecFunctionValue` describes. */
export function functionValue(
  value: SpecFunctionValue,
  count: number,
): (index: number) => number {
  switch (value.fn) {
    case "alternate":
      return (index) => (index % 2 === 0 ? value.a : value.b);
    case "spread": {
      const centre = (count - 1) / 2;
      return (index) => (index - centre) * value.amount;
    }
    case "wave":
      return (index) => Math.sin(index * value.freq) * value.amp;
    case "seeded":
      return (index) => {
        const random = mulberry32(index * 2654435761 + value.seed)();
        return value.min + random * (value.max - value.min);
      };
    case "ramp":
      return (index) => index * value.mul + value.add;
  }
}

/**
 * Prints the same function as JavaScript source, for the code exporters.
 *
 * `indexParam` carries the annotation the React target needs — the standalone
 * page would treat `i: number` as a syntax error.
 */
export function functionValueSource(
  value: SpecFunctionValue,
  count: number,
  indexParam = "i",
): string {
  switch (value.fn) {
    case "alternate":
      return `(${indexParam}) => (i % 2 === 0 ? ${value.a} : ${value.b})`;
    case "spread":
      return `(${indexParam}) => (i - ${(count - 1) / 2}) * ${value.amount}`;
    case "wave":
      return `(${indexParam}) => Math.sin(i * ${value.freq}) * ${value.amp}`;
    case "seeded":
      return `(${indexParam}) => ${value.min} + rng(i * 2654435761 + ${value.seed})() * ${value.max - value.min}`;
    case "ramp":
      return `(${indexParam}) => i * ${value.mul} + ${value.add}`;
  }
}

export type ResolvedVar =
  | { kind: "literal"; value: number | string | (number | string)[] }
  | { kind: "palette"; token: PaletteToken; value: string }
  | { kind: "function"; spec: SpecFunctionValue };

export type ResolvedStagger =
  | null
  | { kind: "simple"; each: number; from: StaggerFrom }
  /** Per-index offsets, used when word emphasis shifts individual units. */
  | { kind: "offsets"; offsets: number[] };

export type ResolvedStep = {
  step: SpecStep;
  /** Start position on the timeline, in real seconds. */
  at: number;
  /** Tween length in real seconds. */
  duration: number;
  ease: string;
  vars: Record<string, ResolvedVar>;
  startVars: Record<string, ResolvedVar>;
  stagger: ResolvedStagger;
};

function resolveVars(vars: SpecVars, palette: SpecPalette): Record<string, ResolvedVar> {
  const out: Record<string, ResolvedVar> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (isPaletteToken(value)) {
      out[key] = { kind: "palette", token: value, value: palette[PALETTE_KEYS[value]] };
    } else if (isFunctionValue(value)) {
      out[key] = { kind: "function", spec: value };
    } else {
      out[key] = { kind: "literal", value };
    }
  }
  return out;
}

/** Rank of each index under a `from` mode — the order units actually fire in. */
export function staggerOrder(count: number, from: StaggerFrom): number[] {
  const indices = Array.from({ length: count }, (_, i) => i);

  switch (from) {
    case "start":
      return indices;
    case "end":
      return indices.map((i) => count - 1 - i);
    case "center": {
      const centre = (count - 1) / 2;
      const sorted = [...indices].sort(
        (a, b) => Math.abs(a - centre) - Math.abs(b - centre) || a - b,
      );
      const rank = new Array<number>(count);
      sorted.forEach((index, position) => (rank[index] = position));
      return rank;
    }
    case "edges": {
      const centre = (count - 1) / 2;
      const sorted = [...indices].sort(
        (a, b) => Math.abs(b - centre) - Math.abs(a - centre) || a - b,
      );
      const rank = new Array<number>(count);
      sorted.forEach((index, position) => (rank[index] = position));
      return rank;
    }
    case "random": {
      // Seeded so a replay reproduces the same order.
      const random = mulberry32(0x5eed);
      const sorted = [...indices]
        .map((index) => ({ index, key: random() }))
        .sort((a, b) => a.key - b.key)
        .map((entry) => entry.index);
      const rank = new Array<number>(count);
      sorted.forEach((index, position) => (rank[index] = position));
      return rank;
    }
  }
}

/**
 * Turns one authored step into concrete numbers.
 *
 * Every duration in a spec is written at the reference tempo and divided by
 * speed here; every `each` is a multiple of the project stagger. Doing it in
 * one place is what lets the exported source quote the same numbers the
 * preview is running.
 */
export function resolveStep(step: SpecStep, context: SpecContext): ResolvedStep {
  const { speed, stagger, easeOverride, palette, unitDelays, unitCount } = context;

  const base = step as Partial<StepBase> & { d?: number; ease?: string };
  const at = (base.at ?? 0) / speed;
  const duration = (base.d ?? 0) / speed;

  const authored = base.ease ?? "power2.out";
  // Stepped and linear curves are structural, not stylistic: overriding
  // `steps(1)` with an elastic ease turns a decode into a wobble.
  const structural = authored.startsWith("steps") || authored === "none";
  const ease = structural || !easeOverride ? authored : easeOverride;

  let resolvedStagger: ResolvedStagger = null;
  const each = base.each;
  if (each !== undefined && each !== 0) {
    const eachSeconds = (each * stagger) / speed;
    const from = base.from ?? "start";
    const hasDelays = unitDelays.some((value) => value !== 0);

    if (hasDelays) {
      const order = staggerOrder(unitCount, from);
      resolvedStagger = {
        kind: "offsets",
        offsets: order.map(
          (rank, index) => rank * eachSeconds + (unitDelays[index] ?? 0) / speed,
        ),
      };
    } else {
      resolvedStagger = { kind: "simple", each: eachSeconds, from };
    }
  }

  const vars =
    step.type === "set" || step.type === "to"
      ? resolveVars(step.vars, palette)
      : step.type === "fromTo"
        ? resolveVars(step.end, palette)
        : {};

  const startVars =
    step.type === "fromTo" ? resolveVars(step.start, palette) : {};

  return { step, at, duration, ease, vars, startVars, stagger: resolvedStagger };
}
