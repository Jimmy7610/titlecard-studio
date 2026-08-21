import { glyphSequence } from "@/lib/glyphs";
import { gsap } from "@/lib/gsap";
import { mulberry32 } from "@/lib/random";

export type TemplateId =
  | "agent-reveal"
  | "weightless-blur"
  | "glitch-mask"
  | "glyph-decode"
  | "odometer-roll"
  | "ribbon-wipe";

export type StagePalette = {
  /** Resting colour of non-gradient characters. */
  ink: string;
  /** Canvas colour — used to knock glyphs out of a colour slab. */
  canvas: string;
  hot: string;
  warm: string;
  sun: string;
};

/**
 * One character. `el` is the transformed box, `real` holds the actual glyph and
 * `glyph` is an empty overlay the scramble templates write into — keeping the
 * real character in the layout at all times means a decode never shifts the
 * line, however wide the substituted glyph is.
 */
export type CharUnit = {
  el: HTMLElement;
  glyph: HTMLElement;
  real: HTMLElement;
  index: number;
  wordIndex: number;
  isGradient: boolean;
};

export type WordUnit = {
  el: HTMLElement;
  flash: HTMLElement | null;
  chars: CharUnit[];
  index: number;
};

export type TemplateContext = {
  units: CharUnit[];
  words: WordUnit[];
  debris: HTMLElement[];
  underline: HTMLElement | null;
  cursor: HTMLElement | null;
  palette: StagePalette;
  /** Character pool the scramble templates draw from. */
  glyphPool: string;
  /** 1 = reference tempo. Higher is faster. */
  speed: number;
  /** Seconds between character reveals, before the speed multiplier. */
  stagger: number;
};

export type TemplateFamily = "mask" | "terminal";

export type TemplateDefinition = {
  id: TemplateId;
  name: string;
  family: TemplateFamily;
  tagline: string;
  description: string;
  /** Drives the glyph-pool control's visibility. */
  usesGlyphs: boolean;
  /** Reserves inline space for a block cursor after the phrase. */
  showCursor: boolean;
  build: (timeline: gsap.core.Timeline, context: TemplateContext) => void;
};

/* ------------------------------------------------------------------ *
 * Deterministic glitch geometry
 * ------------------------------------------------------------------ */

/** Seeded `inset()` slabs converging on a fully visible glyph. */
function glitchFrames(index: number): string[] {
  const rand = mulberry32(index * 2654435761 + 101);
  const frames: string[] = [];

  for (let step = 0; step < 4; step += 1) {
    const top = Math.round(rand() * 52);
    const bottom = Math.round(rand() * (90 - top));
    const left = Math.round(rand() * 38);
    const right = Math.round(rand() * (86 - left));
    frames.push(`inset(${top}% ${right}% ${bottom}% ${left}%)`);
  }

  frames.push("inset(0% 0% 0% 0%)");
  return frames;
}

/** Sub-pixel horizontal jitter — stays well inside the character footprint. */
function glitchOffset(index: number): number {
  const rand = mulberry32(index * 40503 + 7);
  return Math.round((rand() * 2 - 1) * 3);
}

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

const boxes = (units: CharUnit[]) => units.map((unit) => unit.el);
const glyphsOf = (units: CharUnit[]) => units.map((unit) => unit.glyph);
const realsOf = (units: CharUnit[]) => units.map((unit) => unit.real);
const plainOf = (units: CharUnit[]) => units.filter((unit) => !unit.isGradient);
const gradientOf = (units: CharUnit[]) => units.filter((unit) => unit.isGradient);

function flashesOf(words: WordUnit[]): HTMLElement[] {
  return words
    .map((word) => word.flash)
    .filter((node): node is HTMLElement => node !== null);
}

/**
 * Every template starts from the same baseline, so switching templates can
 * never leave a stale transform, filter, clip-path or glyph overlay behind.
 */
function baseline(timeline: gsap.core.Timeline, context: TemplateContext) {
  const { units, words, debris, underline, cursor } = context;

  timeline.set(
    boxes(units),
    {
      xPercent: 0,
      yPercent: 0,
      x: 0,
      y: 0,
      rotate: 0,
      scale: 1,
      opacity: 1,
      filter: "none",
      clipPath: "none",
      transformOrigin: "0% 100%",
    },
    0,
  );

  timeline.set(glyphsOf(units), { opacity: 0, yPercent: 0, x: 0 }, 0);
  timeline.set(realsOf(units), { opacity: 1, yPercent: 0 }, 0);

  const flashes = flashesOf(words);
  if (flashes.length) {
    timeline.set(flashes, { opacity: 0, clipPath: "inset(0% 0% 0% 0%)" }, 0);
  }
  if (debris.length) timeline.set(debris, { opacity: 0, scale: 0.5 }, 0);
  if (underline) {
    timeline.set(
      underline,
      { scaleX: 0, opacity: 1, transformOrigin: "0% 50%" },
      0,
    );
  }
  if (cursor) timeline.set(cursor, { opacity: 0 }, 0);
}

