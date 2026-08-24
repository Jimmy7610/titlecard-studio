import { PALETTES, type PaletteId } from "@/lib/palettes";
import {
  bagAt,
  bool,
  isBag,
  num,
  oneOf,
  readBackground,
  readColor,
  readMotion,
  readTypography,
  str,
  type Bag,
} from "@/lib/persistence/readers";
import { detectVersion, migrateV1Preset, PersistenceError } from "@/lib/persistence/versions";
import { DEFAULT_PROJECT, RANGES } from "@/lib/project";
import { GLYPH_POOLS } from "@/lib/glyphs";
import { hasTemplate, type TemplateId } from "@/lib/templates";
import type { GlyphPoolId } from "@/lib/glyphs";
import type {
  BackgroundConfig,
  ColorConfig,
  MotionConfig,
  ProjectState,
  TypographyConfig,
} from "@/lib/types";

/**
 * A look, and nothing else.
 *
 * This is the half of the old preset format that was safe to apply to someone
 * else's work: palette, type, motion, background, and the template that carries
 * them. It carries no phrase, no canvas size, no layer structure and no
 * per-word styling, so clicking through looks cannot take away a headline
 * somebody spent ten minutes writing.
 *
 * The old format tried to be this *and* a whole project *and* the session
 * blob, which is why it ended up storing every phrase twice — once under
 * `text.layers[]` and once under `layers[].text` — and needed an
 * `as unknown as` to make the two agree. A project is a different document and
 * lives in `project-file.ts`.
 */

export const STYLE_PRESET_VERSION = 3 as const;
export const STYLE_PRESET_SCHEMA_ID = `titlecard/style-preset@${STYLE_PRESET_VERSION}`;
export const STYLE_PRESET_EXTENSION = ".titlecard-look.json";

export type StylePreset = {
  name: string;
  templateId: TemplateId;
  glyphPool: GlyphPoolId;
  paletteId: PaletteId;
  invertCanvas: boolean;
  gradientDigits: boolean;
  typography: TypographyConfig;
  motion: MotionConfig;
  color: ColorConfig;
  background: BackgroundConfig;
};

export type StylePresetFile = StylePreset & {
  $schema: string;
  schemaVersion: number;
};

export type ParsedStylePreset = {
  preset: StylePreset;
  warnings: string[];
  /** The schema the file was written against. */
  sourceVersion: number;
  /**
   * Phrases an older file carried.
   *
   * v1 and v2 files stored the words alongside the look. Applying a look must
   * never replace them, so they are handed back separately and only used when
   * the user explicitly asks.
   */
  texts: string[];
};

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

const paletteIds = PALETTES.map((palette) => palette.id);
const poolIds = GLYPH_POOLS.map((pool) => pool.id);

function readPreset(source: Bag, warnings: string[]): StylePreset {
  const templateId = str(source, "templateId", DEFAULT_PROJECT.layers[0].templateId);
  if (!hasTemplate(templateId)) {
    warnings.push(`Unknown template "${templateId}" — fell back to Agent Reveal.`);
  }

  return {
    name: str(source, "name", "Imported look"),
    templateId: hasTemplate(templateId) ? templateId : "agent-reveal",
    glyphPool: oneOf(source, "glyphPool", poolIds, "hex") as GlyphPoolId,
    paletteId: oneOf(source, "paletteId", paletteIds, "agent") as PaletteId,
    invertCanvas: bool(source, "invertCanvas", false),
    gradientDigits: bool(source, "gradientDigits", true),
    typography: readTypography(bagAt(source, "typography")),
    motion: readMotion(bagAt(source, "motion")),
    color: readColor(bagAt(source, "color")),
    background: readBackground(bagAt(source, "background"), warnings),
  };
}

/**
 * Pulls a look out of a document that also describes layers.
 *
 * v2 files and project files both carry a `layers` array. The first layer's
 * template is the look's template — that is how the look was authored — and
 * everything else about the layers is document, not style.
 */
function lookFromLayeredDocument(source: Bag, warnings: string[]): StylePreset {
  const layers = Array.isArray(source.layers) ? source.layers : [];
  const first = isBag(layers[0]) ? (layers[0] as Bag) : {};

  return readPreset(
    {
      ...source,
      templateId: source.templateId ?? first.templateId,
      glyphPool: source.glyphPool ?? first.glyphPool,
    },
    warnings,
  );
}

