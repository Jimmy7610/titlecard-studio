import { clampEdge, CUSTOM_FORMAT_ID, getCanvasFormat } from "@/lib/canvas-formats";
import { GLYPH_POOLS } from "@/lib/glyphs";
import { PALETTES } from "@/lib/palettes";
import {
  DEFAULT_BACKGROUND,
  DEFAULT_CANVAS,
  DEFAULT_COLOR,
  DEFAULT_MOTION,
  DEFAULT_PROJECT,
  DEFAULT_TYPOGRAPHY,
  SCHEMA_VERSION,
  createLayer,
} from "@/lib/project";
import { hasTemplate } from "@/lib/templates";
import type {
  BackgroundConfig,
  CanvasConfig,
  ColorConfig,
  MotionConfig,
  PositionConfig,
  ProjectState,
  TextLayer,
  TypographyConfig,
  WordStyle,
} from "@/lib/types";

/**
 * Preset serialisation, versioning and import validation.
 *
 * Two rules shape this module. A preset written by an older build must still
 * open — hence `migrateV1`. And a malformed file must produce a message, never
 * a crash and never a half-applied project: every field is read defensively and
 * falls back to the default, collecting a warning as it goes.
 */

export const PRESET_SCHEMA_ID = `semantic-text-animator/preset@${SCHEMA_VERSION}`;

export class PresetError extends Error {}

export type PresetPayload = {
  $schema: string;
  schemaVersion: number;
  name: string;
  /** Kept separate: importing a look must never silently replace the phrase. */
  text: { layers: { name: string; text: string }[] };
  canvas: CanvasConfig;
  typography: TypographyConfig;
  motion: MotionConfig;
  color: ColorConfig;
  background: BackgroundConfig;
  paletteId: string;
  invertCanvas: boolean;
  gradientDigits: boolean;
  layers: Omit<TextLayer, "text" | "name" | "id">[];
};

export type ParsedPreset = {
  name: string;
  /** Everything except the phrases. */
  project: Omit<ProjectState, "layers" | "activeLayerId"> & {
    layers: TextLayer[];
    activeLayerId: string;
  };
  /** The phrases the file carried, offered as an explicit opt-in. */
  texts: string[];
  warnings: string[];
  /** The schema the file was written against. */
  sourceVersion: number;
};

/* ------------------------------------------------------------------ *
 * Readers
 * ------------------------------------------------------------------ */

type Bag = Record<string, unknown>;

const isBag = (value: unknown): value is Bag =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function num(
  source: Bag,
  key: string,
  fallback: number,
  range?: { min: number; max: number },
): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (!range) return value;
  return Math.min(range.max, Math.max(range.min, value));
}

function bool(source: Bag, key: string, fallback: boolean): boolean {
  const value = source[key];
  return typeof value === "boolean" ? value : fallback;
}

function str(source: Bag, key: string, fallback: string): string {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function oneOf<T extends string>(
  source: Bag,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = source[key];
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** A CSS colour we are willing to write into a stylesheet. */
function colour(source: Bag, key: string, fallback: string): string {
  const value = source[key];
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  // Deliberately narrow. A preset is untrusted input that ends up inside a
  // `style` attribute and inside generated CSS, so anything that could carry a
  // url() or close a declaration is rejected rather than sanitised.
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed)) return trimmed;
  if (/^(rgb|rgba|hsl|hsla|oklch|oklab|color)\([\d\s.,%/-]+\)$/i.test(trimmed)) return trimmed;
  if (/^[a-z]{3,20}$/i.test(trimmed)) return trimmed;
  return fallback;
}

function bagAt(source: Bag, key: string): Bag {
  const value = source[key];
  return isBag(value) ? value : {};
}

/* ------------------------------------------------------------------ *
 * Section readers
 * ------------------------------------------------------------------ */

function readCanvas(source: Bag, warnings: string[]): CanvasConfig {
  const formatId = str(source, "formatId", DEFAULT_CANVAS.formatId);
  const known = getCanvasFormat(formatId);
  const width = clampEdge(num(source, "width", DEFAULT_CANVAS.width));
  const height = clampEdge(num(source, "height", DEFAULT_CANVAS.height));

  if (!known && formatId !== CUSTOM_FORMAT_ID) {
    warnings.push(`Unknown canvas format "${formatId}" — kept the stored size.`);
  }

  return {
    formatId: known ? known.id : CUSTOM_FORMAT_ID,
    width,
    height,
    safeZones: bool(source, "safeZones", DEFAULT_CANVAS.safeZones),
  };
}

