import type { MotionSpec } from "@/lib/animation/spec";
import type { TemplateDefinition } from "@/lib/templates/types";

/**
 * The declarative template library.
 *
 * Each entry is data. The preview builds a GSAP timeline from it, the HTML,
 * React and clipboard exporters print GSAP source from it, and the video
 * exporter records the timeline the preview built — so adding a template here
 * adds it to every export at the same time, with nothing left to remember.
 *
 * Durations are written at the reference tempo (speed 1) and `each` is a
 * multiple of the project stagger, so the Motion panel scales every template
 * the same way.
 */

type Entry = Omit<TemplateDefinition, "spec" | "build"> & { spec: MotionSpec };

/* ------------------------------------------------------------------ *
 * Clean
 * ------------------------------------------------------------------ */

const fadeUp: Entry = {
  id: "fade-up",
  name: "Fade Up",
  category: "clean",
  family: "mask",
  tagline: "Mask rise · fade",
  usesGlyphs: false,
  showCursor: false,
  description:
    "The plainest useful reveal: every character starts just below its own mask box and rises into place while it fades up. Nothing rotates, nothing overshoots — it is the one to reach for when the words are the point.",
  spec: {
    steps: [
      { type: "set", target: "chars", vars: { yPercent: 110, opacity: 0 } },
      {
        type: "to",
        target: "chars",
        vars: { yPercent: 0, opacity: 1 },
        d: 0.85,
        ease: "power3.out",
        each: 1,
      },
    ],
    tail: 0.5,
  },
};

const softReveal: Entry = {
  id: "soft-reveal",
  name: "Soft Reveal",
  category: "clean",
  family: "mask",
  tagline: "Short lift · light defocus",
  usesGlyphs: false,
  showCursor: false,
  description:
    "A shorter rise than Fade Up with a 6px defocus that resolves as the character settles. The blur is clipped by the mask, so the edge softens without the glyph ever spilling outside the word.",
  spec: {
    steps: [
      {
        type: "set",
        target: "chars",
        vars: { yPercent: 45, opacity: 0, filter: "blur(6px)" },
      },
      {
        type: "to",
        target: "chars",
        vars: { yPercent: 0, opacity: 1, filter: "blur(0px)" },
        d: 1.1,
        ease: "power2.out",
        each: 1.3,
      },
    ],
    tail: 0.5,
  },
};

const slideReveal: Entry = {
  id: "slide-reveal",
  name: "Slide Reveal",
  category: "clean",
  family: "mask",
  tagline: "Wipe from the left",
  usesGlyphs: false,
  showCursor: false,
  description:
    "Each character is wiped in from its own left edge with a short horizontal lead, so the line assembles left to right without anything sliding across the stage.",
  spec: {
    steps: [
      {
        type: "set",
        target: "chars",
        vars: { clipPath: "inset(0% 100% 0% 0%)", xPercent: -22, opacity: 0 },
      },
      {
        type: "to",
        target: "chars",
        vars: { clipPath: "inset(0% 0% 0% 0%)", xPercent: 0, opacity: 1 },
        d: 0.72,
        ease: "power4.out",
        each: 0.85,
      },
    ],
    tail: 0.5,
  },
};

const focusIn: Entry = {
  id: "focus-in",
  name: "Focus In",
  category: "clean",
  family: "mask",
  tagline: "Whole line · pulls sharp",
  usesGlyphs: false,
  showCursor: false,
  description:
    "The entire line resolves at once out of an 18px defocus with a hair of scale. No stagger, no travel — a camera finding focus rather than type arriving.",
  spec: {
    steps: [
      {
        type: "set",
        target: "chars",
        vars: {
          filter: "blur(18px)",
          opacity: 0,
          scale: 1.04,
          transformOrigin: "50% 50%",
        },
      },
      {
        type: "to",
        target: "chars",
        vars: { filter: "blur(0px)", opacity: 1, scale: 1 },
        d: 1.4,
        ease: "power3.out",
        each: 0.12,
      },
    ],
    tail: 0.6,
  },
};

const lineMask: Entry = {
  id: "line-mask",
  name: "Line Mask",
  category: "clean",
  family: "mask",
  tagline: "One rise, no stagger",
  usesGlyphs: false,
  showCursor: false,
  description:
    "Every character rises out of its mask on exactly the same clock, so the line reads as a single block lifting into view. The most restrained template in the set, and the one that survives the longest phrases.",
  spec: {
    steps: [
      { type: "set", target: "chars", vars: { yPercent: 112 } },
      {
        type: "to",
        target: "chars",
        vars: { yPercent: 0 },
        d: 1.05,
        ease: "power4.out",
      },
      { type: "underlineSweep", d: 0.7, at: 0.24, hold: 1.05, ease: "power3.out" },
    ],
    tail: 0.6,
  },
};