/**
 * Cycles one character through a pre-rolled glyph sequence.
 *
 * The tween drives a plain number and the glyph is derived from it, so the
 * rendered character is a pure function of timeline progress — scrubbing
 * backwards or restarting reproduces the decode exactly.
 */
function scramble(
  timeline: gsap.core.Timeline,
  unit: CharUnit,
  options: { at: number; duration: number; pool: string; rate: number },
) {
  const steps = Math.max(3, Math.round(options.duration * options.rate));
  const sequence = glyphSequence(options.pool, steps, unit.index + 1);
  const driver = { progress: 0 };

  timeline.fromTo(
    driver,
    { progress: 0 },
    {
      progress: 1,
      duration: options.duration,
      ease: "none",
      onUpdate: () => {
        const step = Math.min(steps - 1, Math.floor(driver.progress * steps));
        unit.glyph.textContent = sequence[step];
      },
    },
    options.at,
  );
}

/** Blinks the block cursor for `span` seconds, then retires it. */
function blinkCursor(
  timeline: gsap.core.Timeline,
  cursor: HTMLElement | null,
  span: number,
  speed: number,
) {
  if (!cursor) return;

  const beat = 0.26 / speed;
  const repeats = Math.max(1, Math.ceil(span / beat) - 1);

  timeline
    .set(cursor, { opacity: 1 }, 0)
    .to(
      cursor,
      { opacity: 0, duration: beat, ease: "steps(1)", repeat: repeats, yoyo: true },
      0,
    )
    .to(cursor, { opacity: 0, duration: 0.22 / speed, ease: "power2.out" }, span + 0.1);
}

function sprinkleDebris(
  timeline: gsap.core.Timeline,
  debris: HTMLElement[],
  speed: number,
  stepped: boolean,
) {
  if (!debris.length) return;

  timeline
    .fromTo(
      debris,
      { opacity: 0, scale: 0.5 },
      {
        opacity: 1,
        scale: 1,
        duration: (stepped ? 0.06 : 0.075) / speed,
        ease: "steps(1)",
        repeat: stepped ? 5 : 3,
        yoyo: true,
        stagger: { each: stepped ? 0.022 : 0.03, from: "random" },
      },
      0,
    )
    .to(
      debris,
      {
        opacity: 0,
        scale: 0.35,
        duration: 0.32 / speed,
        ease: stepped ? "steps(3)" : "power2.in",
        stagger: { each: 0.02, from: "random" },
      },
      0.55 / speed,
    );
}

/* ------------------------------------------------------------------ *
 * 1 — Agent Reveal
 * ------------------------------------------------------------------ */