function textsFrom(source: Bag): string[] {
  const layers = Array.isArray(source.layers) ? source.layers : [];
  const texts = layers
    .map((layer) => (isBag(layer) && typeof layer.text === "string" ? layer.text : ""))
    .filter((text) => text.trim().length > 0);
  if (texts.length) return texts;

  // v2 also mirrored the phrases into `text.layers[]`. Read whichever copy the
  // file happens to have; the format no longer writes either.
  const mirrored = bagAt(source, "text");
  const mirroredLayers = Array.isArray(mirrored.layers) ? mirrored.layers : [];
  return mirroredLayers
    .map((layer) => (isBag(layer) && typeof layer.text === "string" ? layer.text : ""))
    .filter((text) => text.trim().length > 0);
}

/**
 * Parses a look.
 *
 * Throws only for input that is not a document at all. Everything else —
 * unknown template, missing section, out-of-range number, a field from a future
 * build — is absorbed, reported as a warning, and left at the default.
 */
export function parseStylePreset(raw: string): ParsedStylePreset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PersistenceError("That file is not valid JSON.");
  }
  if (!isBag(parsed)) {
    throw new PersistenceError("A look must be a JSON object.");
  }

  const warnings: string[] = [];
  const sourceVersion = detectVersion(parsed);

  if (sourceVersion > STYLE_PRESET_VERSION) {
    warnings.push(
      `This look was written by a newer version (schema ${sourceVersion}). Unknown settings were ignored.`,
    );
  }

  let source = parsed;
  if (sourceVersion <= 1) {
    source = migrateV1Preset(parsed);
    warnings.push("Upgraded a version 1 preset to the current schema.");
  } else if (sourceVersion === 2) {
    warnings.push("Upgraded a version 2 preset — only the look was taken from it.");
  }

  return {
    preset: lookFromLayeredDocument(source, warnings),
    warnings,
    sourceVersion,
    texts: textsFrom(source),
  };
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

/** The look a project is currently wearing, ready to save. */
export function stylePresetFromProject(project: ProjectState, name: string): StylePreset {
  const active =
    project.layers.find((layer) => layer.id === project.activeLayerId) ?? project.layers[0];

  return {
    name,
    templateId: active?.templateId ?? DEFAULT_PROJECT.layers[0].templateId,
    glyphPool: active?.glyphPool ?? "hex",
    paletteId: project.paletteId,
    invertCanvas: project.invertCanvas,
    gradientDigits: project.gradientDigits,
    typography: project.typography,
    motion: project.motion,
    color: project.color,
    background: project.background,
  };
}

export function stylePresetFile(preset: StylePreset): StylePresetFile {
  return { $schema: STYLE_PRESET_SCHEMA_ID, schemaVersion: STYLE_PRESET_VERSION, ...preset };
}

export function stylePresetJson(preset: StylePreset): string {
  return `${JSON.stringify(stylePresetFile(preset), null, 2)}\n`;
}

/* ------------------------------------------------------------------ *
 * Applying
 * ------------------------------------------------------------------ */

/**
 * Wraps a look around a project without touching the document.
 *
 * The canvas, the layer structure, every phrase and every word style are the
 * user's. Only the active layer takes the template, because a look describes
 * one motion idea and stamping it onto every layer of a composed scene would be
 * a document edit wearing a style preset's clothes.
 */
export function applyStylePreset(project: ProjectState, preset: StylePreset): ProjectState {
  return {
    ...project,
    paletteId: preset.paletteId,
    invertCanvas: preset.invertCanvas,
    gradientDigits: preset.gradientDigits,
    typography: { ...project.typography, ...preset.typography },
    motion: { ...project.motion, ...preset.motion },
    background: { ...project.background, ...preset.background },
    // A look expresses itself through the ramp, so custom overrides step aside
    // unless the look explicitly sets them.
    color: { ...project.color, ...preset.color },
    layers: project.layers.map((layer) =>
      layer.id === project.activeLayerId
        ? { ...layer, templateId: preset.templateId, glyphPool: preset.glyphPool }
        : layer,
    ),
  };
}

/** Guards a hand-written look definition against drifting out of range. */
export function clampPresetMotion(motion: Partial<MotionConfig>): Partial<MotionConfig> {
  const clamp = (value: number | undefined, range: { min: number; max: number }) =>
    value === undefined ? undefined : Math.min(range.max, Math.max(range.min, value));

  return {
    ...motion,
    speed: clamp(motion.speed, RANGES.speed),
    stagger: clamp(motion.stagger, RANGES.stagger),
    hold: clamp(motion.hold, RANGES.hold),
  };
}

export { num };
