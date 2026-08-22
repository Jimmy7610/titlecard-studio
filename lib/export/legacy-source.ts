import { LEGACY_MAIN_EASE } from "@/lib/templates/legacy";
import type { TemplateId } from "@/lib/templates";

/**
 * Hand-written GSAP source for the six original templates.
 *
 * Everything added since is a `MotionSpec` and gets its source printed by
 * `lib/animation/emit`. These six predate that and keep their own copy, so
 * their exported output is what it has always been rather than a re-derivation
 * that might round a number differently.
 *
 * `__EASE__` is the one substitution: the Motion panel's easing control swaps
 * the template's primary curve, and the export has to say the same thing the
 * preview is doing. Stepped and linear curves carry no placeholder — replacing
 * `steps(1)` with an elastic ease turns a decode into a wobble.
 */

const DEBRIS_SOURCE = `
tl.fromTo(debris, { opacity: 0, scale: 0.5 }, {
  opacity: 1, scale: 1, duration: 0.075 / SPEED, ease: "steps(1)",
  repeat: 3, yoyo: true, stagger: { each: 0.03, from: "random" },
}, 0)
  .to(debris, {
    opacity: 0, scale: 0.35, duration: 0.32 / SPEED, ease: "power2.in",
    stagger: { each: 0.02, from: "random" },
  }, 0.55 / SPEED);`;

const STEPPED_DEBRIS_SOURCE = `
tl.fromTo(debris, { opacity: 0, scale: 0.5 }, {
  opacity: 1, scale: 1, duration: 0.06 / SPEED, ease: "steps(1)",
  repeat: 5, yoyo: true, stagger: { each: 0.022, from: "random" },
}, 0)
  .to(debris, {
    opacity: 0, scale: 0.35, duration: 0.32 / SPEED, ease: "steps(3)",
    stagger: { each: 0.02, from: "random" },
  }, 0.55 / SPEED);`;