const agentReveal: TemplateDefinition = {
  id: "agent-reveal",
  name: "Agent Reveal",
  family: "mask",
  tagline: "Masked rise · rotate 5°",
  usesGlyphs: false,
  showCursor: false,
  description:
    "Characters start fully outside their own mask box at translateY(110%) with a 5° rotation, then snap up on a sharp custom cubic-bezier. Colour resolves from hot accent into ink while a gradient rule sweeps beneath the line.",

  build(timeline, context) {
    const { units, words, debris, underline, palette, speed, stagger } = context;
    const plain = plainOf(units);
    const gradient = gradientOf(units);
    const reveal = 1.05 / speed;
    const each = stagger / speed;
    const flashes = flashesOf(words);

    baseline(timeline, context);

    timeline.set(
      boxes(units),
      { yPercent: 110, rotate: 5, transformOrigin: "0% 100%" },
      0,
    );
    if (flashes.length) {
      timeline.set(flashes, { clipPath: "inset(0% 100% 0% 0%)" }, 0);
    }

    // An accent slab wipes across each word just ahead of its letters.
    flashes.forEach((flash, index) => {
      const at = index * each * 2.2;
      timeline
        .to(
          flash,
          {
            opacity: 0.9,
            clipPath: "inset(0% 0% 0% 0%)",
            duration: reveal * 0.34,
            ease: "agentSweep",
          },
          at,
        )
        .to(
          flash,
          {
            opacity: 0,
            clipPath: "inset(0% 0% 0% 100%)",
            duration: reveal * 0.45,
            ease: "agentSweep",
          },
          at + reveal * 0.3,
        );
    });

    timeline.to(
      boxes(plain),
      {
        yPercent: 0,
        rotate: 0,
        duration: reveal,
        ease: "agentReveal",
        stagger: { each, from: "start" },
      },
      0,
    );

    if (plain.length) {
      timeline.fromTo(
        boxes(plain),
        { color: palette.hot },
        {
          color: palette.ink,
          duration: reveal * 0.9,
          ease: "power2.out",
          stagger: { each, from: "start" },
        },
        0.05,
      );
    }

    // The gradient tail ("3") lands last and slightly heavier.
    if (gradient.length) {
      const at = each * plain.length + 0.16;
      timeline
        .to(
          boxes(gradient),
          {
            yPercent: 0,
            rotate: 0,
            duration: reveal * 1.05,
            ease: "agentReveal",
            stagger: { each: each * 1.4, from: "start" },
          },
          at,
        )
        .fromTo(
          boxes(gradient),
          { scale: 1.09 },
          {
            scale: 1,
            duration: reveal * 1.1,
            ease: "power3.out",
            stagger: { each: each * 1.4, from: "start" },
          },
          at,
        );
    }

    if (underline) {
      const enter = 0.06;
      const hold = enter + reveal * 0.62;
      timeline
        .to(underline, { scaleX: 1, duration: reveal * 0.62, ease: "power3.out" }, enter)
        .set(underline, { transformOrigin: "100% 50%" }, hold + 0.1)
        .to(underline, { scaleX: 0, duration: reveal * 0.52, ease: "power3.inOut" }, hold + 0.1);
    }

    sprinkleDebris(timeline, debris, speed, false);
  },
};

/* ------------------------------------------------------------------ *
 * 2 — Weightless Blur
 * ------------------------------------------------------------------ */

const weightlessBlur: TemplateDefinition = {
  id: "weightless-blur",
  name: "Weightless Blur",
  family: "mask",
  tagline: "Defocus · soft lift",
  usesGlyphs: false,
  showCursor: false,
  description:
    "Characters surface from the lower half of their mask box out of an 11px defocus, easing on a long tail. Nothing travels beyond the word footprint — the blur halo is clipped by the mask, which is what gives the edge its softness.",

  build(timeline, context) {
    const { units, speed, stagger } = context;
    const plain = plainOf(units);
    const gradient = gradientOf(units);
    const duration = 1.55 / speed;
    const each = (stagger * 1.6) / speed;

    baseline(timeline, context);

    timeline.set(
      boxes(units),
      {
        yPercent: 60,
        opacity: 0,
        scale: 1.03,
        filter: "blur(11px)",
        transformOrigin: "50% 100%",
      },
      0,
    );

    timeline.to(
      boxes(plain),
      {
        yPercent: 0,
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        duration,
        ease: "weightless",
        stagger: { each, from: "start" },
      },
      0,
    );

    if (gradient.length) {
      timeline.to(
        boxes(gradient),
        {
          yPercent: 0,
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
          duration: duration * 1.15,
          ease: "weightless",
          stagger: { each: each * 1.2, from: "start" },
        },
        each * plain.length + 0.1,
      );
    }
  },
};

/* ------------------------------------------------------------------ *
 * 3 — Glitch Mask
 * ------------------------------------------------------------------ */