function readTypography(source: Bag): TypographyConfig {
  return {
    // Font ids are resolved leniently downstream, so an unknown face degrades
    // to the default rather than failing the import.
    fontId: str(source, "fontId", DEFAULT_TYPOGRAPHY.fontId),
    fontSize: num(source, "fontSize", DEFAULT_TYPOGRAPHY.fontSize, { min: 0.5, max: 40 }),
    tracking: num(source, "tracking", DEFAULT_TYPOGRAPHY.tracking, { min: -0.3, max: 1 }),
    leading: num(source, "leading", DEFAULT_TYPOGRAPHY.leading, { min: 0.5, max: 4 }),
    weight: num(source, "weight", DEFAULT_TYPOGRAPHY.weight, { min: 100, max: 900 }),
    align: oneOf(source, "align", ["left", "center", "right"] as const, DEFAULT_TYPOGRAPHY.align),
    transform: oneOf(
      source,
      "transform",
      ["none", "uppercase", "lowercase"] as const,
      DEFAULT_TYPOGRAPHY.transform,
    ),
    italic: bool(source, "italic", DEFAULT_TYPOGRAPHY.italic),
    granularity: oneOf(
      source,
      "granularity",
      ["char", "word", "line"] as const,
      DEFAULT_TYPOGRAPHY.granularity,
    ),
  };
}

function readMotion(source: Bag): MotionConfig {
  return {
    speed: num(source, "speed", DEFAULT_MOTION.speed, { min: 0.05, max: 6 }),
    stagger: num(source, "stagger", DEFAULT_MOTION.stagger, { min: 0, max: 1 }),
    delay: num(source, "delay", DEFAULT_MOTION.delay, { min: 0, max: 10 }),
    easing: oneOf(
      source,
      "easing",
      ["template", "smooth", "cinematic", "snappy", "elastic", "linear", "power", "expo"] as const,
      DEFAULT_MOTION.easing,
    ),
    loop: bool(source, "loop", DEFAULT_MOTION.loop),
    hold: num(source, "hold", DEFAULT_MOTION.hold, { min: 0, max: 10 }),
  };
}

function readColor(source: Bag): ColorConfig {
  return {
    mode: oneOf(source, "mode", ["palette", "custom"] as const, DEFAULT_COLOR.mode),
    text: colour(source, "text", DEFAULT_COLOR.text),
    accent1: colour(source, "accent1", DEFAULT_COLOR.accent1),
    accent2: colour(source, "accent2", DEFAULT_COLOR.accent2),
    accent3: colour(source, "accent3", DEFAULT_COLOR.accent3),
    gradientStart: colour(source, "gradientStart", DEFAULT_COLOR.gradientStart),
    gradientEnd: colour(source, "gradientEnd", DEFAULT_COLOR.gradientEnd),
    gradientAngle: num(source, "gradientAngle", DEFAULT_COLOR.gradientAngle, { min: 0, max: 360 }),
    glow: num(source, "glow", DEFAULT_COLOR.glow, { min: 0, max: 2 }),
    glowColor: colour(source, "glowColor", DEFAULT_COLOR.glowColor),
    shadow: num(source, "shadow", DEFAULT_COLOR.shadow, { min: 0, max: 2 }),
    outline: num(source, "outline", DEFAULT_COLOR.outline, { min: 0, max: 0.5 }),
    outlineColor: colour(source, "outlineColor", DEFAULT_COLOR.outlineColor),
    opacity: num(source, "opacity", DEFAULT_COLOR.opacity, { min: 0, max: 1 }),
  };
}

function readBackground(source: Bag, warnings: string[]): BackgroundConfig {
  const imageUrl = str(source, "imageUrl", "");
  // A remote URL in an imported preset would fetch on the user's behalf the
  // moment the project renders, so only inline data is carried across.
  const safeImage = imageUrl.startsWith("data:image/") ? imageUrl : "";
  if (imageUrl && !safeImage) {
    warnings.push("Dropped a background image that was not embedded in the file.");
  }

  return {
    mode: oneOf(
      source,
      "mode",
      ["solid", "gradient", "transparent", "image"] as const,
      DEFAULT_BACKGROUND.mode,
    ),
    color: colour(source, "color", DEFAULT_BACKGROUND.color),
    gradientStart: colour(source, "gradientStart", DEFAULT_BACKGROUND.gradientStart),
    gradientEnd: colour(source, "gradientEnd", DEFAULT_BACKGROUND.gradientEnd),
    gradientAngle: num(source, "gradientAngle", DEFAULT_BACKGROUND.gradientAngle, {
      min: 0,
      max: 360,
    }),
    animated: bool(source, "animated", DEFAULT_BACKGROUND.animated),
    noise: num(source, "noise", DEFAULT_BACKGROUND.noise, { min: 0, max: 1 }),
    grain: num(source, "grain", DEFAULT_BACKGROUND.grain, { min: 0, max: 1 }),
    vignette: num(source, "vignette", DEFAULT_BACKGROUND.vignette, { min: 0, max: 1 }),
    glow: num(source, "glow", DEFAULT_BACKGROUND.glow, { min: 0, max: 1 }),
    grid: num(source, "grid", DEFAULT_BACKGROUND.grid, { min: 0, max: 1 }),
    imageUrl: safeImage,
    imageFit: oneOf(source, "imageFit", ["cover", "contain"] as const, DEFAULT_BACKGROUND.imageFit),
  };
}