/* ------------------------------------------------------------------ *
 * Cinematic
 * ------------------------------------------------------------------ */

const filmTitle: Entry = {
  id: "film-title",
  name: "Film Title",
  category: "cinematic",
  family: "mask",
  tagline: "Slow rise · tracking settles",
  usesGlyphs: false,
  showCursor: false,
  description:
    "A long, weighted rise where the letters also close a small tracking gap as they land. The settling tracking is what separates a title card from a web headline — the line tightens into its final measure instead of arriving at it.",
  spec: {
    steps: [
      { type: "set", target: "chars", vars: { yPercent: 100, opacity: 0 } },
      {
        type: "fromTo",
        target: "chars",
        start: { x: { fn: "spread", amount: 7 } },
        end: { x: 0 },
        d: 1.8,
        ease: "power4.out",
      },
      {
        type: "to",
        target: "chars",
        vars: { yPercent: 0, opacity: 1 },
        d: 1.6,
        ease: "power4.out",
        each: 1.6,
      },
      { type: "underlineSweep", d: 1.1, at: 0.5, hold: 1.6, ease: "power3.out" },
    ],
    tail: 0.8,
  },
};

const dramaticMask: Entry = {
  id: "dramatic-mask",
  name: "Dramatic Mask",
  category: "cinematic",
  family: "mask",
  tagline: "Bottom-up clip · heavy",
  usesGlyphs: false,
  showCursor: false,
  description:
    "Characters are clipped away from the top and uncovered upward while drifting a fifth of their height. Slow enough that the clip edge is visible as an edge, which is the whole effect.",
  spec: {
    steps: [
      {
        type: "set",
        target: "chars",
        vars: { clipPath: "inset(100% 0% 0% 0%)", yPercent: 22 },
      },
      {
        type: "to",
        target: "chars",
        vars: { clipPath: "inset(0% 0% 0% 0%)", yPercent: 0 },
        d: 1.25,
        ease: "power4.out",
        each: 1.8,
      },
    ],
    tail: 0.8,
  },
};

const lightSweep: Entry = {
  id: "light-sweep",
  name: "Light Sweep",
  category: "cinematic",
  family: "mask",
  tagline: "Gradient pass · letters behind",
  usesGlyphs: false,
  showCursor: false,
  description:
    "A gradient slab crosses each word and leaves the letters resolved behind it. Unlike Ribbon Wipe the slab is the palette gradient rather than a flat accent, and the type fades up under it instead of being knocked out.",
  spec: {
    steps: [
      { type: "set", target: "chars", vars: { opacity: 0, yPercent: 26 } },
      {
        type: "set",
        target: "flashes",
        vars: {
          opacity: 0.92,
          backgroundImage: "$gradient",
          clipPath: "inset(0% 100% 0% 0%)",
        },
      },
      {
        type: "to",
        target: "flashes",
        vars: { clipPath: "inset(0% 0% 0% 0%)" },
        d: 0.72,
        ease: "power3.inOut",
        each: 4,
      },
      {
        type: "to",
        target: "flashes",
        vars: { clipPath: "inset(0% 0% 0% 100%)" },
        d: 0.78,
        at: 0.44,
        ease: "power3.inOut",
        each: 4,
      },
      {
        type: "to",
        target: "chars",
        vars: { opacity: 1, yPercent: 0 },
        d: 0.9,
        at: 0.5,
        ease: "power3.out",
        each: 0.8,
      },
      { type: "set", target: "flashes", vars: { opacity: 0 }, at: 1.6 },
    ],
    tail: 0.7,
  },
};

const letterboxReveal: Entry = {
  id: "letterbox-reveal",
  name: "Letterbox Reveal",
  category: "cinematic",
  family: "mask",
  tagline: "Opens from the centre band",
  usesGlyphs: false,
  showCursor: false,
  description:
    "Each character opens out of a closed horizontal band, top and bottom edges retreating together. Slow, symmetrical, and the only template in the set whose reveal has no direction.",
  spec: {
    steps: [
      {
        type: "set",
        target: "chars",
        vars: { clipPath: "inset(50% 0% 50% 0%)", opacity: 0 },
      },
      {
        type: "to",
        target: "chars",
        vars: { clipPath: "inset(0% 0% 0% 0%)", opacity: 1 },
        d: 1.1,
        ease: "power3.inOut",
        each: 1.2,
      },
    ],
    tail: 0.7,
  },
};

