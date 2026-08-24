import { clampEdge, CUSTOM_FORMAT_ID, getCanvasFormat } from "@/lib/canvas-formats";
import { GLYPH_POOLS } from "@/lib/glyphs";
import {
  DEFAULT_BACKGROUND,
  DEFAULT_CANVAS,
  DEFAULT_COLOR,
  DEFAULT_MOTION,
  DEFAULT_PROJECT,
  DEFAULT_TYPOGRAPHY,
  RANGES,
  createLayer,
} from "@/lib/project";
import { hasTemplate } from "@/lib/templates";
import type {
  BackgroundConfig,
  CanvasConfig,
  ColorConfig,
  MotionConfig,
  PositionConfig,
  TextLayer,
  TypographyConfig,
  WordStyle,
} from "@/lib/types";

/**
 * Defensive readers for untrusted JSON.
 *
 * Every field a file can carry is read through one of these, and every one of
 * them answers with something usable. A preset, a project file and a restored
 * session are all documents a user can hand-edit, download from a stranger or
 * leave in localStorage across an upgrade — so "throw" is never the answer for
 * a field, only for input that is not a document at all.
 *
 * These used to live inside the preset parser. They are shared now because the
 * project format reads exactly the same sections and would otherwise grow a
 * second, drifting copy of the same clamps.
 *
 * Every numeric clamp is the control's own range rather than a second, wider
 * opinion about it: a file carrying a value no slider can reach would otherwise
 * import intact and leave that control pinned at its end stop, describing a
 * project it does not have.
 */

export type Bag = Record<string, unknown>;

