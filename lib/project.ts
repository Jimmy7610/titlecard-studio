import { CANVAS_FORMATS } from "@/lib/canvas-formats";
import { dedupeFontRequests, type FontRequest } from "@/lib/fonts";
import type {
  BackgroundConfig,
  CanvasConfig,
  ColorConfig,
  MotionConfig,
  PositionConfig,
  ProjectState,
  TextLayer,
  TypographyConfig,
} from "@/lib/types";

/**
 * Bumped whenever a stored project changes shape.
 *
 * v3 split the one ambiguous format into a project document and a style preset,
 * and stopped storing every phrase twice. Both older versions still open — see
 * `lib/persistence/versions.ts`.
 */
export const SCHEMA_VERSION = 3 as const;

export const DEFAULT_POSITION: PositionConfig = { anchor: "center", x: 0, y: 0 };

export const DEFAULT_CANVAS: CanvasConfig = {
  formatId: CANVAS_FORMATS[0].id,
  width: CANVAS_FORMATS[0].width,
  height: CANVAS_FORMATS[0].height,
  safeZones: false,
};

export const DEFAULT_TYPOGRAPHY: TypographyConfig = {
  fontId: "outfit",
  fontSize: 11,
  tracking: -0.025,
  leading: 1.1,
  weight: 600,
  align: "center",
  transform: "none",
  italic: false,
  granularity: "char",
};

export const DEFAULT_MOTION: MotionConfig = {
  speed: 1,
  stagger: 0.045,
  delay: 0,
  easing: "template",
  loop: true,
  hold: 1.1,
};

export const DEFAULT_COLOR: ColorConfig = {
  mode: "palette",
  text: "#04152f",
  accent1: "#f2560a",
  accent2: "#f69625",
  accent3: "#ffc53d",
  gradientStart: "#f2560a",
  gradientEnd: "#ffc53d",
  gradientAngle: 96,
  glow: 0,
  glowColor: "#f2560a",
  shadow: 0,
  outline: 0,
  outlineColor: "#04152f",
  opacity: 1,
};

export const DEFAULT_BACKGROUND: BackgroundConfig = {
  mode: "solid",
  color: "#e7e7e7",
  gradientStart: "#101826",
  gradientEnd: "#050a12",
  gradientAngle: 160,
  animated: false,
  noise: 0,
  grain: 0,
  vignette: 0,
  glow: 0,
  grid: 0.35,
  imageUrl: "",
  imageFit: "cover",
};

let layerCounter = 0;

/** Ids only need to be unique within a project, and stable across a session. */
export function createLayerId(): string {
  layerCounter += 1;
  return `layer-${Date.now().toString(36)}-${layerCounter.toString(36)}`;
}

/**
 * `id` is deliberately not overridable, and is assigned last.
 *
 * Duplicating a layer means spreading the source into the overrides, and the
 * source carries an id — so an override that could win here handed the copy the
 * original's id. Two layers then shared one identity: React warned about the
 * duplicate key, editing one edited both, and deleting one deleted both.
 */
export function createLayer(overrides: Omit<Partial<TextLayer>, "id"> = {}): TextLayer {
  return {
    name: "Layer",
    text: "",
    templateId: "agent-reveal",
    glyphPool: "hex",
    delay: 0,
    position: { ...DEFAULT_POSITION },
    typography: {},
    wordStyles: {},
    visible: true,
    ...overrides,
    id: createLayerId(),
  };
}

export const DEFAULT_PROJECT: ProjectState = {
  schemaVersion: SCHEMA_VERSION,
  name: "Untitled",
  canvas: { ...DEFAULT_CANVAS },
  typography: { ...DEFAULT_TYPOGRAPHY },
  motion: { ...DEFAULT_MOTION },
  color: { ...DEFAULT_COLOR },
  background: { ...DEFAULT_BACKGROUND },
  paletteId: "agent",
  invertCanvas: false,
  layers: [
    {
      id: "layer-default",
      name: "Headline",
      text: "MOTION STUDIO",
      templateId: "agent-reveal",
      glyphPool: "hex",
      delay: 0,
      position: { ...DEFAULT_POSITION },
      typography: {},
      wordStyles: {},
      visible: true,
    },
  ],
  activeLayerId: "layer-default",
  semantic: { enabled: true, autoApply: false },
  gradientDigits: true,
  reducePreviewMotion: false,
};