/* ------------------------------------------------------------------ *
 * Tech
 * ------------------------------------------------------------------ */

const terminalType: Entry = {
  id: "terminal-type",
  name: "Terminal",
  category: "tech",
  family: "terminal",
  tagline: "Typewriter · block cursor",
  usesGlyphs: false,
  showCursor: true,
  description:
    "Characters appear one at a time with no transition at all, the way a terminal actually prints them, while a block cursor blinks on its own clock until the line finishes.",
  spec: {
    steps: [
      { type: "set", target: "chars", vars: { opacity: 0 } },
      { type: "set", target: "chars", vars: { opacity: 1 }, each: 1.7 },
      {
        type: "fromTo",
        target: "chars",
        start: { color: "$hot" },
        end: { color: "$ink" },
        d: 0.34,
        ease: "steps(2)",
        each: 1.7,
      },
      { type: "cursorBlink", beat: 0.24, span: 1.6 },
    ],
    tail: 0.6,
  },
};

const scanline: Entry = {
  id: "scanline",
  name: "Scanline",
  category: "tech",
  family: "mask",
  tagline: "Stepped bottom-up scan",
  usesGlyphs: false,
  showCursor: false,
  description:
    "The clip edge climbs each character in six discrete jumps rather than sliding, so the reveal reads as a CRT scan rather than a wipe. An accent slab strobes behind the word on the same clock.",
  spec: {
    steps: [
      { type: "set", target: "chars", vars: { clipPath: "inset(0% 0% 100% 0%)" } },
      {
        type: "set",
        target: "flashes",
        vars: { opacity: 0.32, clipPath: "inset(0% 0% 0% 0%)" },
      },
      {
        type: "to",
        target: "chars",
        vars: { clipPath: "inset(0% 0% 0% 0%)" },
        d: 0.62,
        ease: "steps(6)",
        each: 0.7,
      },
      {
        type: "to",
        target: "flashes",
        vars: { opacity: 0 },
        d: 0.5,
        at: 0.35,
        ease: "steps(4)",
        each: 2,
      },
      { type: "debris", stepped: true },
    ],
    tail: 0.5,
  },
};

const dataStream: Entry = {
  id: "data-stream",
  name: "Data Stream",
  category: "tech",
  family: "terminal",
  tagline: "Short scramble · drops in",
  usesGlyphs: true,
  showCursor: false,
  description:
    "A fast scramble resolves each slot while the box itself drops in from above the mask. Shorter and busier than Glyph Decode — built for a line that should feel like it is streaming rather than decrypting.",
  spec: {
    steps: [
      { type: "set", target: "chars", vars: { yPercent: -110 } },
      {
        type: "to",
        target: "chars",
        vars: { yPercent: 0 },
        d: 0.42,
        ease: "power3.out",
        each: 0.85,
      },
      { type: "scramble", d: 0.3, rate: 26, each: 0.85, color: "$hot" },
      { type: "debris", stepped: true },
    ],
    tail: 0.55,
  },
};

/* ------------------------------------------------------------------ *
 * Social
 * ------------------------------------------------------------------ */

const punchWords: Entry = {
  id: "punch-words",
  name: "Punch Words",
  category: "social",
  family: "mask",
  tagline: "Word by word · overshoot",
  usesGlyphs: false,
  showCursor: false,
  unmasked: true,
  description:
    "Scales whole words rather than characters, with a short overshoot on each. The unit is the word, which is what makes it read as emphasis instead of as an entrance.",
  spec: {
    steps: [
      {
        type: "set",
        target: "words",
        vars: { scale: 0.62, opacity: 0, transformOrigin: "50% 50%" },
      },
      {
        type: "to",
        target: "words",
        vars: { scale: 1, opacity: 1 },
        d: 0.52,
        ease: "back.out(2.4)",
        each: 3.2,
      },
    ],
    tail: 0.45,
  },
};

