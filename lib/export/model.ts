import type { UnitMeta } from "@/lib/animation/timing";
import { resolveEase } from "@/lib/easing";
import { resolveFont, type ResolvedFont } from "@/lib/fonts";
import { layerTypography, visibleLayers } from "@/lib/project";
import { splitText, type SplitTextResult } from "@/lib/split";
import { getTemplate, type TemplateDefinition } from "@/lib/templates";
import { resolveTheme, type ResolvedTheme } from "@/lib/theme";
import type { ProjectState, TextLayer, TypographyConfig, WordStyle } from "@/lib/types";

/**
 * Everything an exporter needs, computed once.
 *
 * The preview, the HTML export, the React export, the clipboard timeline and
 * the video recorder all start from this, so "what the user is looking at" and
 * "what came out of the export" are the same object read twice.
 */

export type LayerModel = {
  index: number;
  layer: TextLayer;
  typography: TypographyConfig;
  font: ResolvedFont;
  split: SplitTextResult;
  template: TemplateDefinition;
  units: UnitMeta[];
  /** Extra seconds per word index, from per-word emphasis. */
  wordDelays: Record<number, number>;
  /** Start of this layer on the master timeline, in seconds. */
  at: number;
};

export type ExportModel = {
  project: ProjectState;
  theme: ResolvedTheme;
  layers: LayerModel[];
  fonts: ResolvedFont[];
  /** Resolved ease, or `null` to keep each template's authored curve. */
  easeOverride: string | null;
  /** Things the user must know about this export before shipping it. */
  warnings: string[];
};

/** Extra delay a word's emphasis buys it. */
export function wordDelayFor(style: WordStyle | undefined): number {
  if (!style) return 0;
  const base = style.delay ?? 0;
  if (style.emphasis === "delay") return base + 0.28;
  return base;
}

export function unitMetas(split: SplitTextResult): UnitMeta[] {
  return split.words.flatMap((word) =>
    word.characters.map((character) => ({
      index: character.globalIndex,
      wordIndex: word.index,
      isGradient: character.isGradient,
    })),
  );
}

export function buildLayerModel(
  project: ProjectState,
  layer: TextLayer,
  index: number,
): LayerModel {
  const typography = layerTypography(project, layer);
  const split = splitText(layer.text, {
    granularity: typography.granularity,
    gradientDigits: project.gradientDigits,
    transform: typography.transform,
  });

  const wordDelays: Record<number, number> = {};
  for (const [key, style] of Object.entries(layer.wordStyles)) {
    const delay = wordDelayFor(style);
    if (delay) wordDelays[Number(key)] = delay;
  }

  return {
    index,
    layer,
    typography,
    font: resolveFont(typography.fontId),
    split,
    template: getTemplate(layer.templateId),
    units: unitMetas(split),
    wordDelays,
    at: project.motion.delay + layer.delay,
  };
}

export function buildExportModel(project: ProjectState): ExportModel {
  const layers = visibleLayers(project).map((layer, index) =>
    buildLayerModel(project, layer, index),
  );

  const fonts: ResolvedFont[] = [];
  for (const layer of layers) {
    if (!fonts.some((font) => font.id === layer.font.id)) fonts.push(layer.font);
  }

  const warnings: string[] = [];
  for (const layer of layers) {
    if (layer.split.downgraded) {
      warnings.push(
        `"${layer.layer.name}" uses a script that cannot be split per character — it animates per word instead.`,
      );
    }

    // An uploaded family only renders the weights that were uploaded. Asking
    // for one it does not have gets a browser-synthesised approximation, which
    // the raster exporters cannot reproduce.
    const { font, typography } = layer;
    if (font.custom && font.weights.length && !font.weights.includes(typography.weight)) {
      warnings.push(
        `"${font.name}" has no ${typography.weight} weight uploaded — the browser is synthesising it. Upload that weight for an exact export.`,
      );
    }
    if (font.custom && typography.italic && !font.italic) {
      warnings.push(
        `"${font.name}" has no italic uploaded — the browser is slanting the upright face.`,
      );
    }
  }

  return {
    project,
    theme: resolveTheme(project),
    layers,
    fonts,
    easeOverride:
      project.motion.easing === "template" ? null : resolveEase(project.motion.easing, ""),
    warnings,
  };
}

/** Longest a layer can run, used to size the master timeline conservatively. */
export function estimatedDuration(model: ExportModel): number {
  const { motion } = model.project;
  return model.layers.reduce((longest, layer) => {
    const units = Math.max(1, layer.units.length);
    const span = (units * motion.stagger * 2 + 2.2) / motion.speed + layer.at;
    return Math.max(longest, span);
  }, 1);
}
