import { CUSTOM_FONT_PREFIX } from "@/lib/fonts";
import { backgroundSizes, NOISE_DATA_URI } from "@/lib/theme";
import type { ExportModel, LayerModel } from "@/lib/export/model";
import type { PositionAnchor, TextAlign } from "@/lib/types";

/**
 * The `.stw-*` primitives.
 *
 * This string is the *only* copy. The editor injects it into the stage and
 * every export inlines it, so the drift the previous build warned about — a
 * hand-kept duplicate of the rules in globals.css — cannot happen: there is
 * nothing to keep in step.
 */
export const SPLIT_PRIMITIVES_CSS = `
/* ------------------------------------------------------------------
   Scope and canvas
   ------------------------------------------------------------------ */

.stw-scope {
  color: var(--stage-ink);
}

.stw-canvas {
  position: relative;
  width: 100%;
  aspect-ratio: var(--stw-aspect, 16 / 9);
  overflow: hidden;
  container-type: inline-size;
  background: var(--stw-canvas-bg, transparent);
  background-size: var(--stw-canvas-size, 100% 100%);
}

/* Film grain is its own overlay rather than a background layer: CSS has no
   per-layer opacity, and folding a tiled noise bitmap into the paint stack
   would tint the canvas instead of sitting on top of it. */
.stw-grain {
  position: absolute;
  inset: 0;
  z-index: 2;
  background-image: ${NOISE_DATA_URI};
  background-size: 140px 140px;
  opacity: var(--stw-grain, 0);
  mix-blend-mode: overlay;
  pointer-events: none;
}

.stw-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  padding: 4% 6%;
  align-items: var(--stw-anchor-y, center);
  justify-content: var(--stw-anchor-x, center);
  pointer-events: none;
}

.stw-layer > * {
  transform: translate(var(--stw-offset-x, 0%), var(--stw-offset-y, 0%));
}

/* ------------------------------------------------------------------
   Split primitives

   Mask height and line spacing are deliberately two different things.

   The word box is exactly one line box tall at line-height: normal — the
   font's own content area — so a descender always survives the overflow
   clip and a character parked at translateY(110%) always clears the box,
   whatever face is loaded. Deriving it from the font instead of pinning a
   constant is what makes the animation font-independent.

   Leading is applied as a negative margin instead. An inline-block
   contributes its *margin* box to the line box, so lines can pull tighter
   than the mask is tall without shrinking the box the glyphs are clipped
   against.
   ------------------------------------------------------------------ */

.stw {
  display: block;
  font-family: var(--stw-font, system-ui, sans-serif);
  font-size: var(--stw-size, 4rem);
  font-weight: var(--stw-weight, 600);
  font-style: var(--stw-style, normal);
  line-height: var(--stw-leading, 1.1);
  letter-spacing: var(--stw-tracking, -0.025em);
  text-align: var(--stw-align, center);
  text-shadow: var(--stw-shadow, none);
  position: relative;
}

.stw-visual {
  /* Held back until the timeline's initial state is committed, so the
     finished text is never painted before the animation takes over. */
  visibility: hidden;
  opacity: var(--stw-text-opacity, 1);
}

[data-stw-ready="true"] .stw-visual {
  visibility: visible;
}

/* Local copy — an export cannot rely on a utility class being present. */
.stw-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.stw-line {
  display: block;
}

.stw-word {
  position: relative;
  display: inline-block;
  overflow: hidden;
  vertical-align: top;
  line-height: normal;
  margin-bottom: calc(var(--stw-leading, 1.1) * 1em - 1lh);
  /* Negative tracking shortens the final glyph's advance, which the mask
     would otherwise clip. Give the box that width back. */
  padding-right: max(0em, calc(-1 * var(--stw-tracking, -0.025em)));
}

/* Browsers without the lh unit fall back to a fixed multiple. It is the
   old, font-dependent behaviour, kept only so those engines still render
   something rather than clipping every descender. */
@supports not (margin-bottom: 1lh) {
  .stw-word {
    line-height: var(--stw-mask, 1.32);
    margin-bottom: calc((var(--stw-leading, 1.1) - var(--stw-mask, 1.32)) * 1em);
  }
}

/* A few templates are about oversize scale or a seeded scatter. The mask
   does not bound those, it amputates them, so they opt out explicitly. */
.stw[data-overflow="visible"] .stw-word {
  overflow: visible;
}

.stw-space {
  display: inline-block;
  white-space: pre;
}

.stw-flash {
  position: absolute;
  /* Hugs the cap-height-to-baseline band instead of the full line box, so
     the slab reads as a block behind the glyphs rather than a rectangle
     floating around them. */
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

.stw-real {
  display: block;
}

/* Absolutely positioned, so however wide a substituted glyph is it cannot
   change the slot's advance width — .stw-real below holds the layout for
   the entire decode. */
.stw-glyph {
  position: absolute;
  inset: 0;
  line-height: inherit;
  text-align: center;
  opacity: 0;
  pointer-events: none;
}

/* Applied to the leaves rather than the character box: background-clip
   does not reach an absolutely positioned descendant, so the overlay
   needs its own gradient to survive a decode. */
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
  pointer-events: none;
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
}

.stw-debris[data-tone="hot"] { background: var(--stw-hot); }
.stw-debris[data-tone="warm"] { background: var(--stw-warm); }
.stw-debris[data-tone="sun"] { background: var(--stw-sun); }
`.trim();