const popCaption: Entry = {
  id: "pop-caption",
  name: "Pop Caption",
  category: "social",
  family: "mask",
  tagline: "Rise · rotate · overshoot",
  usesGlyphs: false,
  showCursor: false,
  unmasked: true,
  description:
    "Characters pop up from below with a small counter-rotation and land past their mark before settling. Fast enough to survive a vertical crop at full speed.",
  spec: {
    steps: [
      {
        type: "set",
        target: "chars",
        vars: {
          yPercent: 110,
          scale: 0.72,
          opacity: 0,
          rotate: -7,
          transformOrigin: "50% 100%",
        },
      },
      {
        type: "to",
        target: "chars",
        vars: { yPercent: 0, scale: 1, opacity: 1, rotate: 0 },
        d: 0.6,
        ease: "back.out(1.9)",
        each: 0.9,
      },
    ],
    tail: 0.45,
  },
};

const bounceReveal: Entry = {
  id: "bounce-reveal",
  name: "Bounce Reveal",
  category: "social",
  family: "mask",
  tagline: "Drops in · settles",
  usesGlyphs: false,
  showCursor: false,
  unmasked: true,
  description:
    "Characters fall in from above and settle on a real bounce curve. Used sparingly it is the friendliest template here; used on a long phrase it is a lot, so keep the stagger tight.",
  spec: {
    steps: [
      { type: "set", target: "chars", vars: { yPercent: -130, opacity: 0 } },
      { type: "to", target: "chars", vars: { opacity: 1 }, d: 0.14, each: 0.7 },
      {
        type: "to",
        target: "chars",
        vars: { yPercent: 0 },
        d: 1,
        ease: "bounce.out",
        each: 0.7,
      },
    ],
    tail: 0.5,
  },
};

const zoomImpact: Entry = {
  id: "zoom-impact",
  name: "Zoom Impact",
  category: "social",
  family: "mask",
  tagline: "Slams in from oversize",
  usesGlyphs: false,
  showCursor: false,
  unmasked: true,
  description:
    "Characters arrive far oversize and out of focus and slam down to their final size on an expo curve. The blur is doing most of the work — without it the scale alone reads as a zoom rather than an impact.",
  spec: {
    steps: [
      {
        type: "set",
        target: "chars",
        vars: {
          scale: 2.6,
          opacity: 0,
          filter: "blur(10px)",
          transformOrigin: "50% 50%",
        },
      },
      {
        type: "to",
        target: "chars",
        vars: { scale: 1, opacity: 1, filter: "blur(0px)" },
        d: 0.78,
        ease: "expo.out",
        each: 0.4,
      },
    ],
    tail: 0.5,
  },
};

/* ------------------------------------------------------------------ *
 * Luxury
 * ------------------------------------------------------------------ */

const editorialReveal: Entry = {
  id: "editorial-reveal",
  name: "Editorial Reveal",
  category: "luxury",
  family: "mask",
  tagline: "Unhurried rise · rule",
  usesGlyphs: false,
  showCursor: false,
  description:
    "A slow, even rise with a gradient rule that draws under the line and retracts. Pair it with a serif and generous tracking; the pacing is the luxury signal, not the ornament.",
  spec: {
    steps: [
      { type: "set", target: "chars", vars: { yPercent: 106, opacity: 0 } },
      {
        type: "to",
        target: "chars",
        vars: { yPercent: 0, opacity: 1 },
        d: 1.35,
        ease: "power3.out",
        each: 1.4,
      },
      { type: "underlineSweep", d: 1.2, at: 0.6, hold: 1.5, ease: "power2.out" },
    ],
    tail: 0.9,
  },
};

const luxuryTracking: Entry = {
  id: "luxury-tracking",
  name: "Luxury Tracking",
  category: "luxury",
  family: "mask",
  tagline: "Letters draw together",
  usesGlyphs: false,
  showCursor: false,
  unmasked: true,
  description:
    "The line starts over-tracked and closes to its set measure as it fades up. The centre character barely moves and the ends travel furthest, which is what makes the phrase feel like it is composing itself.",
  spec: {
    steps: [
      {
        type: "fromTo",
        target: "chars",
        start: { x: { fn: "spread", amount: 13 }, opacity: 0 },
        end: { x: 0, opacity: 1 },
        d: 1.9,
        ease: "power3.out",
        each: 0.35,
      },
    ],
    tail: 0.9,
  },
};

