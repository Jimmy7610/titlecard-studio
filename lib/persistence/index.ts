/**
 * The three documents Titlecard reads and writes.
 *
 * They were one format doing all three jobs, which is why applying a saved look
 * could quietly replace a canvas and why every phrase was stored twice. Keeping
 * them separate is the point:
 *
 *   StylePreset   a look. Palette, type, motion, background, template.
 *                 Applying one never touches text, canvas or layer structure.
 *
 *   ProjectFile   the whole document. Opening one replaces what you had.
 *
 *   Session       a ProjectFile in localStorage. Not a preset, and never
 *                 offered as one.
 */
export {
  PersistenceError,
  detectVersion,
  looksLikeProject,
  migrateV1Preset,
  migrateV2Project,
} from "@/lib/persistence/versions";

export {
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_SCHEMA_ID,
  PROJECT_FILE_VERSION,
  parseProjectFile,
  projectFile,
  projectFileJson,
  projectFileName,
  type ParsedProject,
  type ProjectFile,
  type ProjectFileLayer,
} from "@/lib/persistence/project-file";

export {
  STYLE_PRESET_EXTENSION,
  STYLE_PRESET_SCHEMA_ID,
  STYLE_PRESET_VERSION,
  applyStylePreset,
  parseStylePreset,
  stylePresetFile,
  stylePresetFromProject,
  stylePresetJson,
  type ParsedStylePreset,
  type StylePreset,
  type StylePresetFile,
} from "@/lib/persistence/style-preset";