function readPosition(source: Bag): PositionConfig {
  return {
    anchor: oneOf(
      source,
      "anchor",
      [
        "top-left", "top", "top-right",
        "left", "center", "right",
        "bottom-left", "bottom", "bottom-right",
      ] as const,
      "center",
    ),
    x: num(source, "x", 0, { min: -100, max: 100 }),
    y: num(source, "y", 0, { min: -100, max: 100 }),
  };
}

function readWordStyles(value: unknown): Record<number, WordStyle> {
  if (!isBag(value)) return {};
  const out: Record<number, WordStyle> = {};

  for (const [key, entry] of Object.entries(value)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index > 512 || !isBag(entry)) continue;

    const style: WordStyle = {};
    if (typeof entry.color === "string") style.color = colour(entry, "color", "");
    if (typeof entry.gradient === "boolean") style.gradient = entry.gradient;
    if (typeof entry.weight === "number") style.weight = num(entry, "weight", 600, { min: 100, max: 900 });
    if (typeof entry.scale === "number") style.scale = num(entry, "scale", 1, { min: 0.2, max: 4 });
    if (typeof entry.glow === "number") style.glow = num(entry, "glow", 0, { min: 0, max: 2 });
    if (typeof entry.opacity === "number") style.opacity = num(entry, "opacity", 1, { min: 0, max: 1 });
    if (typeof entry.delay === "number") style.delay = num(entry, "delay", 0, { min: 0, max: 5 });
    if (typeof entry.emphasis === "string") {
      style.emphasis = oneOf(entry, "emphasis", ["none", "pop", "delay", "lead"] as const, "none");
    }
    if (style.color === "") delete style.color;
    out[index] = style;
  }

  return out;
}

function readLayer(value: unknown, index: number, warnings: string[]): TextLayer {
  const source = isBag(value) ? value : {};
  const templateId = str(source, "templateId", DEFAULT_PROJECT.layers[0].templateId);

  if (!hasTemplate(templateId)) {
    warnings.push(`Unknown template "${templateId}" — fell back to Agent Reveal.`);
  }

  const poolIds = GLYPH_POOLS.map((pool) => pool.id);

  return createLayer({
    name: str(source, "name", `Layer ${index + 1}`),
    text: typeof source.text === "string" ? source.text.slice(0, 400) : "",
    templateId: hasTemplate(templateId) ? templateId : "agent-reveal",
    glyphPool: oneOf(source, "glyphPool", poolIds, "hex"),
    delay: num(source, "delay", 0, { min: 0, max: 30 }),
    position: readPosition(bagAt(source, "position")),
    typography: readLayerTypography(bagAt(source, "typography")),
    wordStyles: readWordStyles(source.wordStyles),
    visible: bool(source, "visible", true),
  });
}

