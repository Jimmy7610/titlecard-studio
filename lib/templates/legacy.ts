import {
  baseline,
  blinkCursor,
  glitchFrames,
  glitchOffset,
  reel,
  scramble,
  sprinkleDebris,
} from "@/lib/animation/effects";
import {
  boxes,
  flashesOf,
  glyphsOf,
  gradientOf,
  plainOf,
  realsOf,
} from "@/lib/animation/units";
import type { TemplateDefinition, TemplateId } from "@/lib/templates/types";

/**
 * The six original templates.
 *
 * These predate the spec system and keep their hand-written builders. That is
 * deliberate: each one encodes a decision that reads as a bug when generalised
 * — the odometer's single driver for both reel offset and glyph, the ribbon's
 * explicit `set` where a `fromTo` would leave the slab at the baseline opacity.
 * Their exported source is hand-written to match, so nothing about them moved
 * when the spec system landed.
 */

/** The curve each template is authored around, overridable from Motion. */
export const LEGACY_MAIN_EASE: Record<string, string> = {
  "agent-reveal": "agentReveal",
  "weightless-blur": "weightless",
  "glitch-mask": "none",
  "ribbon-wipe": "power3.inOut",
  "glyph-decode": "none",
  "odometer-roll": "agentReveal",
};

/** Structural curves — stepped or linear — are never replaced. */
function mainEase(id: TemplateId, override: string | null | undefined): string {
  const authored = LEGACY_MAIN_EASE[id] ?? "power2.out";
  if (!override) return authored;
  if (authored === "none" || authored.startsWith("steps")) return authored;
  return override;
}

/* ------------------------------------------------------------------ *
 * 1 — Agent Reveal
 * ------------------------------------------------------------------ */

const agentReveal: TemplateDefinition = {
  id: "agent-reveal",
  name: "Agent Reveal",
  category: "cinematic",
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
    const ease = mainEase("agent-reveal", context.easeOverride);

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
        ease,
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
            ease,
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
  category: "clean",
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
    const ease = mainEase("weightless-blur", context.easeOverride);

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
        ease,
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
          ease,
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
  category: "tech",
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
  category: "tech",
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
  category: "tech",
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
    const ease = mainEase("odometer-roll", context.easeOverride);

    baseline(timeline, context);

    timeline.set(glyphsOf(units), { opacity: 1, color: palette.warm }, 0);
    timeline.set(realsOf(units), { opacity: 0, yPercent: -100 }, 0);

    units.forEach((unit) => {
      const at = unit.index * each;
      reel(timeline, unit, { at, reels, step, pool: glyphPool });

      const landsAt = at + step * reels;

      timeline
        .set(unit.glyph, { opacity: 0 }, landsAt)
        .fromTo(
          unit.real,
          { yPercent: -100, opacity: 1 },
          { yPercent: 0, duration: land, ease },
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
  category: "luxury",
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
    const ease = mainEase("ribbon-wipe", context.easeOverride);

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
          ease,
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

export const LEGACY_TEMPLATES: readonly TemplateDefinition[] = [
  agentReveal,
  weightlessBlur,
  glitchMask,
  ribbonWipe,
  glyphDecode,
  odometerRoll,
] as const;

export const LEGACY_TEMPLATE_IDS = new Set<string>(
  LEGACY_TEMPLATES.map((template) => template.id),
);