const goldSweep: Entry = {
  id: "gold-sweep",
  name: "Gold Sweep",
  category: "luxury",
  family: "mask",
  tagline: "Gradient pass · warm settle",
  usesGlyphs: false,
  showCursor: false,
  description:
    "A slow gradient slab passes behind the words while the letters resolve from the palette's brightest tone into ink. Reads as foil catching light rather than as a highlight.",
  spec: {
    steps: [
      { type: "set", target: "chars", vars: { opacity: 0 } },
      {
        type: "set",
        target: "flashes",
        vars: {
          opacity: 0.75,
          backgroundImage: "$gradient",
          clipPath: "inset(0% 100% 0% 0%)",
        },
      },
      {
        type: "to",
        target: "flashes",
        vars: { clipPath: "inset(0% 0% 0% 0%)" },
        d: 1.05,
        ease: "power2.inOut",
        each: 3,
      },
      {
        type: "to",
        target: "flashes",
        vars: { clipPath: "inset(0% 0% 0% 100%)", opacity: 0 },
        d: 1.1,
        at: 0.7,
        ease: "power2.inOut",
        each: 3,
      },
      {
        type: "fromTo",
        target: "chars",
        start: { color: "$sun", opacity: 0 },
        end: { color: "$ink", opacity: 1 },
        d: 1.3,
        at: 0.55,
        ease: "power2.out",
        each: 0.9,
      },
    ],
    tail: 0.9,
  },
};

/* ------------------------------------------------------------------ *
 * Experimental
 * ------------------------------------------------------------------ */

const wave: Entry = {
  id: "wave",
  name: "Wave",
  category: "experimental",
  family: "mask",
  tagline: "Sine offset per index",
  usesGlyphs: false,
  showCursor: false,
  unmasked: true,
  description:
    "Every character starts at a point on a sine curve rather than on a straight line, so the phrase flows into place instead of marching. The frequency is deliberately low — high enough to read as a wave, low enough that the word stays legible mid-flight.",
  spec: {
    steps: [
      {
        type: "fromTo",
        target: "chars",
        start: {
          yPercent: { fn: "wave", amp: 78, freq: 0.85 },
          opacity: 0,
          transformOrigin: "50% 50%",
        },
        end: { yPercent: 0, opacity: 1 },
        d: 1.15,
        ease: "power3.out",
        each: 0.55,
      },
    ],
    tail: 0.6,
  },
};

const splitReveal: Entry = {
  id: "split-reveal",
  name: "Split Reveal",
  category: "experimental",
  family: "mask",
  tagline: "Alternating from above and below",
  usesGlyphs: false,
  showCursor: false,
  description:
    "Even characters rise from under their mask and odd ones drop from above it, meeting on the baseline. Because both directions are bounded by the same box, the line never looks like it is falling apart.",
  spec: {
    steps: [
      {
        type: "set",
        target: "chars",
        vars: { yPercent: { fn: "alternate", a: 112, b: -112 } },
      },
      {
        type: "to",
        target: "chars",
        vars: { yPercent: 0 },
        d: 0.88,
        ease: "power4.out",
        each: 0.7,
      },
    ],
    tail: 0.5,
  },
};

const particleAssemble: Entry = {
  id: "particle-assemble",
  name: "Particle Assemble",
  category: "experimental",
  family: "mask",
  tagline: "Seeded scatter · converges",
  usesGlyphs: false,
  showCursor: false,
  unmasked: true,
  description:
    "Characters converge on the line from a seeded scatter, each with its own offset, rotation and scale. The scatter comes from the same PRNG everything else here uses, so a replay reproduces it exactly rather than reshuffling.",
  spec: {
    steps: [
      {
        type: "fromTo",
        target: "chars",
        start: {
          x: { fn: "seeded", min: -70, max: 70, seed: 11 },
          y: { fn: "seeded", min: -70, max: 70, seed: 23 },
          rotate: { fn: "seeded", min: -42, max: 42, seed: 7 },
          scale: 0.55,
          opacity: 0,
          transformOrigin: "50% 50%",
        },
        end: { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 },
        d: 1.25,
        ease: "power3.out",
        each: 0.55,
        from: "random",
      },
    ],
    tail: 0.7,
  },
};

export const SPEC_TEMPLATES: readonly TemplateDefinition[] = [
  // Clean
  fadeUp,
  softReveal,
  slideReveal,
  focusIn,
  lineMask,
  // Cinematic
  filmTitle,
  dramaticMask,
  lightSweep,
  letterboxReveal,
  // Tech
  terminalType,
  scanline,
  dataStream,
  // Social
  punchWords,
  popCaption,
  bounceReveal,
  zoomImpact,
  // Luxury
  editorialReveal,
  luxuryTracking,
  goldSweep,
  // Experimental
  wave,
  splitReveal,
  particleAssemble,
] as const;