const glitchMask: TemplateDefinition = {
  id: "glitch-mask",
  name: "Glitch Mask",
  family: "mask",
  tagline: "Clip-path slabs · stepped",
  usesGlyphs: false,
  showCursor: false,
  description:
    "Each character steps through four seeded inset() clip paths before resolving, so blocks of the glyph appear at once rather than fading. Colour and jitter run on the same stepped clock, and an accent slab strobes behind each word.",

  build(timeline, context) {
    const { units, words, debris, underline, palette, speed, stagger } = context;
    const duration = 0.66 / speed;
    const each = (stagger * 1.15) / speed;
    const flashes = flashesOf(words);

    baseline(timeline, context);

    timeline.set(
      boxes(units),
      { clipPath: "inset(100% 0% 0% 0%)", transformOrigin: "50% 50%" },
      0,
    );

    flashes.forEach((flash, index) => {
      timeline.to(
        flash,
        {
          keyframes: {
            opacity: [1, 0.9, 0.75, 0],
            clipPath: [
              "inset(0% 52% 0% 0%)",
              "inset(0% 8% 44% 0%)",
              "inset(30% 0% 0% 26%)",
              "inset(0% 0% 100% 0%)",
            ],
            easeEach: "steps(1)",
          },
          duration: duration * 1.2,
          ease: "none",
        },
        index * each * 1.6,
      );
    });

    units.forEach((unit) => {
      const at = unit.index * each;

      timeline.to(
        unit.el,
        {
          keyframes: { clipPath: glitchFrames(unit.index), easeEach: "steps(1)" },
          duration,
          ease: "none",
        },
        at,
      );

      timeline.fromTo(
        unit.el,
        { x: glitchOffset(unit.index) },
        { x: 0, duration, ease: "steps(3)" },
        at,
      );

      if (!unit.isGradient) {
        timeline.fromTo(
          unit.el,
          { color: palette.warm },
          { color: palette.ink, duration: duration * 1.15, ease: "steps(4)" },
          at,
        );
      }
    });

    if (underline) {
      timeline
        .to(underline, { scaleX: 1, duration: duration * 0.9, ease: "steps(6)" }, 0.04)
        .set(underline, { transformOrigin: "100% 50%" }, duration * 1.5)
        .to(underline, { scaleX: 0, duration: duration * 0.8, ease: "steps(5)" }, duration * 1.5);
    }

    sprinkleDebris(timeline, debris, speed, true);
  },
};

/* ------------------------------------------------------------------ *
 * 4 — Glyph Decode
 * ------------------------------------------------------------------ */

const glyphDecode: TemplateDefinition = {
  id: "glyph-decode",
  name: "Glyph Decode",
  family: "terminal",
  tagline: "TUI scramble · lock-in",
  usesGlyphs: true,
  showCursor: true,
  description:
    "Each slot cycles through the glyph pool at ~22 swaps a second, then locks to the real character with a stepped colour flash. The real glyph holds the layout underneath the whole time, so nothing reflows as the decode runs. A block cursor blinks until the last slot resolves.",

  build(timeline, context) {
    const { units, debris, cursor, palette, glyphPool, speed, stagger } = context;
    const cycle = 0.52 / speed;
    const each = (stagger * 1.3) / speed;

    baseline(timeline, context);

    timeline.set(glyphsOf(units), { opacity: 1, color: palette.hot }, 0);
    timeline.set(realsOf(units), { opacity: 0 }, 0);

    units.forEach((unit) => {
      const at = unit.index * each;

      scramble(timeline, unit, { at, duration: cycle, pool: glyphPool, rate: 22 });

      timeline
        .set(unit.glyph, { opacity: 0 }, at + cycle)
        .set(unit.real, { opacity: 1 }, at + cycle);

      if (!unit.isGradient) {
        timeline.fromTo(
          unit.real,
          { color: palette.warm },
          { color: palette.ink, duration: cycle * 1.1, ease: "steps(3)" },
          at + cycle,
        );
      }
    });

    blinkCursor(timeline, cursor, units.length * each + cycle, speed);
    sprinkleDebris(timeline, debris, speed, true);
  },
};

/* ------------------------------------------------------------------ *
 * 5 — Odometer Roll
 * ------------------------------------------------------------------ */

const odometerRoll: TemplateDefinition = {
  id: "odometer-roll",
  name: "Odometer Roll",
  family: "terminal",
  tagline: "Glyph reel · lands down",
  usesGlyphs: true,
  showCursor: false,
  description:
    "A reel of glyphs rolls down through each slot before the real character lands. The word's mask box is what clips the reel top and bottom — this is the template that shows most directly why the mask exists. Reveals downward, against the upward rise of Agent Reveal.",

  build(timeline, context) {
    const { units, palette, glyphPool, speed, stagger } = context;
    const reels = 5;
    const step = 0.085 / speed;
    const each = (stagger * 1.5) / speed;
    const land = 0.5 / speed;

    baseline(timeline, context);

    timeline.set(glyphsOf(units), { opacity: 1, color: palette.warm }, 0);
    timeline.set(realsOf(units), { opacity: 0, yPercent: -100 }, 0);

    units.forEach((unit) => {
      const at = unit.index * each;
      const sequence = glyphSequence(glyphPool, reels, unit.index + 5);
      // No unit argument: `yPercent` is already a percentage, and passing "%"
      // makes quickSetter emit "-47%" where GSAP expects the bare number —
      // which fails silently and leaves the reel parked.
      const setY = gsap.quickSetter(unit.glyph, "yPercent") as (v: number) => void;
      const driver = { position: 0 };

      // One driver produces both the reel offset and the glyph on screen, so
      // the roll stays in sync however the timeline is scrubbed.
      timeline.fromTo(
        driver,
        { position: 0 },
        {
          position: reels,
          duration: step * reels,
          ease: "none",
          onUpdate: () => {
            const index = Math.min(reels - 1, Math.floor(driver.position));
            unit.glyph.textContent = sequence[index];
            setY(-100 + (driver.position - index) * 100);
          },
        },
        at,
      );

      const landsAt = at + step * reels;

      timeline
        .set(unit.glyph, { opacity: 0 }, landsAt)
        .fromTo(
          unit.real,
          { yPercent: -100, opacity: 1 },
          { yPercent: 0, duration: land, ease: "agentReveal" },
          landsAt,
        );

      if (!unit.isGradient) {
        timeline.fromTo(
          unit.real,
          { color: palette.hot },
          { color: palette.ink, duration: land * 0.9, ease: "power2.out" },
          landsAt,
        );
      }
    });
  },
};

