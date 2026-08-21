import { DEBRIS } from "@/lib/debris";
import { getGlyphPool } from "@/lib/glyphs";
import { gradientOf, getPalette } from "@/lib/palettes";
import { splitText } from "@/lib/split";
import type { GeneratorSettings } from "@/lib/settings";
import { getTemplate, type TemplateId } from "@/lib/templates";

export type ExportKind = "timeline" | "html" | "react" | "preset";

/**
 * The CDN build the standalone export loads. Must match the `gsap` version in
 * package.json — previewing on one version and shipping another is how a
 * generator quietly lies. `scripts/check-exports.ts` asserts they agree.
 */
export const GSAP_CDN_VERSION = "3.15.0";

type Resolved = {
  settings: GeneratorSettings;
  templateId: TemplateId;
  phrase: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ------------------------------------------------------------------ *
 * Shared source fragments
 *
 * The CSS below is deliberately a copy of the `.stw-*` rules in
 * app/globals.css rather than an import: an exported file has to stand on
 * its own with no build step, and globals.css cannot be read from TypeScript.
 * Keep the two in step when the split primitives change.
 * ------------------------------------------------------------------ */

function splitCss(settings: GeneratorSettings): string {
  const palette = getPalette(settings.paletteId);
  const tones = settings.invertCanvas ? palette.dark : palette.light;

  return `/* Custom properties only. Put this on the element that wraps the
   headline — it adds no layout of its own. Override any of them from
   your own stylesheet to rebrand without regenerating. */
.stw-scope {
  --stw-hot: ${palette.hot};
  --stw-warm: ${palette.warm};
  --stw-sun: ${palette.sun};
  --stw-gradient: ${gradientOf(palette)};
  --stage-bg: ${tones.bg};
  --stage-ink: ${tones.ink};

  --stw-tracking: ${settings.tracking}em;
  --stw-leading: ${settings.leading};
  --stw-weight: ${settings.weight};
  /* Mask height is pinned to the font's content area, independent of
     leading, so descenders survive however tight the lines are set. */
  --stw-mask: 1.25;

  color: var(--stage-ink);
  container-type: inline-size;
}

/* Demo framing only. The component root does NOT carry this — dropping a
   100vh full-bleed background into someone's hero is not a component. */
.stw-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--stage-bg);
}

/* Held back until the timeline's initial state is committed, so the
   finished headline is never painted before the animation takes over. */
.stw-visual { visibility: hidden; }
[data-stw-ready="true"] .stw-visual { visibility: visible; }

/* Local copy — do not rely on Tailwind's .sr-only being present. */
.stw-sr {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.stw {
  display: block;
  font-family: Outfit, system-ui, -apple-system, sans-serif;
  font-size: clamp(1.75rem, ${settings.fontSize}cqw, 13rem);
  font-weight: var(--stw-weight);
  line-height: var(--stw-leading);
  letter-spacing: var(--stw-tracking);
  position: relative;
}

/* The mask box is --stw-mask em tall, so a character at translateY(110%)
   always clears it. Lines are pulled together with a negative margin --
   an inline-block contributes its margin box to the line box height --
   rather than by shrinking the box the glyphs are clipped against. */
.stw-word {
  position: relative;
  display: inline-block;
  overflow: hidden;
  vertical-align: top;
  line-height: var(--stw-mask);
  margin-bottom: calc((var(--stw-leading) - var(--stw-mask)) * 1em);
  padding-right: max(0em, calc(-1 * var(--stw-tracking)));
}

.stw-space { display: inline-block; white-space: pre; }

.stw-flash {
  position: absolute;
  inset: 0.12em 0 0.26em;
  z-index: 0;
  display: block;
  background: var(--stw-hot);
  opacity: 0;
  pointer-events: none;
}

.stw-char {
  position: relative;
  z-index: 1;
  display: inline-block;
  vertical-align: top;
  line-height: inherit;
  transform-origin: 0% 100%;
  backface-visibility: hidden;
  will-change: transform, opacity, filter, clip-path;
}

.stw-real { display: block; }

/* Absolutely positioned, so a wide substituted glyph can never change the
   slot's advance width during a decode. */
.stw-glyph {
  position: absolute;
  inset: 0;
  line-height: inherit;
  text-align: center;
  opacity: 0;
  pointer-events: none;
}

.stw-char[data-gradient="true"] .stw-real,
.stw-char[data-gradient="true"] .stw-glyph {
  background-image: var(--stw-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
}

.stw-cursor {
  display: inline-block;
  width: 0.46em;
  height: 0.68em;
  margin-left: 0.14em;
  background: var(--stw-hot);
  vertical-align: baseline;
  opacity: 0;
}

.stw-underline {
  position: absolute;
  right: 0;
  bottom: 0.17em;
  left: 0;
  height: 0.055em;
  border-radius: 999px;
  background-image: var(--stw-gradient);
  transform: scaleX(0);
  transform-origin: 0% 50%;
  pointer-events: none;
}

.stw-debris {
  position: absolute;
  display: block;
  border-radius: 1px;
  opacity: 0;
  pointer-events: none;
}`;
}

/** The split markup, matching what SplitText renders. */
function splitMarkup(phrase: string, showCursor: boolean, indent: string): string {
  const { words } = splitText(phrase);
  const pad = (depth: number) => indent + "  ".repeat(depth);

  const body = words
    .map((word, index) => {
      const chars = word.characters
        .map(
          (character) =>
            `${pad(2)}<span class="stw-char"${
              character.isGradient ? ' data-gradient="true"' : ""
            }><span class="stw-glyph"></span><span class="stw-real">${escapeHtml(
              character.char,
            )}</span></span>`,
        )
        .join("\n");

      const space =
        index < words.length - 1
          ? `\n${pad(1)}<span class="stw-space"> </span>`
          : "";

      return `${pad(1)}<span class="stw-word">\n${pad(
        2,
      )}<span class="stw-flash"></span>\n${chars}\n${pad(1)}</span>${space}`;
    })
    .join("\n");

  const cursor = showCursor ? `\n${pad(1)}<span class="stw-cursor"></span>` : "";
  const debris = DEBRIS.map(
    (particle) =>
      `${pad(1)}<span class="stw-debris" style="left:${particle.left}%;top:${
        particle.top
      }%;width:${particle.size}em;height:${particle.size}em;background:var(--stw-${
        particle.tone === "sun" ? "sun" : particle.tone
      })"></span>`,
  ).join("\n");

  return `${indent}<span class="stw">
${pad(1)}<span class="stw-sr">${escapeHtml(phrase)}</span>
${pad(1)}<span class="stw-visual" aria-hidden="true">
${body}${cursor}
${pad(2)}<span class="stw-underline"></span>
${debris}
${pad(1)}</span>
${indent}</span>`;
}

/** Resolves the DOM into the shape every generated timeline expects. */
function runtimePrelude(settings: GeneratorSettings): string {
  const palette = getPalette(settings.paletteId);
  const tones = settings.invertCanvas ? palette.dark : palette.light;
  const pool = getGlyphPool(settings.glyphPool).chars;

  return `const SPEED = ${settings.speed};
const STAGGER = ${settings.stagger};

const INK = "${tones.ink}";
const CANVAS = "${tones.bg}";
const HOT = "${palette.hot}";
const WARM = "${palette.warm}";
const POOL = [...${JSON.stringify(pool)}];

const units = [...root.querySelectorAll("[data-stw-char], .stw-char")].map((el) => ({
  el,
  glyph: el.querySelector(".stw-glyph"),
  real: el.querySelector(".stw-real"),
  isGradient: el.dataset.gradient === "true",
}));

const chars = units.map((u) => u.el);
const glyphs = units.map((u) => u.glyph);
const reals = units.map((u) => u.real);
const plain = units.filter((u) => !u.isGradient).map((u) => u.el);
const gradient = units.filter((u) => u.isGradient).map((u) => u.el);

const words = [...root.querySelectorAll(".stw-word")].map((el) => ({
  el,
  flash: el.querySelector(".stw-flash"),
  chars: [...el.querySelectorAll(".stw-char")],
}));

const underline = root.querySelector(".stw-underline");
const cursor = root.querySelector(".stw-cursor");
const debris = [...root.querySelectorAll(".stw-debris")];

// Seeded PRNG — keeps every replay byte-identical to the preview.
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let r = Math.imul(state ^ (state >>> 15), 1 | state);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function glyphSequence(length, seed) {
  const next = rng(seed * 2246822519 + 17);
  let previous = -1;
  return Array.from({ length }, () => {
    let pick = Math.floor(next() * POOL.length);
    if (pick === previous) pick = (pick + 1) % POOL.length;
    previous = pick;
    return POOL[pick];
  });
}

CustomEase.create("agentReveal", "M0,0 C0.16,1 0.3,1 1,1");
CustomEase.create("agentSweep", "M0,0 C0.7,0 0.14,1 1,1");
CustomEase.create("weightless", "M0,0 C0.05,0.72 0.12,1 1,1");

const tl = gsap.timeline({
  paused: true,
  repeat: ${settings.loop ? -1 : 0},
  repeatDelay: ${settings.loop ? 1.1 : 0},
});`;
}

/**
 * Runs after the template has populated `tl`. Handles the three things every
 * export needs and none of the template code owns: the motion preference, the
 * flash-of-finished-text gate, and starting playback.
 */
const RUNTIME_EPILOGUE = `

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  // Commit the resting frame rather than playing a shortened version.
  tl.kill();
  gsap.set(chars, { clearProps: "all" });
  gsap.set(reals, { opacity: 1, yPercent: 0 });
  gsap.set(glyphs, { opacity: 0 });
  gsap.set([...debris, underline, cursor].filter(Boolean), { opacity: 0 });
} else {
  // pause(0) renders the initial state synchronously, so revealing the text
  // on the next line cannot expose the finished headline.
  tl.pause(0);
  tl.play();
}

root.dataset.stwReady = "true";`;

const DEBRIS_SOURCE = `
tl.fromTo(debris, { opacity: 0, scale: 0.5 }, {
  opacity: 1, scale: 1, duration: 0.075 / SPEED, ease: "steps(1)",
  repeat: 3, yoyo: true, stagger: { each: 0.03, from: "random" },
}, 0)
  .to(debris, {
    opacity: 0, scale: 0.35, duration: 0.32 / SPEED, ease: "power2.in",
    stagger: { each: 0.02, from: "random" },
  }, 0.55 / SPEED);`;

const TIMELINE_SOURCE: Record<TemplateId, string> = {
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
  yPercent: 0, rotate: 0, duration: REVEAL, ease: "agentReveal",
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
    yPercent: 0, rotate: 0, duration: REVEAL * 1.05, ease: "agentReveal",
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
  duration: DURATION, ease: "weightless",
  stagger: { each: EACH, from: "start" },
}, 0);