function readLayerTypography(source: Bag): TextLayer["typography"] {
  const out: TextLayer["typography"] = {};
  if (typeof source.fontId === "string") out.fontId = source.fontId;
  if (typeof source.weight === "number") out.weight = num(source, "weight", 600, { min: 100, max: 900 });
  if (typeof source.tracking === "number") out.tracking = num(source, "tracking", 0, { min: -0.3, max: 1 });
  if (typeof source.scale === "number") out.scale = num(source, "scale", 1, { min: 0.1, max: 5 });
  if (typeof source.italic === "boolean") out.italic = source.italic;
  if (typeof source.transform === "string") {
    out.transform = oneOf(source, "transform", ["none", "uppercase", "lowercase"] as const, "none");
  }
  if (typeof source.align === "string") {
    out.align = oneOf(source, "align", ["left", "center", "right"] as const, "center");
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * v1 migration
 * ------------------------------------------------------------------ */

/**
 * Reshapes a v1 preset into the v2 field layout.
 *
 * v1 was a flat settings dump with `type`/`motion` sub-objects and a `canvas`
 * that was a light/dark *string*. Everything it could express still exists, so
 * the migration is total — no v1 file loses information opening in v2.
 */
function migrateV1(source: Bag): Bag {
  const type = bagAt(source, "type");
  const motion = bagAt(source, "motion");
  const invert = source.canvas === "dark";

  return {
    schemaVersion: 2,
    name: typeof source.phrase === "string" ? source.phrase : "Imported preset",
    paletteId: source.palette,
    invertCanvas: invert,
    gradientDigits: true,
    canvas: { ...DEFAULT_CANVAS },
    typography: {
      ...DEFAULT_TYPOGRAPHY,
      fontSize: type.fontSize,
      tracking: type.tracking,
      leading: type.leading,
      weight: type.weight,
    },
    motion: {
      ...DEFAULT_MOTION,
      speed: motion.speed,
      stagger: motion.stagger,
      loop: motion.loop,
    },
    color: { ...DEFAULT_COLOR },
    background: {
      ...DEFAULT_BACKGROUND,
      // v1 had no background system; the palette canvas tone was the whole of
      // it, and that is what `invertCanvas` still selects.
      mode: "solid",
      color: DEFAULT_BACKGROUND.color,
    },
    layers: [
      {
        name: "Headline",
        text: source.phrase,
        templateId: source.template,
        glyphPool: source.glyphPool,
        delay: 0,
        position: { anchor: "center", x: 0, y: 0 },
        typography: {},
        wordStyles: {},
        visible: true,
      },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export function detectVersion(source: Bag): number {
  if (typeof source.schemaVersion === "number") return source.schemaVersion;
  const schema = source.$schema;
  if (typeof schema === "string") {
    const match = /@(\d+)$/.exec(schema);
    if (match) return Number(match[1]);
  }
  // The very first build wrote no version marker at all.
  return "phrase" in source ? 1 : SCHEMA_VERSION;
}

/**
 * Parses preset JSON into a project.
 *
 * Throws only for input that is not a preset at all. Everything else — unknown
 * template, missing section, out-of-range number, a field from a future build —
 * is absorbed, reported as a warning, and left at the default.
 */
export function parsePreset(raw: string): ParsedPreset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PresetError("That file is not valid JSON.");
  }

  if (!isBag(parsed)) {
    throw new PresetError("A preset must be a JSON object.");
  }

  const warnings: string[] = [];
  const sourceVersion = detectVersion(parsed);

  if (sourceVersion > SCHEMA_VERSION) {
    warnings.push(
      `This preset was written by a newer version (schema ${sourceVersion}). Unknown settings were ignored.`,
    );
  }

  const source = sourceVersion <= 1 ? migrateV1(parsed) : parsed;
  if (sourceVersion <= 1) warnings.push("Upgraded a version 1 preset to the current schema.");

  const rawLayers = Array.isArray(source.layers) ? source.layers : [];
  if (rawLayers.length === 0) {
    warnings.push("The preset contained no text layer — kept your current text.");
  }

  const layers = (rawLayers.length ? rawLayers : [{}]).slice(0, 8).map((layer, index) =>
    readLayer(layer, index, warnings),
  );

  const paletteIds = PALETTES.map((palette) => palette.id);
  const semantic = bagAt(source, "semantic");

  const project: ParsedPreset["project"] = {
    schemaVersion: SCHEMA_VERSION,
    name: str(source, "name", "Imported preset"),
    canvas: readCanvas(bagAt(source, "canvas"), warnings),
    typography: readTypography(bagAt(source, "typography")),
    motion: readMotion(bagAt(source, "motion")),
    color: readColor(bagAt(source, "color")),
    background: readBackground(bagAt(source, "background"), warnings),
    paletteId: oneOf(source, "paletteId", paletteIds, "agent"),
    invertCanvas: bool(source, "invertCanvas", false),
    layers,
    activeLayerId: layers[0].id,
    semantic: {
      enabled: bool(semantic, "enabled", true),
      autoApply: bool(semantic, "autoApply", false),
    },
    gradientDigits: bool(source, "gradientDigits", true),
    reducePreviewMotion: false,
  };

  return {
    name: project.name,
    project,
    texts: layers.map((layer) => layer.text),
    warnings,
    sourceVersion,
  };
}

/** Serialises a project as a shareable preset. */
export function presetPayload(project: ProjectState): PresetPayload {
  return {
    $schema: PRESET_SCHEMA_ID,
    schemaVersion: SCHEMA_VERSION,
    name: project.name,
    text: {
      layers: project.layers.map((layer) => ({ name: layer.name, text: layer.text })),
    },
    canvas: project.canvas,
    typography: project.typography,
    motion: project.motion,
    color: project.color,
    background: project.background,
    paletteId: project.paletteId,
    invertCanvas: project.invertCanvas,
    gradientDigits: project.gradientDigits,
    layers: project.layers.map(({ ...layer }) => ({
      templateId: layer.templateId,
      glyphPool: layer.glyphPool,
      delay: layer.delay,
      position: layer.position,
      typography: layer.typography,
      wordStyles: layer.wordStyles,
      visible: layer.visible,
      // Text rides along so a preset can carry a phrase, but the importer only
      // applies it when the user asks for it.
      text: layer.text,
      name: layer.name,
    })) as unknown as PresetPayload["layers"],
  };
}

export function presetJson(project: ProjectState): string {
  return `${JSON.stringify(presetPayload(project), null, 2)}\n`;
}
