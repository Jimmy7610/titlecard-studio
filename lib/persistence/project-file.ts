import { PALETTES, type PaletteId } from "@/lib/palettes";
import {
  bagAt,
  bool,
  isBag,
  oneOf,
  readCanvas,
  readColor,
  readBackground,
  readLayer,
  readMotion,
  readTypography,
  str,
  type Bag,
} from "@/lib/persistence/readers";
import {
  detectVersion,
  migrateV1Preset,
  migrateV2Project,
  migrateV3Project,
  PersistenceError,
  usesLegacyOffsets,
} from "@/lib/persistence/versions";
import { DEFAULT_PROJECT } from "@/lib/project";
import type { ProjectState, TextLayer } from "@/lib/types";

/**
 * The whole document.
 *
 * Everything the editor is showing: the canvas, every layer with its own text,
 * template, timing, position, typography overrides and word styling, plus the
 * project-wide type, motion, colour and background. Opening one replaces what
 * you were working on, which is exactly what "open a project" should mean and
 * exactly what applying a look must never do.
 *
 * There is one copy of each phrase, on its layer. v2 kept a second copy under
 * `text.layers[]` so that a look could be applied without the words following
 * it; separating the two formats is what removed the need for that, and with it
 * the `as unknown as` that used to reconcile them.
 */

export const PROJECT_FILE_VERSION = 4 as const;
export const PROJECT_FILE_SCHEMA_ID = `titlecard/project@${PROJECT_FILE_VERSION}`;
export const PROJECT_FILE_EXTENSION = ".titlecard.json";

/** Layer state, as written to a file. Ids are per-session and not stored. */
export type ProjectFileLayer = Omit<TextLayer, "id">;

export type ProjectFile = {
  $schema: string;
  schemaVersion: number;
  name: string;
  canvas: ProjectState["canvas"];
  typography: ProjectState["typography"];
  motion: ProjectState["motion"];
  color: ProjectState["color"];
  background: ProjectState["background"];
  paletteId: PaletteId;
  invertCanvas: boolean;
  gradientDigits: boolean;
  semantic: ProjectState["semantic"];
  /** Editor preference, not document state — see `docs/PRESETS-AND-PROJECTS.md`. */
  reducePreviewMotion: boolean;
  layers: ProjectFileLayer[];
  /** Index into `layers`, because ids are not stable across a load. */
  activeLayerIndex: number;
};

export type ParsedProject = {
  project: ProjectState;
  warnings: string[];
  sourceVersion: number;
};

const paletteIds = PALETTES.map((palette) => palette.id);

/** How many layers a file may describe before it is treated as hostile. */
const MAX_LAYERS = 8;

/**
 * Reads a project document.
 *
 * Throws only for input that is not a document at all. A missing section, an
 * unknown template, a number nothing in the UI could produce — all absorbed,
 * warned about, and replaced with something the editor can actually render.
 */
export function parseProjectFile(raw: string): ParsedProject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PersistenceError("That file is not valid JSON.");
  }
  if (!isBag(parsed)) {
    throw new PersistenceError("A project must be a JSON object.");
  }

  const warnings: string[] = [];
  const sourceVersion = detectVersion(parsed);

  if (sourceVersion > PROJECT_FILE_VERSION) {
    warnings.push(
      `This project was written by a newer version (schema ${sourceVersion}). Unknown settings were ignored.`,
    );
  }

  let source: Bag = parsed;
  if (sourceVersion <= 1) {
    source = migrateV3Project(migrateV2Project(migrateV1Preset(parsed)));
    warnings.push("Upgraded a version 1 file to the current schema.");
  } else if (sourceVersion === 2) {
    source = migrateV3Project(migrateV2Project(parsed));
    warnings.push("Upgraded a version 2 file to the current schema.");
  } else if (sourceVersion === 3) {
    source = migrateV3Project(parsed);
  }

  // v4 changed what a layer offset measures. Said plainly, and only to the
  // projects it can actually have moved.
  if (sourceVersion <= 3 && usesLegacyOffsets(parsed)) {
    warnings.push(
      "Layer offsets are now a percentage of the canvas rather than of the text block, so a layer that used one may have moved. The anchor is unchanged.",
    );
  }

  const rawLayers = Array.isArray(source.layers) ? source.layers : [];
  if (rawLayers.length > MAX_LAYERS) {
    warnings.push(`Only the first ${MAX_LAYERS} layers were read.`);
  }
  if (rawLayers.length === 0) {
    warnings.push("The file described no layers — started from an empty headline.");
  }

  const layers = (rawLayers.length ? rawLayers : [{}])
    .slice(0, MAX_LAYERS)
    .map((layer, index) => readLayer(layer, index, warnings));

  const semantic = bagAt(source, "semantic");
  const activeIndex = Number(source.activeLayerIndex);
  const active =
    Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < layers.length
      ? activeIndex
      : 0;

  const project: ProjectState = {
    schemaVersion: PROJECT_FILE_VERSION,
    name: str(source, "name", "Untitled"),
    canvas: readCanvas(bagAt(source, "canvas"), warnings),
    typography: readTypography(bagAt(source, "typography")),
    motion: readMotion(bagAt(source, "motion")),
    color: readColor(bagAt(source, "color")),
    background: readBackground(bagAt(source, "background"), warnings),
    paletteId: oneOf(source, "paletteId", paletteIds, "agent") as PaletteId,
    invertCanvas: bool(source, "invertCanvas", false),
    layers,
    activeLayerId: layers[active].id,
    semantic: {
      enabled: bool(semantic, "enabled", true),
      autoApply: bool(semantic, "autoApply", false),
    },
    gradientDigits: bool(source, "gradientDigits", true),
    reducePreviewMotion: bool(source, "reducePreviewMotion", false),
  };

  return { project, warnings, sourceVersion };
}

/** Serialises the editor's document. */
export function projectFile(project: ProjectState): ProjectFile {
  const activeLayerIndex = Math.max(
    0,
    project.layers.findIndex((layer) => layer.id === project.activeLayerId),
  );

  return {
    $schema: PROJECT_FILE_SCHEMA_ID,
    schemaVersion: PROJECT_FILE_VERSION,
    name: project.name,
    canvas: project.canvas,
    typography: project.typography,
    motion: project.motion,
    color: project.color,
    background: project.background,
    paletteId: project.paletteId,
    invertCanvas: project.invertCanvas,
    gradientDigits: project.gradientDigits,
    semantic: project.semantic,
    reducePreviewMotion: project.reducePreviewMotion,
    // Ids are minted per session, so position is the only stable reference a
    // file can make to a layer.
    layers: project.layers.map(({ id: _id, ...layer }) => layer),
    activeLayerIndex,
  };
}

export function projectFileJson(project: ProjectState): string {
  return `${JSON.stringify(projectFile(project), null, 2)}\n`;
}

/** A filename for a downloaded project, derived from its own name. */
export function projectFileName(project: ProjectState): string {
  const stem =
    project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) ||
    (project.layers[0]?.text ? "titlecard" : "untitled");
  return `${stem}${PROJECT_FILE_EXTENSION}`;
}

export { DEFAULT_PROJECT };
