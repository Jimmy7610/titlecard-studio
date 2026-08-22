import type { TemplateId } from "@/lib/templates";
import type {
  BackgroundConfig,
  ColorConfig,
  MotionConfig,
  ProjectState,
  TypographyConfig,
} from "@/lib/types";
import type { PaletteId } from "@/lib/palettes";

/**
 * Complete looks.
 *
 * A preset is a *look*, never a document: it carries no phrase, no canvas size
 * and no per-word styling, so applying one to a headline someone spent ten
 * minutes writing cannot take the headline away. That constraint is what makes
 * them safe to click through.
 */

export type PresetDefinition = {
  id: string;
  name: string;
  note: string;
  group: "cinematic" | "brand" | "tech" | "minimal" | "social";
  templateId: TemplateId;
  paletteId: PaletteId;
  invertCanvas: boolean;
  typography: Partial<TypographyConfig>;
  motion: Partial<MotionConfig>;
  background: Partial<BackgroundConfig>;
  color?: Partial<ColorConfig>;
};

export const BUILTIN_PRESETS: readonly PresetDefinition[] = [
  {
    id: "cinematic-intro",
    name: "Cinematic Intro",
    note: "Slow rise, long settle, rule beneath",
    group: "cinematic",
    templateId: "film-title",
    paletteId: "mono",
    invertCanvas: true,
    typography: { fontId: "outfit", weight: 300, tracking: 0.16, transform: "uppercase" },
    motion: { speed: 0.62, stagger: 0.075, easing: "cinematic", hold: 1.6 },
    background: { mode: "solid", color: "#08090c", vignette: 0.5, grid: 0, glow: 0, grain: 0.1 },
  },
  {
    id: "luxury-brand",
    name: "Luxury Brand",
    note: "Didone serif, gold sweep, wide tracking",
    group: "brand",
    templateId: "gold-sweep",
    paletteId: "ember",
    invertCanvas: true,
    typography: { fontId: "playfair", weight: 500, tracking: 0.22, transform: "uppercase" },
    motion: { speed: 0.65, stagger: 0.085, easing: "cinematic", hold: 1.5 },
    background: { mode: "gradient", gradientStart: "#1a1005", gradientEnd: "#000000", gradientAngle: 165, vignette: 0.45, grid: 0, glow: 0.2, grain: 0.12 },
  },
  {
    id: "ai-terminal",
    name: "AI Terminal",
    note: "Monospace decode on phosphor green",
    group: "tech",
    templateId: "glyph-decode",
    paletteId: "terminal",
    invertCanvas: true,
    typography: { fontId: "jetbrains-mono", weight: 500, tracking: 0.05, transform: "uppercase" },
    motion: { speed: 1.1, stagger: 0.035, easing: "template", hold: 1.2 },
    background: { mode: "solid", color: "#04100a", vignette: 0.35, grid: 0.4, glow: 0.15, grain: 0.22 },
  },
  {
    id: "soft-minimal",
    name: "Soft Minimal",
    note: "Barely-there lift on paper white",
    group: "minimal",
    templateId: "soft-reveal",
    paletteId: "mono",
    invertCanvas: false,
    typography: { fontId: "manrope", weight: 400, tracking: 0.01, transform: "none" },
    motion: { speed: 0.85, stagger: 0.055, easing: "smooth", hold: 1.2 },
    background: { mode: "solid", color: "#f3f3f1", vignette: 0, grid: 0, glow: 0, grain: 0 },
  },
  {
    id: "cyber-decode",
    name: "Cyber Decode",
    note: "Magenta glitch, heavy grid",
    group: "tech",
    templateId: "glitch-mask",
    paletteId: "plasma",
    invertCanvas: true,
    typography: { fontId: "space-grotesk", weight: 700, tracking: -0.01, transform: "uppercase" },
    motion: { speed: 1.35, stagger: 0.028, easing: "template", hold: 0.9 },
    background: { mode: "solid", color: "#0d0618", vignette: 0.3, grid: 0.6, glow: 0.3, grain: 0.18 },
  },
  {
    id: "editorial",
    name: "Editorial",
    note: "Ribbon knockout, magazine weight",
    group: "brand",
    templateId: "ribbon-wipe",
    paletteId: "ember",
    invertCanvas: false,
    typography: { fontId: "archivo", weight: 800, tracking: -0.035, transform: "none" },
    motion: { speed: 1, stagger: 0.04, easing: "template", hold: 1.1 },
    background: { mode: "solid", color: "#efe7e4", vignette: 0, grid: 0, glow: 0, grain: 0 },
  },
  {
    id: "product-launch",
    name: "Product Launch",
    note: "The reference look, unchanged",
    group: "brand",
    templateId: "agent-reveal",
    paletteId: "agent",
    invertCanvas: false,
    typography: { fontId: "outfit", weight: 600, tracking: -0.025, transform: "none" },
    motion: { speed: 1, stagger: 0.045, easing: "template", hold: 1.1 },
    background: { mode: "solid", color: "#e7e7e7", vignette: 0, grid: 0.35, glow: 0, grain: 0 },
  },
  {
    id: "gaming-reveal",
    name: "Gaming Reveal",
    note: "Oversize slam, condensed poster face",
    group: "social",
    templateId: "zoom-impact",
    paletteId: "ember",
    invertCanvas: true,
    typography: { fontId: "anton", weight: 400, tracking: 0.01, transform: "uppercase" },
    motion: { speed: 1.45, stagger: 0.022, easing: "expo", hold: 0.8 },
    background: { mode: "gradient", gradientStart: "#2a0805", gradientEnd: "#080202", gradientAngle: 145, vignette: 0.4, grid: 0, glow: 0.45, grain: 0 },
  },
  {
    id: "calm-future",
    name: "Calm Future",
    note: "Letterbox open, cool and unhurried",
    group: "cinematic",
    templateId: "letterbox-reveal",
    paletteId: "ice",
    invertCanvas: true,
    typography: { fontId: "space-grotesk", weight: 400, tracking: 0.12, transform: "uppercase" },
    motion: { speed: 0.7, stagger: 0.07, easing: "cinematic", hold: 1.6 },
    background: { mode: "gradient", gradientStart: "#08202c", gradientEnd: "#020609", gradientAngle: 170, vignette: 0.42, grid: 0.2, glow: 0.3, grain: 0 },
  },
  {
    id: "creator-hook",
    name: "Creator Hook",
    note: "Word-level punch for vertical video",
    group: "social",
    templateId: "punch-words",
    paletteId: "plasma",
    invertCanvas: true,
    typography: { fontId: "montserrat", weight: 900, tracking: -0.02, transform: "uppercase" },
    motion: { speed: 1.5, stagger: 0.03, easing: "snappy", hold: 0.7 },
    background: { mode: "gradient", gradientStart: "#22063a", gradientEnd: "#07030f", gradientAngle: 150, vignette: 0.3, grid: 0, glow: 0.4, grain: 0 },
  },
  {
    id: "dark-technology",
    name: "Dark Technology",
    note: "Stepped scan on near-black",
    group: "tech",
    templateId: "scanline",
    paletteId: "ice",
    invertCanvas: true,
    typography: { fontId: "jetbrains-mono", weight: 400, tracking: 0.06, transform: "uppercase" },
    motion: { speed: 1.15, stagger: 0.04, easing: "template", hold: 1 },
    background: { mode: "solid", color: "#04121a", vignette: 0.4, grid: 0.5, glow: 0.2, grain: 0.15 },
  },
  {
    id: "neon-data",
    name: "Neon Data",
    note: "Streaming scramble with a glow bed",
    group: "tech",
    templateId: "data-stream",
    paletteId: "plasma",
    invertCanvas: true,
    typography: { fontId: "jetbrains-mono", weight: 600, tracking: 0.04, transform: "uppercase" },
    motion: { speed: 1.25, stagger: 0.032, easing: "template", hold: 0.9 },
    background: { mode: "solid", color: "#0b0416", vignette: 0.35, grid: 0.35, glow: 0.5, grain: 0.12 },
  },
  {
    id: "minimal-white",
    name: "Minimal White",
    note: "One rise, no stagger, nothing else",
    group: "minimal",
    templateId: "line-mask",
    paletteId: "mono",
    invertCanvas: false,
    typography: { fontId: "inter", weight: 500, tracking: -0.02, transform: "none" },
    motion: { speed: 0.95, stagger: 0.04, easing: "smooth", hold: 1.3 },
    background: { mode: "solid", color: "#ffffff", vignette: 0, grid: 0, glow: 0, grain: 0 },
  },
  {
    id: "ice-future",
    name: "Ice Future",
    note: "Wide tracking closing on cyan",
    group: "cinematic",
    templateId: "luxury-tracking",
    paletteId: "ice",
    invertCanvas: true,
    typography: { fontId: "outfit", weight: 200, tracking: 0.24, transform: "uppercase" },
    motion: { speed: 0.6, stagger: 0.05, easing: "cinematic", hold: 1.8 },
    background: { mode: "gradient", gradientStart: "#0a2330", gradientEnd: "#01060a", gradientAngle: 175, vignette: 0.5, grid: 0, glow: 0.35, grain: 0.08 },
  },
] as const;

/**
 * Folds a preset into a project.
 *
 * The phrase, the canvas, the layer structure and every per-word style survive
 * untouched — only the look changes.
 */
export function applyPreset(project: ProjectState, preset: PresetDefinition): ProjectState {
  return {
    ...project,
    paletteId: preset.paletteId,
    invertCanvas: preset.invertCanvas,
    typography: { ...project.typography, ...preset.typography },
    motion: { ...project.motion, ...preset.motion },
    background: { ...project.background, ...preset.background },
    // A preset expresses itself through the ramp, so custom overrides step
    // aside unless the preset explicitly sets them.
    color: { ...project.color, mode: "palette", ...preset.color },
    layers: project.layers.map((layer) =>
      layer.id === project.activeLayerId ? { ...layer, templateId: preset.templateId } : layer,
    ),
  };
}

export function getPreset(id: string): PresetDefinition | null {
  return BUILTIN_PRESETS.find((preset) => preset.id === id) ?? null;
}
