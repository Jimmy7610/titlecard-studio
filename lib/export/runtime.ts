import { getGlyphPool } from "@/lib/glyphs";
import type { ExportModel, LayerModel } from "@/lib/export/model";

/**
 * The JavaScript every generated file carries.
 *
 * Three pieces: a document-level header (plugin registration and the custom
 * eases), one prelude per layer that resolves the DOM into the shape the
 * timeline code expects, and an epilogue that owns the three things no template
 * owns — the motion preference, the flash-of-finished-text gate, and playback.
 */

/**
 * The CDN build the standalone export loads. Must match the `gsap` version in
 * package.json — previewing on one version and shipping another is how a
 * generator quietly lies. `scripts/check-exports.ts` asserts they agree.
 */
export const GSAP_CDN_VERSION = "3.15.0";

export const RUNTIME_HEADER = `CustomEase.create("agentReveal", "M0,0 C0.16,1 0.3,1 1,1");
CustomEase.create("agentSweep", "M0,0 C0.7,0 0.14,1 1,1");
CustomEase.create("weightless", "M0,0 C0.05,0.72 0.12,1 1,1");`;

/**
 * Resolves one layer's DOM into the bindings every timeline body relies on.
 *
 * `typed` adds TypeScript annotations. The React export drops this source into
 * a `.tsx` file that a strict project will compile, and an untyped `function
 * rng(seed)` is an error there — while the same annotation would be a syntax
 * error in the standalone page's plain `<script>`. One generator, two targets.
 */
export function runtimePrelude(
  model: ExportModel,
  layer: LayerModel,
  typed = false,
): string {
  const { theme, project } = model;
  const pool = getGlyphPool(layer.layer.glyphPool).chars;

  const n = typed ? ": number" : "";
  const el = typed ? "<HTMLElement>" : "";
  // Non-null assertions: the markup this queries is generated right above it,
  // so the nodes are guaranteed present in a way TypeScript cannot see.
  const nn = typed ? "!" : "";

  return `const SPEED = ${project.motion.speed};
const STAGGER = ${project.motion.stagger};

const INK = ${JSON.stringify(theme.ink)};
const CANVAS = ${JSON.stringify(theme.canvas)};
const HOT = ${JSON.stringify(theme.hot)};
const WARM = ${JSON.stringify(theme.warm)};
const SUN = ${JSON.stringify(theme.sun)};
const GRADIENT = ${JSON.stringify(theme.gradient)};
const POOL = [...${JSON.stringify(pool)}];

const units = [...root.querySelectorAll${el}(".stw-char")].map((el) => ({
  el,
  glyph: el.querySelector${el}(".stw-glyph")${nn},
  real: el.querySelector${el}(".stw-real")${nn},
  isGradient: el.dataset.gradient === "true",
}));

const chars = units.map((u) => u.el);
const glyphs = units.map((u) => u.glyph);
const reals = units.map((u) => u.real);
const plain = units.filter((u) => !u.isGradient).map((u) => u.el);
const gradient = units.filter((u) => u.isGradient).map((u) => u.el);

const words = [...root.querySelectorAll${el}(".stw-word")].map((el) => ({
  el,
  flash: el.querySelector${el}(".stw-flash"),
  chars: [...el.querySelectorAll${el}(".stw-char")],
}));
const wordEls = words.map((w) => w.el);
const flashes = words.map((w) => w.flash).filter(Boolean);

const underline = root.querySelector${el}(".stw-underline");
const cursor = root.querySelector${el}(".stw-cursor");
const debris = [...root.querySelectorAll${el}(".stw-debris")];

// Seeded PRNG — keeps every replay byte-identical to the preview.
function rng(seed${n}) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let r = Math.imul(state ^ (state >>> 15), 1 | state);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function glyphSequence(length${n}, seed${n}) {
  const next = rng(seed * 2246822519 + 17);
  let previous = -1;
  return Array.from({ length }, () => {
    let pick = Math.floor(next() * POOL.length);
    if (pick === previous) pick = (pick + 1) % POOL.length;
    previous = pick;
    return POOL[pick];
  });
}

// Seeded inset() slabs converging on a fully visible glyph.
function glitchFramesFor(index${n}) {
  const next = rng(index * 2654435761 + 101);
  const frames${typed ? ": string[]" : ""} = [];
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

function glitchOffsetFor(index${n}, amount${typed ? "?: number" : ""}) {
  return Math.round((rng(index * 40503 + 7)() * 2 - 1) * (amount || 3));
}

const tl = gsap.timeline();`;
}

/**
 * Runs after every layer timeline is on the master.
 *
 * `pause(0)` renders the initial state synchronously, so revealing the text on
 * the next line cannot expose the finished headline for a frame.
 */
export function runtimeEpilogue(model: ExportModel, typed = false): string {
  const { motion } = model.project;
  const el = typed ? "<HTMLElement>" : "";

  return `
const scopes = [...container.querySelectorAll${el}("[data-stw-scope]")];

if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  // Commit the resting frame rather than playing a shortened version.
  master.kill();
  gsap.set([...container.querySelectorAll(".stw-char")], { clearProps: "all" });
  gsap.set([...container.querySelectorAll(".stw-real")], { opacity: 1, yPercent: 0 });
  gsap.set([...container.querySelectorAll(".stw-glyph")], { opacity: 0 });
  gsap.set(
    [...container.querySelectorAll(".stw-debris, .stw-underline, .stw-cursor")],
    { opacity: 0 },
  );
} else {
  master.pause(0);
  master.play();
}

for (const scope of scopes) scope.dataset.stwReady = "true";
${motion.loop ? "" : "// Loop is off: the timeline holds its resting frame when it ends.\n"}`;
}

/** Creates the master timeline and hangs every layer off it. */
export function masterSource(model: ExportModel, selector: string, typed = false): string {
  void typed;
  const { motion } = model.project;
  const lines = model.layers.map(
    (layer) =>
      `master.add(buildLayer${layer.index}((${selector})('[data-stw-layer="${layer.index}"]')), ${layer.at.toFixed(
        3,
      )});`,
  );

  return `const master = gsap.timeline({
  paused: true,
  repeat: ${motion.loop ? -1 : 0},
  repeatDelay: ${motion.loop ? motion.hold : 0},
});

${lines.join("\n")}`;
}
