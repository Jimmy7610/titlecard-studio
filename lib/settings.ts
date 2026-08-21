import type { GlyphPoolId } from "@/lib/glyphs";
import type { PaletteId } from "@/lib/palettes";
import type { TemplateId } from "@/lib/templates";

export type GeneratorSettings = {
  text: string;
  /** Manual choice. Overridden at render time when the semantic engine hits. */
  templateId: TemplateId;
  paletteId: PaletteId;
  glyphPool: GlyphPoolId;
  /** 1 = reference tempo. Higher is faster. */
  speed: number;
  /** Seconds between character reveals, before the speed multiplier. */
  stagger: number;
  /** Display size in `cqw` against the stage container. */
  fontSize: number;
  /** Letter-spacing in `em`. */
  tracking: number;
  /** Unitless line-height. Also the height of every word's mask box. */
  leading: number;
  weight: number;
  semantic: boolean;
  loop: boolean;
  invertCanvas: boolean;
};

export const DEFAULT_SETTINGS: GeneratorSettings = {
  text: "Agent 3",
  templateId: "agent-reveal",
  paletteId: "agent",
  glyphPool: "hex",
  speed: 1,
  stagger: 0.045,
  fontSize: 11,
  tracking: -0.025,
  leading: 1.1,
  weight: 600,
  semantic: true,
  loop: true,
  invertCanvas: false,
};

/**
 * `leading` is free to go tight: the mask height is pinned separately in CSS
 * (`--stw-mask`), and lines are pulled together with a negative margin rather
 * than by shrinking the box the glyphs are clipped against.
 */
export const RANGES = {
  speed: { min: 0.35, max: 2.2, step: 0.05 },
  stagger: { min: 0.005, max: 0.14, step: 0.005 },
  fontSize: { min: 4, max: 18, step: 0.5 },
  tracking: { min: -0.06, max: 0.32, step: 0.005 },
  leading: { min: 0.85, max: 2.2, step: 0.05 },
  weight: { min: 400, max: 700, step: 100 },
} as const;

/** Each preset lands on a different branch of the semantic lexicon. */
export const PHRASE_PRESETS: readonly string[] = [
  "Agent 3",
  "Premium studio",
  "Build the system",
  "Breathe slow",
  "Terminal boot",
  "Counter ticker",
  "Headline feature",
  "Weightless drift",
] as const;