/**
 * `leading` is free to go tight: the mask height is derived from the font's own
 * metrics, and lines are pulled together with a negative margin rather than by
 * shrinking the box the glyphs are clipped against.
 */
export const RANGES = {
  speed: { min: 0.25, max: 3, step: 0.05 },
  stagger: { min: 0.002, max: 0.2, step: 0.002 },
  delay: { min: 0, max: 3, step: 0.05 },
  hold: { min: 0, max: 4, step: 0.1 },
  fontSize: { min: 2, max: 22, step: 0.25 },
  tracking: { min: -0.08, max: 0.5, step: 0.005 },
  leading: { min: 0.75, max: 2.4, step: 0.05 },
  weight: { min: 100, max: 900, step: 100 },
  opacity: { min: 0.05, max: 1, step: 0.05 },
  glow: { min: 0, max: 0.6, step: 0.02 },
  shadow: { min: 0, max: 0.4, step: 0.02 },
  outline: { min: 0, max: 0.06, step: 0.002 },
  effect: { min: 0, max: 1, step: 0.05 },
  angle: { min: 0, max: 360, step: 1 },
  offset: { min: -50, max: 50, step: 0.5 },
  layerDelay: { min: 0, max: 6, step: 0.05 },
  wordScale: { min: 0.4, max: 2.4, step: 0.05 },
  wordDelay: { min: 0, max: 2, step: 0.05 },
} as const;

/** Starting points for the phrase field. Every template accepts any of them. */
export const PHRASE_PRESETS: readonly string[] = [
  "MOTION STUDIO",
  "Agent 3",
  "Build the system",
  "Breathe slow",
  "RÄKSMÖRGÅS",
  "Lansera framtiden",
  "Terminal boot",
  "Premium studio",
] as const;

/* ------------------------------------------------------------------ *
 * Derived helpers
 * ------------------------------------------------------------------ */

export function activeLayer(project: ProjectState): TextLayer {
  return (
    project.layers.find((layer) => layer.id === project.activeLayerId) ??
    project.layers[0] ??
    createLayer()
  );
}

export function visibleLayers(project: ProjectState): TextLayer[] {
  const layers = project.layers.filter(
    (layer) => layer.visible && layer.text.trim().length > 0,
  );
  return layers;
}

/** Typography for one layer, with the project defaults filled in. */
export function layerTypography(
  project: ProjectState,
  layer: TextLayer,
): TypographyConfig {
  const base = project.typography;
  const override = layer.typography;
  return {
    ...base,
    fontId: override.fontId ?? base.fontId,
    weight: override.weight ?? base.weight,
    tracking: override.tracking ?? base.tracking,
    transform: override.transform ?? base.transform,
    align: override.align ?? base.align,
    italic: override.italic ?? base.italic,
    fontSize: base.fontSize * (override.scale ?? 1),
  };
}

/**
 * Every *face* the project renders, deduplicated.
 *
 * Not every font id: a face is a family plus a weight plus a style, and the
 * timeline measures the box each one produces. Collecting ids alone meant a
 * layer overriding the weight or switching to italic was measured against
 * whatever variant the project default had already loaded.
 *
 * Layers are read through `layerTypography`, so an override wins over the
 * project default exactly the way it does when the layer renders.
 */
export function projectFontRequests(project: ProjectState): FontRequest[] {
  const requests: FontRequest[] = [
    {
      fontId: project.typography.fontId,
      weight: project.typography.weight,
      italic: project.typography.italic,
    },
  ];

  for (const layer of project.layers) {
    const typography = layerTypography(project, layer);
    requests.push({
      fontId: typography.fontId,
      weight: typography.weight,
      italic: typography.italic,
    });

    // A per-word weight renders in the same line as its neighbours, so it is a
    // face this project needs too.
    for (const style of Object.values(layer.wordStyles)) {
      if (typeof style?.weight === "number") {
        requests.push({
          fontId: typography.fontId,
          weight: style.weight,
          italic: typography.italic,
        });
      }
    }
  }

  return dedupeFontRequests(requests);
}

/** Every font family the project needs, deduplicated. */
export function projectFontIds(project: ProjectState): string[] {
  return [...new Set(projectFontRequests(project).map((request) => request.fontId))];
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