/** Slow hue drift for an animated gradient background. */
export const ANIMATED_BACKGROUND_CSS = `
@keyframes stw-drift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.stw-canvas[data-animated="true"] {
  background-size: 190% 190%;
  animation: stw-drift 18s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .stw-canvas[data-animated="true"] { animation: none; }
}
`.trim();

const ANCHOR_X: Record<PositionAnchor, string> = {
  "top-left": "flex-start", left: "flex-start", "bottom-left": "flex-start",
  top: "center", center: "center", bottom: "center",
  "top-right": "flex-end", right: "flex-end", "bottom-right": "flex-end",
};

const ANCHOR_Y: Record<PositionAnchor, string> = {
  "top-left": "flex-start", top: "flex-start", "top-right": "flex-start",
  left: "center", center: "center", right: "center",
  "bottom-left": "flex-end", bottom: "flex-end", "bottom-right": "flex-end",
};

const ALIGN: Record<TextAlign, string> = {
  left: "left",
  center: "center",
  right: "right",
};

/** Custom properties for one layer's positioning and typography. */
export function layerVars(layer: LayerModel): Record<string, string> {
  const { typography, layer: source, font } = layer;

  return {
    "--stw-anchor-x": ANCHOR_X[source.position.anchor],
    "--stw-anchor-y": ANCHOR_Y[source.position.anchor],
    "--stw-offset-x": `${source.position.x}%`,
    "--stw-offset-y": `${source.position.y}%`,
    "--stw-font": font.stack,
    "--stw-size": `clamp(0.75rem, ${typography.fontSize}cqw, 40rem)`,
    "--stw-weight": String(typography.weight),
    "--stw-style": typography.italic ? "italic" : "normal",
    "--stw-tracking": `${typography.tracking}em`,
    "--stw-leading": String(typography.leading),
    "--stw-align": ALIGN[typography.align],
  };
}

/** Custom properties for the whole scope: palette, background, effects. */
export function scopeVars(model: ExportModel): Record<string, string> {
  const { theme, project } = model;
  const vars: Record<string, string> = {
    ...theme.vars,
    "--stw-aspect": `${project.canvas.width} / ${project.canvas.height}`,
    "--stw-canvas-bg": theme.transparent ? "transparent" : theme.backgroundLayers.join(", "),
    "--stw-canvas-size": backgroundSizes(project.background).join(", "),
    "--stw-grain": String(theme.grain),
    "--stw-shadow": theme.textShadow,
  };
  delete vars["--stage-bg"];
  return vars;
}

/** Serialises a custom-property bag as a CSS declaration block body. */
export function declarations(vars: Record<string, string>, indent = "  "): string {
  return Object.entries(vars)
    .map(([key, value]) => `${indent}${key}: ${value};`)
    .join("\n");
}

/** `@font-face` rules for any uploaded face, so an export stands alone. */
export function embeddedFontFaces(model: ExportModel): string {
  return model.fonts
    .filter((font) => font.custom !== null)
    .map(
      (font) => `@font-face {
  font-family: "${font.family}";
  src: url(${font.custom!.dataUrl}) format("${font.custom!.format}");
  font-display: swap;
}`,
    )
    .join("\n\n");
}

/** Google Fonts stylesheet links for the built-in faces this project uses. */
export function googleFontIds(model: ExportModel): string[] {
  return model.fonts
    .filter((font) => font.custom === null && !font.id.startsWith(CUSTOM_FONT_PREFIX))
    .map((font) => font.id);
}

/** The text-stroke declaration, or an empty string when the outline is off. */
export function strokeCss(model: ExportModel): string {
  if (model.theme.textStroke === "none") return "";
  return `.stw { -webkit-text-stroke: ${model.theme.textStroke}; paint-order: stroke fill; }`;
}
