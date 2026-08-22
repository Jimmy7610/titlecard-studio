import { getPalette, gradientOf } from "@/lib/palettes";
import type { BackgroundConfig, ColorConfig, ProjectState } from "@/lib/types";

/**
 * Resolves palette + colour overrides + background into the handful of custom
 * properties everything downstream reads.
 *
 * There is exactly one of these functions, and the editor stage, the standalone
 * HTML export, the React export and the canvas video recorder all call it. A
 * colour that looks one way in the preview and another way in an export is the
 * failure this is shaped to prevent.
 */

export type ResolvedTheme = {
  /** Resting colour of the type. */
  ink: string;
  /** Canvas colour — used to knock glyphs out of a colour slab. */
  canvas: string;
  hot: string;
  warm: string;
  sun: string;
  gradient: string;
  line: string;
  /** True when the canvas itself carries no paint. */
  transparent: boolean;
  /** Custom properties for the scope element. */
  vars: Record<string, string>;
  /** `background` shorthand layers for the canvas, outermost first. */
  backgroundLayers: string[];
  /**
   * Film grain opacity, 0 when off.
   *
   * Grain is a separate overlay rather than a background layer: CSS has no
   * per-layer opacity, and compositing a tiled noise bitmap into the paint
   * stack would tint the whole canvas instead of sitting on top of it.
   */
  grain: number;
  /** Text shadow / glow, or `none`. */
  textShadow: string;
  /** `-webkit-text-stroke`, or `none`. */
  textStroke: string;
};

function gradientCss(start: string, end: string, angle: number): string {
  return `linear-gradient(${angle}deg, ${start} 0%, ${end} 100%)`;
}

/** A translucent noise field, inline so an export needs no asset. */
export const NOISE_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

function backgroundLayersFor(
  background: BackgroundConfig,
  base: string,
  accent: string,
): string[] {
  const layers: string[] = [];

  // Ordered outermost first: the vignette sits above the paint, the paint sits
  // above nothing. A layer at zero is skipped entirely rather than composited
  // transparent — an invisible layer still costs a paint.
  if (background.vignette > 0) {
    layers.push(
      `radial-gradient(ellipse 82% 78% at 50% 50%, transparent 42%, rgb(0 0 0 / ${background.vignette.toFixed(
        2,
      )}) 100%)`,
    );
  }
  if (background.glow > 0) {
    layers.push(
      `radial-gradient(ellipse 62% 52% at 50% 42%, color-mix(in oklab, ${accent} ${Math.round(
        background.glow * 45,
      )}%, transparent), transparent 72%)`,
    );
  }
  if (background.grid > 0) {
    const alpha = (background.grid * 0.22).toFixed(3);
    layers.push(
      `linear-gradient(to right, rgb(128 128 128 / ${alpha}) 1px, transparent 1px)`,
      `linear-gradient(to bottom, rgb(128 128 128 / ${alpha}) 1px, transparent 1px)`,
    );
  }
  if (background.noise > 0) {
    layers.push(
      `radial-gradient(ellipse 120% 90% at 20% 0%, color-mix(in oklab, ${accent} ${Math.round(
        background.noise * 22,
      )}%, transparent), transparent 60%)`,
    );
  }

  switch (background.mode) {
    case "transparent":
      break;
    case "image":
      if (background.imageUrl) layers.push(`url("${background.imageUrl}") center / ${background.imageFit} no-repeat`);
      else layers.push(base);
      break;
    case "gradient":
      layers.push(
        gradientCss(
          background.gradientStart,
          background.gradientEnd,
          background.gradientAngle,
        ),
      );
      break;
    case "solid":
    default:
      layers.push(background.color);
  }

  return layers;
}

/** Background-size pairs matching the layer list above. */
export function backgroundSizes(background: BackgroundConfig): string[] {
  const sizes: string[] = [];
  if (background.vignette > 0) sizes.push("100% 100%");
  if (background.glow > 0) sizes.push("100% 100%");
  if (background.grid > 0) sizes.push("48px 48px", "48px 48px");
  if (background.noise > 0) sizes.push("100% 100%");
  sizes.push("100% 100%");
  return sizes;
}

export function resolveTheme(project: ProjectState): ResolvedTheme {
  const palette = getPalette(project.paletteId);
  const tones = project.invertCanvas ? palette.dark : palette.light;
  const colour: ColorConfig = project.color;
  const custom = colour.mode === "custom";

  const hot = custom ? colour.accent1 : palette.hot;
  const warm = custom ? colour.accent2 : palette.warm;
  const sun = custom ? colour.accent3 : palette.sun;
  const ink = custom ? colour.text : tones.ink;
  const gradient = custom
    ? gradientCss(colour.gradientStart, colour.gradientEnd, colour.gradientAngle)
    : gradientOf(palette);

  const transparent = project.background.mode === "transparent";
  // Knockout effects tint glyphs to the canvas colour. With no canvas to match,
  // the palette tone is the closest honest answer.
  const canvas = transparent ? tones.bg : backgroundBase(project.background, tones.bg);

  const layers = backgroundLayersFor(project.background, tones.bg, hot);

  const glow = colour.glow;
  const shadow = colour.shadow;
  const shadows: string[] = [];
  if (glow > 0) {
    shadows.push(`0 0 ${(glow * 0.9).toFixed(3)}em ${colour.glowColor}`);
    shadows.push(`0 0 ${(glow * 2).toFixed(3)}em ${colour.glowColor}`);
  }
  if (shadow > 0) {
    shadows.push(`0 ${(shadow * 0.5).toFixed(3)}em ${(shadow * 0.9).toFixed(3)}em rgb(0 0 0 / 0.45)`);
  }

  const vars: Record<string, string> = {
    "--stw-hot": hot,
    "--stw-warm": warm,
    "--stw-sun": sun,
    "--stw-gradient": gradient,
    "--stage-bg": transparent ? "transparent" : layers[layers.length - 1],
    "--stage-ink": ink,
    "--stage-line": tones.line,
    "--stw-text-opacity": String(colour.opacity),
  };

  return {
    ink,
    canvas,
    hot,
    warm,
    sun,
    gradient,
    line: tones.line,
    transparent,
    vars,
    backgroundLayers: layers,
    grain: project.background.grain,
    textShadow: shadows.length ? shadows.join(", ") : "none",
    textStroke:
      colour.outline > 0 ? `${colour.outline.toFixed(3)}em ${colour.outlineColor}` : "none",
  };
}

function backgroundBase(background: BackgroundConfig, fallback: string): string {
  switch (background.mode) {
    case "solid":
      return background.color;
    case "gradient":
      return background.gradientStart;
    default:
      return fallback;
  }
}

/** The `background` shorthand for the canvas, ready to assign. */
export function backgroundCss(theme: ResolvedTheme): string {
  return theme.backgroundLayers.join(", ");
}