export const isBag = (value: unknown): value is Bag =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function num(
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

export function bool(source: Bag, key: string, fallback: boolean): boolean {
  const value = source[key];
  return typeof value === "boolean" ? value : fallback;
}

export function str(source: Bag, key: string, fallback: string): string {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function oneOf<T extends string>(
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
export function colour(source: Bag, key: string, fallback: string): string {
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

export function bagAt(source: Bag, key: string): Bag {
  const value = source[key];
  return isBag(value) ? value : {};
}

/* ------------------------------------------------------------------ *
 * Section readers
 * ------------------------------------------------------------------ */

export function readCanvas(source: Bag, warnings: string[]): CanvasConfig {
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

export function readTypography(source: Bag): TypographyConfig {
  return {
    // Font ids are resolved leniently downstream, so an unknown face degrades
    // to the default rather than failing the import.
    fontId: str(source, "fontId", DEFAULT_TYPOGRAPHY.fontId),
    fontSize: num(source, "fontSize", DEFAULT_TYPOGRAPHY.fontSize, RANGES.fontSize),
    tracking: num(source, "tracking", DEFAULT_TYPOGRAPHY.tracking, RANGES.tracking),
    leading: num(source, "leading", DEFAULT_TYPOGRAPHY.leading, RANGES.leading),
    weight: num(source, "weight", DEFAULT_TYPOGRAPHY.weight, RANGES.weight),
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

export function readMotion(source: Bag): MotionConfig {
  return {
    speed: num(source, "speed", DEFAULT_MOTION.speed, RANGES.speed),
    stagger: num(source, "stagger", DEFAULT_MOTION.stagger, RANGES.stagger),
    delay: num(source, "delay", DEFAULT_MOTION.delay, RANGES.delay),
    easing: oneOf(
      source,
      "easing",
      ["template", "smooth", "cinematic", "snappy", "elastic", "linear", "power", "expo"] as const,
      DEFAULT_MOTION.easing,
    ),
    loop: bool(source, "loop", DEFAULT_MOTION.loop),
    hold: num(source, "hold", DEFAULT_MOTION.hold, RANGES.hold),
  };
}

export function readColor(source: Bag): ColorConfig {
  return {
    mode: oneOf(source, "mode", ["palette", "custom"] as const, DEFAULT_COLOR.mode),
    text: colour(source, "text", DEFAULT_COLOR.text),
    accent1: colour(source, "accent1", DEFAULT_COLOR.accent1),
    accent2: colour(source, "accent2", DEFAULT_COLOR.accent2),
    accent3: colour(source, "accent3", DEFAULT_COLOR.accent3),
    gradientStart: colour(source, "gradientStart", DEFAULT_COLOR.gradientStart),
    gradientEnd: colour(source, "gradientEnd", DEFAULT_COLOR.gradientEnd),
    gradientAngle: num(source, "gradientAngle", DEFAULT_COLOR.gradientAngle, RANGES.angle),
    glow: num(source, "glow", DEFAULT_COLOR.glow, RANGES.glow),
    glowColor: colour(source, "glowColor", DEFAULT_COLOR.glowColor),
    shadow: num(source, "shadow", DEFAULT_COLOR.shadow, RANGES.shadow),
    outline: num(source, "outline", DEFAULT_COLOR.outline, RANGES.outline),
    outlineColor: colour(source, "outlineColor", DEFAULT_COLOR.outlineColor),
    opacity: num(source, "opacity", DEFAULT_COLOR.opacity, RANGES.opacity),
  };
}

export function readBackground(source: Bag, warnings: string[]): BackgroundConfig {
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
    gradientAngle: num(source, "gradientAngle", DEFAULT_BACKGROUND.gradientAngle, RANGES.angle),
    animated: bool(source, "animated", DEFAULT_BACKGROUND.animated),
    noise: num(source, "noise", DEFAULT_BACKGROUND.noise, RANGES.effect),
    grain: num(source, "grain", DEFAULT_BACKGROUND.grain, RANGES.effect),
    vignette: num(source, "vignette", DEFAULT_BACKGROUND.vignette, RANGES.effect),
    glow: num(source, "glow", DEFAULT_BACKGROUND.glow, RANGES.effect),
    grid: num(source, "grid", DEFAULT_BACKGROUND.grid, RANGES.effect),
    imageUrl: safeImage,
    imageFit: oneOf(source, "imageFit", ["cover", "contain"] as const, DEFAULT_BACKGROUND.imageFit),
  };
}

export function readPosition(source: Bag): PositionConfig {
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
    x: num(source, "x", 0, RANGES.offset),
    y: num(source, "y", 0, RANGES.offset),
  };
}

export function readWordStyles(value: unknown): Record<number, WordStyle> {
  if (!isBag(value)) return {};
  const out: Record<number, WordStyle> = {};

  for (const [key, entry] of Object.entries(value)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index > 512 || !isBag(entry)) continue;

    const style: WordStyle = {};
    if (typeof entry.color === "string") style.color = colour(entry, "color", "");
    if (typeof entry.gradient === "boolean") style.gradient = entry.gradient;
    if (typeof entry.weight === "number") style.weight = num(entry, "weight", 600, RANGES.weight);
    if (typeof entry.scale === "number") style.scale = num(entry, "scale", 1, RANGES.wordScale);
    if (typeof entry.glow === "number") style.glow = num(entry, "glow", 0, RANGES.glow);
    if (typeof entry.opacity === "number") style.opacity = num(entry, "opacity", 1, RANGES.opacity);
    if (typeof entry.delay === "number") style.delay = num(entry, "delay", 0, RANGES.wordDelay);
    if (typeof entry.emphasis === "string") {
      style.emphasis = oneOf(entry, "emphasis", ["none", "pop", "delay", "lead"] as const, "none");
    }
    if (style.color === "") delete style.color;
    out[index] = style;
  }

  return out;
}

export function readLayer(value: unknown, index: number, warnings: string[]): TextLayer {
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
    delay: num(source, "delay", 0, RANGES.layerDelay),
    position: readPosition(bagAt(source, "position")),
    typography: readLayerTypography(bagAt(source, "typography")),
    wordStyles: readWordStyles(source.wordStyles),
    visible: bool(source, "visible", true),
  });
}

export function readLayerTypography(source: Bag): TextLayer["typography"] {
  const out: TextLayer["typography"] = {};
  if (typeof source.fontId === "string") out.fontId = source.fontId;
  if (typeof source.weight === "number") out.weight = num(source, "weight", 600, RANGES.weight);
  if (typeof source.tracking === "number") out.tracking = num(source, "tracking", 0, RANGES.tracking);
  if (typeof source.scale === "number") out.scale = num(source, "scale", 1, RANGES.wordScale);
  if (typeof source.italic === "boolean") out.italic = source.italic;
  if (typeof source.transform === "string") {
    out.transform = oneOf(source, "transform", ["none", "uppercase", "lowercase"] as const, "none");
  }
  if (typeof source.align === "string") {
    out.align = oneOf(source, "align", ["left", "center", "right"] as const, "center");
  }
  return out;
}