/* ------------------------------------------------------------------ *
 * 6 — Ribbon Wipe
 * ------------------------------------------------------------------ */

const ribbonWipe: TemplateDefinition = {
  id: "ribbon-wipe",
  name: "Ribbon Wipe",
  family: "mask",
  tagline: "Highlighter pass · knockout",
  usesGlyphs: false,
  showCursor: false,
  description:
    "A solid accent ribbon sweeps across each word and leaves the letters behind it. While the ribbon covers a character the glyph is tinted to the canvas colour, so it reads as knocked out of the block — then it resolves to ink as the ribbon clears.",

  build(timeline, context) {
    const { units, words, underline, palette, speed, stagger } = context;
    const sweep = 0.62 / speed;
    const gap = sweep * 0.45;

    baseline(timeline, context);

    timeline.set(boxes(units), { clipPath: "inset(0% 100% 0% 0%)" }, 0);

    words.forEach((word) => {
      const at = word.index * gap;
      const wordBoxes = boxes(word.chars);
      const plain = boxes(plainOf(word.chars));

      if (word.flash) {
        timeline
          // Explicit `set` rather than a `fromTo`: a property that appears only
          // in the from-vars has no tween to hold it, so the ribbon would stay
          // at the opacity the baseline left it on.
          .set(word.flash, { opacity: 1, clipPath: "inset(0% 100% 0% 0%)" }, at)
          .to(
            word.flash,
            { clipPath: "inset(0% 0% 0% 0%)", duration: sweep, ease: "power3.inOut" },
            at,
          )
          .to(
            word.flash,
            { clipPath: "inset(0% 0% 0% 100%)", duration: sweep, ease: "power3.inOut" },
            at + sweep * 0.6,
          )
          .set(word.flash, { opacity: 0 }, at + sweep * 1.6);
      }

      timeline.to(
        wordBoxes,
        {
          clipPath: "inset(0% 0% 0% 0%)",
          duration: sweep * 0.85,
          ease: "power3.inOut",
          stagger: { each: stagger / speed / 2, from: "start" },
        },
        at + sweep * 0.22,
      );

      // Canvas-coloured while the ribbon is over them, ink once it has passed.
      if (plain.length) {
        timeline.fromTo(
          plain,
          { color: palette.canvas },
          { color: palette.ink, duration: sweep * 0.9, ease: "power2.out" },
          at + sweep * 0.62,
        );
      }
    });

    if (underline) {
      const total = words.length * gap + sweep;
      timeline
        .to(underline, { scaleX: 1, duration: sweep * 0.8, ease: "power3.out" }, sweep * 0.2)
        .set(underline, { transformOrigin: "100% 50%" }, total)
        .to(underline, { scaleX: 0, duration: sweep * 0.7, ease: "power3.inOut" }, total);
    }
  },
};

export const TEMPLATES: readonly TemplateDefinition[] = [
  agentReveal,
  weightlessBlur,
  glitchMask,
  ribbonWipe,
  glyphDecode,
  odometerRoll,
] as const;

const TEMPLATE_INDEX = new Map(TEMPLATES.map((template) => [template.id, template]));

/** Falls back to the first template; see the note on getPalette. */
export function getTemplate(id: TemplateId): TemplateDefinition {
  return TEMPLATE_INDEX.get(id) ?? TEMPLATES[0];
}