if (gradient.length) {
  tl.to(gradient, {
    yPercent: 0, opacity: 1, scale: 1, filter: "blur(0px)",
    duration: DURATION * 1.15, ease: "weightless",
    stagger: { each: EACH * 1.2, from: "start" },
  }, EACH * plain.length + 0.1);
}`,

  "glitch-mask": `const DURATION = 0.66 / SPEED;
const EACH = (STAGGER * 1.15) / SPEED;

// Seeded inset() slabs converging on a fully visible glyph.
function glitchFrames(index) {
  const next = rng(index * 2654435761 + 101);
  const frames = [];
  for (let step = 0; step < 4; step += 1) {
    const top = Math.round(next() * 52);
    const bottom = Math.round(next() * (90 - top));
    const left = Math.round(next() * 38);
    const right = Math.round(next() * (86 - left));
    frames.push(\`inset(\${top}% \${right}% \${bottom}% \${left}%)\`);
  }
  frames.push("inset(0% 0% 0% 0%)");
  return frames;
}

function glitchOffset(index) {
  return Math.round((rng(index * 40503 + 7)() * 2 - 1) * 3);
}

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
    keyframes: { clipPath: glitchFrames(index), easeEach: "steps(1)" },
    duration: DURATION, ease: "none",
  }, at);

  tl.fromTo(unit.el, { x: glitchOffset(index) }, { x: 0, duration: DURATION, ease: "steps(3)" }, at);

  if (!unit.isGradient) {
    tl.fromTo(unit.el, { color: WARM },
      { color: INK, duration: DURATION * 1.15, ease: "steps(4)" }, at);
  }
});

tl.to(underline, { scaleX: 1, duration: DURATION * 0.9, ease: "steps(6)" }, 0.04)
  .set(underline, { transformOrigin: "100% 50%" }, DURATION * 1.5)
  .to(underline, { scaleX: 0, duration: DURATION * 0.8, ease: "steps(5)" }, DURATION * 1.5);
${DEBRIS_SOURCE}`,

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
    duration: SWEEP * 0.85, ease: "power3.inOut",
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
  .to(cursor, { opacity: 0, duration: 0.22 / SPEED, ease: "power2.out" }, span + 0.1);`,

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
      { yPercent: 0, duration: LAND, ease: "agentReveal" }, landsAt);

  if (!unit.isGradient) {
    tl.fromTo(unit.real, { color: HOT },
      { color: INK, duration: LAND * 0.9, ease: "power2.out" }, landsAt);
  }
});`,
};

/* ------------------------------------------------------------------ *
 * Generators
 * ------------------------------------------------------------------ */

/** The GSAP timeline for the current settings, ready to paste. */
export function timelineSource({ settings, templateId }: Resolved): string {
  const template = getTemplate(templateId);

  return `// ${template.name} — ${template.tagline}
// Expects the split markup from this generator, with \`root\` scoping the query.
// Requires: gsap, gsap/CustomEase.

${runtimePrelude(settings)}

${TIMELINE_SOURCE[templateId]}
${RUNTIME_EPILOGUE}
`;
}

export function standaloneHtml(resolved: Resolved): string {
  const { settings, templateId, phrase } = resolved;
  const template = getTemplate(templateId);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(phrase)} — ${template.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

${splitCss(settings)}
</style>
</head>
<body>

<div class="stw-scope stw-stage" id="stage">
${splitMarkup(phrase, template.showCursor, "  ")}
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/${GSAP_CDN_VERSION}/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/${GSAP_CDN_VERSION}/CustomEase.min.js"></script>
<script>
gsap.registerPlugin(CustomEase);

const root = document.getElementById("stage");

${runtimePrelude(settings)}

${TIMELINE_SOURCE[templateId]}
${RUNTIME_EPILOGUE}
</script>

</body>
</html>
`;
}

export function reactComponent(resolved: Resolved): string {
  const { settings, templateId, phrase } = resolved;
  const template = getTemplate(templateId);

  // The prelude declares `words` (DOM nodes). The component already has a
  // `words` of its own (the split data), so the React side is renamed rather
  // than the prelude — keeping the prelude byte-identical across all exports
  // is what makes them verifiable together.
  const indented = (source: string) =>
    source
      .split("\n")
      .map((line) => (line ? `      ${line}` : ""))
      .join("\n");

  return `"use client";

// ${template.name} — ${template.tagline}
// Generated by titlecard — https://github.com/opensverige/titlecard
//
//   npm i gsap @gsap/react
//
// The word span carries overflow: hidden and is exactly --stw-mask em tall,
// so a character at translateY(110%) clears its own mask completely. Leading
// is applied as a negative margin instead, so pulling lines tight never
// shrinks the box the glyphs are clipped against.
//
// TO REBRAND: every colour is a custom property on .stw-scope. Override them
// from your own stylesheet — you do not need to regenerate this file:
//
//   .stw-scope { --stw-hot: var(--brand-500); --stage-ink: var(--fg); }
//
// TO CHANGE FONT: set --stw-font, and raise --stw-mask until the descenders
// of your typeface survive at rest (it is the height of the clip box, in em).

import * as React from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(useGSAP, CustomEase);

const PHRASE = ${JSON.stringify(phrase)};

const DEBRIS = ${JSON.stringify(
    DEBRIS.map((d) => ({ l: d.left, t: d.top, s: d.size, c: d.tone })),
  )};

const CSS = \`${splitCss(settings).replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\`;

function split(text: string) {
  const source = text.replace(/\\s+/g, " ").trim().split(" ");
  const last = Array.from(source[source.length - 1] ?? "");
  let gradientStart = last.length;
  while (gradientStart > 0 && /[0-9]/.test(last[gradientStart - 1])) gradientStart -= 1;

  return source.map((word, wordIndex) => ({
    word,
    characters: Array.from(word).map((char, charIndex) => ({
      char,
      isGradient: wordIndex === source.length - 1 && charIndex >= gradientStart,
    })),
  }));
}

export function AnimatedHeadline({ text = PHRASE }: { text?: string }) {
  const scope = React.useRef<HTMLDivElement>(null);
  const splitWords = React.useMemo(() => split(text), [text]);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

${indented(runtimePrelude(settings))}

${indented(TIMELINE_SOURCE[templateId])}

${indented(RUNTIME_EPILOGUE)}
    },
    { scope, revertOnUpdate: true, dependencies: [text] },
  );

  return (
    <div ref={scope} className="stw-scope">
      <style>{CSS}</style>
      <span className="stw">
        <span className="stw-sr">{text}</span>
        <span className="stw-visual" aria-hidden="true">
          {splitWords.map((entry, wordIndex) => (
            <React.Fragment key={wordIndex}>
              <span className="stw-word">
                <span className="stw-flash" />
                {entry.characters.map((character, charIndex) => (
                  <span
                    key={charIndex}
                    className="stw-char"
                    data-gradient={character.isGradient ? "true" : undefined}
                  >
                    <span className="stw-glyph" />
                    <span className="stw-real">{character.char}</span>
                  </span>
                ))}
              </span>
              {wordIndex < splitWords.length - 1 ? (
                <span className="stw-space"> </span>
              ) : null}
            </React.Fragment>
          ))}
${template.showCursor ? '          <span className="stw-cursor" />\n' : ""}          <span className="stw-underline" />
          {DEBRIS.map((particle, index) => (
            <span
              key={index}
              className="stw-debris"
              style={{
                left: \`\${particle.l}%\`,
                top: \`\${particle.t}%\`,
                width: \`\${particle.s}em\`,
                height: \`\${particle.s}em\`,
                background: \`var(--stw-\${particle.c})\`,
              }}
            />
          ))}
        </span>
      </span>
    </div>
  );
}
`;
}

export function presetJson({ settings, templateId, phrase }: Resolved): string {
  return `${JSON.stringify(
    {
      $schema: "titlecard/preset@1",
      phrase,
      template: templateId,
      palette: settings.paletteId,
      glyphPool: settings.glyphPool,
      motion: {
        speed: settings.speed,
        stagger: settings.stagger,
        loop: settings.loop,
      },
      type: {
        fontSize: settings.fontSize,
        tracking: settings.tracking,
        leading: settings.leading,
        weight: settings.weight,
      },
      canvas: settings.invertCanvas ? "dark" : "light",
    },
    null,
    2,
  )}\n`;
}

/** Slug used for downloaded filenames. */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "animation"
  );
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
