import type { Granularity } from "@/lib/segment";
import type { GlyphPoolId } from "@/lib/glyphs";
import type { PaletteId } from "@/lib/palettes";
import type { TemplateId } from "@/lib/templates";

export type TextTransform = "none" | "uppercase" | "lowercase";
export type TextAlign = "left" | "center" | "right";

/** Nine-point anchor, plus a free offset in percent of the canvas. */
export type PositionAnchor =
  | "top-left" | "top" | "top-right"
  | "left" | "center" | "right"
  | "bottom-left" | "bottom" | "bottom-right";

export type PositionConfig = {
  anchor: PositionAnchor;
  /** Offset from the anchor, in percent of canvas width / height. */
  x: number;
  y: number;
};

/* ------------------------------------------------------------------ *
 * Canvas
 * ------------------------------------------------------------------ */

export type CanvasConfig = {
  /** Id from lib/canvas-formats, or "custom". */
  formatId: string;
  width: number;
  height: number;
  /** Editing guides for social crops. Never exported. */
  safeZones: boolean;
};

/* ------------------------------------------------------------------ *
 * Typography
 * ------------------------------------------------------------------ */

export type TypographyConfig = {
  /** Id from lib/fonts, or `custom:<name>` for an uploaded face. */
  fontId: string;
  /** Display size in `cqw` against the canvas container. */
  fontSize: number;
  /** Letter-spacing in `em`. */
  tracking: number;
  /** Unitless line-height. The mask height is derived per font, not from this. */
  leading: number;
  weight: number;
  align: TextAlign;
  transform: TextTransform;
  italic: boolean;
  /** What a single animated box holds. Clamped upward for complex scripts. */
  granularity: Granularity;
};

/* ------------------------------------------------------------------ *
 * Motion
 * ------------------------------------------------------------------ */

export type EasingId =
  | "smooth" | "cinematic" | "snappy" | "elastic"
  | "linear" | "power" | "expo" | "template";

export type MotionConfig = {
  /** 1 = reference tempo. Higher is faster. */
  speed: number;
  /** Seconds between neighbouring units, before the speed multiplier. */
  stagger: number;
  /** Seconds of dead air before the first unit moves. */
  delay: number;
  /** `"template"` keeps whatever curve the template was authored with. */
  easing: EasingId;
  loop: boolean;
  /** Seconds held on the resting frame before a loop restarts. */
  hold: number;
};

/* ------------------------------------------------------------------ *
 * Colour
 * ------------------------------------------------------------------ */

export type ColorConfig = {
  /** `"palette"` follows the selected ramp; `"custom"` uses the fields below. */
  mode: "palette" | "custom";
  text: string;
  accent1: string;
  accent2: string;
  accent3: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  /** 0 disables. Blur radius in `em`. */
  glow: number;
  glowColor: string;
  shadow: number;
  outline: number;
  outlineColor: string;
  /** Text opacity, 0–1. */
  opacity: number;
};

/* ------------------------------------------------------------------ *
 * Background
 * ------------------------------------------------------------------ */

export type BackgroundMode = "solid" | "gradient" | "transparent" | "image";

export type BackgroundConfig = {
  mode: BackgroundMode;
  color: string;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  /** Slow hue drift on the gradient. Costs a compositor layer, so opt-in. */
  animated: boolean;
  /** Optional layers, 0–1 each. 0 means the layer is not rendered at all. */
  noise: number;
  grain: number;
  vignette: number;
  glow: number;
  grid: number;
  /** Data URL or remote URL. Only used when `mode === "image"`. */
  imageUrl: string;
  imageFit: "cover" | "contain";
};

/* ------------------------------------------------------------------ *
 * Word-level styling
 * ------------------------------------------------------------------ */

export type WordEmphasis = "none" | "pop" | "delay" | "lead";

export type WordStyle = {
  color?: string;
  gradient?: boolean;
  weight?: number;
  /** Multiplier on the display size. */
  scale?: number;
  glow?: number;
  opacity?: number;
  /** Extra seconds before this word's units move. */
  delay?: number;
  emphasis?: WordEmphasis;
};

/* ------------------------------------------------------------------ *
 * Layers
 * ------------------------------------------------------------------ */

export type LayerTypography = Partial<
  Pick<TypographyConfig, "fontId" | "weight" | "tracking" | "transform" | "align" | "italic">
> & {
  /** Multiplier on the project display size. */
  scale?: number;
};

export type TextLayer = {
  id: string;
  name: string;
  text: string;
  templateId: TemplateId;
  glyphPool: GlyphPoolId;
  /** Seconds after the master timeline starts. */
  delay: number;
  position: PositionConfig;
  typography: LayerTypography;
  /** Keyed by word index across the layer's phrase. */
  wordStyles: Record<number, WordStyle>;
  visible: boolean;
};

/* ------------------------------------------------------------------ *
 * Project
 * ------------------------------------------------------------------ */

export type SemanticConfig = {
  /** Show suggestions at all. Never changes the template on its own. */
  enabled: boolean;
  /** Opt-in: apply a suggestion the moment it changes. Off by default. */
  autoApply: boolean;
};

export type ProjectState = {
  schemaVersion: 2;
  name: string;
  canvas: CanvasConfig;
  typography: TypographyConfig;
  motion: MotionConfig;
  color: ColorConfig;
  background: BackgroundConfig;
  paletteId: PaletteId;
  /** Swaps to the palette's dark canvas tones. */
  invertCanvas: boolean;
  layers: TextLayer[];
  activeLayerId: string;
  semantic: SemanticConfig;
  /** Trailing digits of the final word take the gradient treatment. */
  gradientDigits: boolean;
  /** Editor-only: damp the preview for motion-sensitive users. */
  reducePreviewMotion: boolean;
};

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

export type ExportKind =
  | "html" | "react" | "preset" | "timeline"
  | "webm" | "frames" | "gif";

export type VideoExportConfig = {
  width: number;
  height: number;
  fps: number;
  /** Seconds. Clamped against a hard ceiling to keep the tab responsive. */
  duration: number;
  /** Only honoured by formats that carry alpha. */
  transparent: boolean;
  /** Extra passes appended after the first, for loop-friendly clips. */
  loops: number;
};