const SOURCES: Partial<Record<TemplateId, string>> = {
  "agent-reveal": `const REVEAL = 1.05 / SPEED;
const EACH = STAGGER / SPEED;

tl.set(chars, { yPercent: 110, rotate: 5, transformOrigin: "0% 100%" }, 0);

// An accent slab wipes across each word just ahead of its letters.
words.forEach((word, index) => {
  const at = index * EACH * 2.2;
  tl.fromTo(word.flash,
    { opacity: 0, clipPath: "inset(0% 100% 0% 0%)" },
    { opacity: 0.9, clipPath: "inset(0% 0% 0% 0%)", duration: REVEAL * 0.34, ease: "agentSweep" }, at)
    .to(word.flash,
      { opacity: 0, clipPath: "inset(0% 0% 0% 100%)", duration: REVEAL * 0.45, ease: "agentSweep" },
      at + REVEAL * 0.3);
});

tl.to(plain, {
  yPercent: 0, rotate: 0, duration: REVEAL, ease: "__EASE__",
  stagger: { each: EACH, from: "start" },
}, 0);

tl.fromTo(plain, { color: HOT }, {
  color: INK, duration: REVEAL * 0.9, ease: "power2.out",
  stagger: { each: EACH, from: "start" },
}, 0.05);

// The gradient tail lands last and slightly heavier.
if (gradient.length) {
  const at = EACH * plain.length + 0.16;
  tl.to(gradient, {
    yPercent: 0, rotate: 0, duration: REVEAL * 1.05, ease: "__EASE__",
    stagger: { each: EACH * 1.4, from: "start" },
  }, at)
    .fromTo(gradient, { scale: 1.09 }, {
      scale: 1, duration: REVEAL * 1.1, ease: "power3.out",
      stagger: { each: EACH * 1.4, from: "start" },
    }, at);
}

const hold = 0.06 + REVEAL * 0.62 + 0.1;
tl.to(underline, { scaleX: 1, duration: REVEAL * 0.62, ease: "power3.out" }, 0.06)
  .set(underline, { transformOrigin: "100% 50%" }, hold)
  .to(underline, { scaleX: 0, duration: REVEAL * 0.52, ease: "power3.inOut" }, hold);
${DEBRIS_SOURCE}`,

  "weightless-blur": `const DURATION = 1.55 / SPEED;
const EACH = (STAGGER * 1.6) / SPEED;

tl.set(chars, {
  yPercent: 60, opacity: 0, scale: 1.03,
  filter: "blur(11px)", transformOrigin: "50% 100%",
}, 0);

tl.to(plain, {
  yPercent: 0, opacity: 1, scale: 1, filter: "blur(0px)",
  duration: DURATION, ease: "__EASE__",
  stagger: { each: EACH, from: "start" },
}, 0);

if (gradient.length) {
  tl.to(gradient, {
    yPercent: 0, opacity: 1, scale: 1, filter: "blur(0px)",
    duration: DURATION * 1.15, ease: "__EASE__",
    stagger: { each: EACH * 1.2, from: "start" },
  }, EACH * plain.length + 0.1);
}`,

  "glitch-mask": `const DURATION = 0.66 / SPEED;
const EACH = (STAGGER * 1.15) / SPEED;

tl.set(chars, { clipPath: "inset(100% 0% 0% 0%)", transformOrigin: "50% 50%" }, 0);

words.forEach((word, index) => {
  tl.to(word.flash, {
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
    duration: DURATION * 1.2,
    ease: "none",
  }, index * EACH * 1.6);
});

units.forEach((unit, index) => {
  const at = index * EACH;

  tl.to(unit.el, {
    keyframes: { clipPath: glitchFramesFor(index), easeEach: "steps(1)" },
    duration: DURATION, ease: "none",
  }, at);

  tl.fromTo(unit.el, { x: glitchOffsetFor(index) }, { x: 0, duration: DURATION, ease: "steps(3)" }, at);

  if (!unit.isGradient) {
    tl.fromTo(unit.el, { color: WARM },
      { color: INK, duration: DURATION * 1.15, ease: "steps(4)" }, at);
  }
});

tl.to(underline, { scaleX: 1, duration: DURATION * 0.9, ease: "steps(6)" }, 0.04)
  .set(underline, { transformOrigin: "100% 50%" }, DURATION * 1.5)
  .to(underline, { scaleX: 0, duration: DURATION * 0.8, ease: "steps(5)" }, DURATION * 1.5);
${STEPPED_DEBRIS_SOURCE}`,

  "ribbon-wipe": `const SWEEP = 0.62 / SPEED;
const GAP = SWEEP * 0.45;

tl.set(chars, { clipPath: "inset(0% 100% 0% 0%)" }, 0);

words.forEach((word, index) => {
  const at = index * GAP;

  // Explicit set: a property present only in from-vars has no tween holding it.
  tl.set(word.flash, { opacity: 1, clipPath: "inset(0% 100% 0% 0%)" }, at)
    .to(word.flash, { clipPath: "inset(0% 0% 0% 0%)", duration: SWEEP, ease: "power3.inOut" }, at)
    .to(word.flash,
      { clipPath: "inset(0% 0% 0% 100%)", duration: SWEEP, ease: "power3.inOut" },
      at + SWEEP * 0.6)
    .set(word.flash, { opacity: 0 }, at + SWEEP * 1.6);

  tl.to(word.chars, {
    clipPath: "inset(0% 0% 0% 0%)",
    duration: SWEEP * 0.85, ease: "__EASE__",
    stagger: { each: STAGGER / SPEED / 2, from: "start" },
  }, at + SWEEP * 0.22);

  // Knockout: canvas-coloured under the ribbon, ink once it clears.
  const wordPlain = word.chars.filter((el) => el.dataset.gradient !== "true");
  if (wordPlain.length) {
    tl.fromTo(wordPlain, { color: CANVAS },
      { color: INK, duration: SWEEP * 0.9, ease: "power2.out" }, at + SWEEP * 0.62);
  }
});

const total = words.length * GAP + SWEEP;
tl.to(underline, { scaleX: 1, duration: SWEEP * 0.8, ease: "power3.out" }, SWEEP * 0.2)
  .set(underline, { transformOrigin: "100% 50%" }, total)
  .to(underline, { scaleX: 0, duration: SWEEP * 0.7, ease: "power3.inOut" }, total);`,

  "glyph-decode": `const CYCLE = 0.52 / SPEED;
const EACH = (STAGGER * 1.3) / SPEED;
const RATE = 22; // glyph swaps per second

tl.set(glyphs, { opacity: 1, color: HOT }, 0);
tl.set(reals, { opacity: 0 }, 0);

units.forEach((unit, index) => {
  const at = index * EACH;
  const steps = Math.max(3, Math.round(CYCLE * RATE));
  const sequence = glyphSequence(steps, index + 1);
  const driver = { progress: 0 };

  // Deriving the glyph from tween progress — rather than picking one inside
  // onUpdate — makes the decode a pure function of timeline position, so
  // scrubbing backwards or restarting reproduces it exactly.
  tl.fromTo(driver, { progress: 0 }, {
    progress: 1, duration: CYCLE, ease: "none",
    onUpdate: () => {
      unit.glyph.textContent = sequence[Math.min(steps - 1, Math.floor(driver.progress * steps))];
    },
  }, at);

  tl.set(unit.glyph, { opacity: 0 }, at + CYCLE)
    .set(unit.real, { opacity: 1 }, at + CYCLE);

  if (!unit.isGradient) {
    tl.fromTo(unit.real, { color: WARM },
      { color: INK, duration: CYCLE * 1.1, ease: "steps(3)" }, at + CYCLE);
  }
});

// Block cursor blinks until the last slot resolves.
const span = units.length * EACH + CYCLE;
const beat = 0.26 / SPEED;
tl.set(cursor, { opacity: 1 }, 0)
  .to(cursor, {
    opacity: 0, duration: beat, ease: "steps(1)",
    repeat: Math.max(1, Math.ceil(span / beat) - 1), yoyo: true,
  }, 0)
  .to(cursor, { opacity: 0, duration: 0.22 / SPEED, ease: "power2.out" }, span + 0.1);
${STEPPED_DEBRIS_SOURCE}`,

  "odometer-roll": `const REELS = 5;
const STEP = 0.085 / SPEED;
const EACH = (STAGGER * 1.5) / SPEED;
const LAND = 0.5 / SPEED;

tl.set(glyphs, { opacity: 1, color: WARM }, 0);
tl.set(reals, { opacity: 0, yPercent: -100 }, 0);

units.forEach((unit, index) => {
  const at = index * EACH;
  const sequence = glyphSequence(REELS, index + 5);
  const setY = gsap.quickSetter(unit.glyph, "yPercent"); // no unit: yPercent takes a bare number
  const driver = { position: 0 };

  // One driver produces both the reel offset and the glyph on screen, so the
  // roll stays in sync however the timeline is scrubbed. The word's mask box
  // is what clips the reel top and bottom.
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
      { yPercent: 0, duration: LAND, ease: "__EASE__" }, landsAt);

  if (!unit.isGradient) {
    tl.fromTo(unit.real, { color: HOT },
      { color: INK, duration: LAND * 0.9, ease: "power2.out" }, landsAt);
  }
});`,
};

export function hasLegacySource(id: TemplateId): boolean {
  return SOURCES[id] !== undefined;
}

/** The template's source with the easing override folded in. */
export function legacySource(id: TemplateId, easeOverride: string | null): string | null {
  const source = SOURCES[id];
  if (!source) return null;

  const authored = LEGACY_MAIN_EASE[id] ?? "power2.out";
  const structural = authored === "none" || authored.startsWith("steps");
  const ease = structural || !easeOverride ? authored : easeOverride;

  return source.replaceAll("__EASE__", ease);
}
