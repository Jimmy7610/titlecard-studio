import { gsap } from "@/lib/gsap";
import type { BoxLayout, CharLayout, LayerLayout, StageLayout } from "@/lib/video/layout";
import type { ProjectState } from "@/lib/types";
import type { ResolvedTheme } from "@/lib/theme";

/**
 * Paints one timeline frame onto a 2D canvas.
 *
 * The animated state is read back off the live DOM — the same elements the
 * preview is animating, after the timeline has been seeked — so the recording
 * follows the real GSAP timeline rather than a second implementation of it.
 * The static half comes from `captureLayout`.
 *
 * Known differences from the DOM preview, all of them deliberate rather than
 * accidental, and all surfaced in the export panel:
 *   - film grain is not painted (it is a blend-mode overlay)
 *   - gradient-filled glyphs get a per-glyph gradient rather than one spanning
 *     the whole line
 *   - CSS filters other than `blur` are ignored
 */

export type PaintOptions = {
  layout: StageLayout;
  theme: ResolvedTheme;
  project: ProjectState;
  /** Canvas pixels per layout pixel. */
  scale: number;
  /** The output frame in layout units — the canvas, letterboxed to fit. */
  frame: { width: number; height: number; offsetX: number; offsetY: number };
  /** Leave the canvas unpainted where the project is transparent. */
  alpha: boolean;
};

type Num = (el: Element, property: string) => number;
const numberOf: Num = (el, property) => {
  const value = gsap.getProperty(el, property);
  return typeof value === "number" ? value : Number.parseFloat(String(value)) || 0;
};

const stringOf = (el: Element, property: string): string =>
  String(gsap.getProperty(el, property) ?? "");

/** `inset(t% r% b% l%)` → a rect inside the box, or null when there is no clip. */
function insetClip(value: string, box: BoxLayout): BoxLayout | null {
  const match = /inset\(([^)]+)\)/.exec(value);
  if (!match) return null;

  const parts = match[1]
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseFloat(part) || 0);
  if (parts.length === 0) return null;

  const [top, right = top, bottom = top, left = right] = parts;
  const isPercent = match[1].includes("%");

  const t = isPercent ? (top / 100) * box.h : top;
  const r = isPercent ? (right / 100) * box.w : right;
  const b = isPercent ? (bottom / 100) * box.h : bottom;
  const l = isPercent ? (left / 100) * box.w : left;

  return { x: box.x + l, y: box.y + t, w: Math.max(0, box.w - l - r), h: Math.max(0, box.h - t - b) };
}

function blurRadius(value: string): number {
  const match = /blur\(([\d.]+)px\)/.exec(value);
  return match ? Number.parseFloat(match[1]) : 0;
}

/**
 * The pixel size out of a canvas `font` shorthand.
 *
 * `parseFloat("normal 600 56px Outfit")` is NaN, so reading the size that way
 * silently fell back to a constant — which made the outline one pixel wide and
 * the glow one fixed radius, whatever the type was actually set at.
 */
function fontSizeOf(font: string): number {
  const match = /(\d*\.?\d+)px/.exec(font);
  return match ? Number.parseFloat(match[1]) : 0;
}

function clipTo(ctx: CanvasRenderingContext2D, box: BoxLayout) {
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
}

/** The transform GSAP has put on a character, as a canvas matrix application. */
function applyCharTransform(
  ctx: CanvasRenderingContext2D,
  char: CharLayout,
): void {
  const x = numberOf(char.el, "x") + (numberOf(char.el, "xPercent") / 100) * char.w;
  const y = numberOf(char.el, "y") + (numberOf(char.el, "yPercent") / 100) * char.h;
  const rotation = numberOf(char.el, "rotation");
  const scaleX = numberOf(char.el, "scaleX") || 1;
  const scaleY = numberOf(char.el, "scaleY") || 1;
  const skewX = numberOf(char.el, "skewX");

  // transform-origin is authored per template; read it rather than assuming.
  const origin = stringOf(char.el, "transformOrigin") || "0% 100%";
  const [ox = "0%", oy = "100%"] = origin.split(/\s+/);
  const originX = ox.endsWith("%") ? (Number.parseFloat(ox) / 100) * char.w : Number.parseFloat(ox) || 0;
  const originY = oy.endsWith("%") ? (Number.parseFloat(oy) / 100) * char.h : Number.parseFloat(oy) || 0;

  ctx.translate(char.x + x + originX, char.y + y + originY);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);
  if (skewX) ctx.transform(1, 0, Math.tan((skewX * Math.PI) / 180), 1, 0, 0);
  if (scaleX !== 1 || scaleY !== 1) ctx.scale(scaleX, scaleY);
  ctx.translate(-originX, -originY);
}

function fillFor(
  ctx: CanvasRenderingContext2D,
  char: CharLayout,
  theme: ResolvedTheme,
  colour: string,
): string | CanvasGradient {
  if (!char.isGradient) return colour;

  // The line-wide CSS gradient is approximated per glyph. Documented, and much
  // closer than dropping the treatment entirely.
  const gradient = ctx.createLinearGradient(0, char.h, char.w, 0);
  gradient.addColorStop(0, theme.hot);
  gradient.addColorStop(0.54, theme.warm);
  gradient.addColorStop(1, theme.sun);
  return gradient;
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  options: PaintOptions,
  image: HTMLImageElement | null,
): void {
  const { theme, project, alpha, frame } = options;
  // The frame, not the canvas: exporting a 16:9 project at 1080x1920 used to
  // leave everything outside the canvas' own aspect unpainted, so the clip came
  // out with a transparent band across it.
  const { width, height } = frame;

  ctx.clearRect(0, 0, width, height);
  if (theme.transparent && alpha) return;

  const background = project.background;

  if (background.mode === "gradient") {
    const angle = ((background.gradientAngle - 90) * Math.PI) / 180;
    const radius = Math.max(width, height);
    const gradient = ctx.createLinearGradient(
      width / 2 - Math.cos(angle) * radius / 2,
      height / 2 - Math.sin(angle) * radius / 2,
      width / 2 + Math.cos(angle) * radius / 2,
      height / 2 + Math.sin(angle) * radius / 2,
    );
    gradient.addColorStop(0, background.gradientStart);
    gradient.addColorStop(1, background.gradientEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else if (background.mode === "image" && image) {
    const ratio = Math.max(width / image.width, height / image.height);
    const fit = background.imageFit === "contain" ? Math.min(width / image.width, height / image.height) : ratio;
    const w = image.width * fit;
    const h = image.height * fit;
    ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
  } else if (!theme.transparent) {
    ctx.fillStyle = background.mode === "solid" ? background.color : theme.canvas;
    ctx.fillRect(0, 0, width, height);
  }

  if (background.noise > 0) {
    const cloud = ctx.createRadialGradient(
      width * 0.2, 0, 0,
      width * 0.2, 0, Math.max(width, height),
    );
    cloud.addColorStop(0, theme.hot);
    cloud.addColorStop(0.6, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalAlpha = background.noise * 0.22;
    ctx.fillStyle = cloud;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  if (background.grid > 0) {
    ctx.save();
    ctx.globalAlpha = background.grid * 0.22;
    ctx.strokeStyle = "rgb(128,128,128)";
    ctx.lineWidth = 1;
    const step = 48;
    ctx.beginPath();
    for (let x = 0; x <= width; x += step) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    for (let y = 0; y <= height; y += step) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  if (background.glow > 0) {
    const glow = ctx.createRadialGradient(
      width / 2, height * 0.42, 0,
      width / 2, height * 0.42, Math.max(width, height) * 0.6,
    );
    glow.addColorStop(0, theme.hot);
    glow.addColorStop(0.72, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalAlpha = background.glow * 0.45;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  if (background.vignette > 0) {
    const vignette = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.28,
      width / 2, height / 2, Math.max(width, height) * 0.72,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, `rgba(0,0,0,${background.vignette.toFixed(2)})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }
}

function paintLayer(
  ctx: CanvasRenderingContext2D,
  layer: LayerLayout,
  options: PaintOptions,
): void {
  const { theme, project } = options;
  const textOpacity = project.color.opacity;

  // The layer's own displacement. Every box below is a layout position, which
  // is blind to the transform that carries this, so it is applied once here.
  ctx.save();
  ctx.translate(layer.offset.x, layer.offset.y);

  for (const word of layer.words) {
    ctx.save();
    // The mask box, not the word box: the word is the layout box and the mask
    // inside it is what carries overflow: hidden. Clipping to the word would
    // clip a size-multiplied word against the wrong rectangle.
    if (layer.masked) clipTo(ctx, word.mask);

    if (word.flash) {
      const opacity = numberOf(word.flash.el, "opacity");
      if (opacity > 0.001) {
        const clip = insetClip(stringOf(word.flash.el, "clipPath"), word.flash);
        ctx.save();
        if (clip) clipTo(ctx, clip);
        ctx.globalAlpha = opacity;
        const background = window.getComputedStyle(word.flash.el).backgroundImage;
        if (background && background !== "none") {
          const gradient = ctx.createLinearGradient(word.x, 0, word.x + word.w, 0);
          gradient.addColorStop(0, theme.hot);
          gradient.addColorStop(0.54, theme.warm);
          gradient.addColorStop(1, theme.sun);
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = theme.hot;
        }
        ctx.fillRect(word.flash.x, word.flash.y, word.flash.w, word.flash.h);
        ctx.restore();
      }
    }

    ctx.font = word.font;
    const metrics = ctx.measureText("Hxg");
    const ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent;

    for (const char of word.chars) {
      const opacity = numberOf(char.el, "opacity") * textOpacity;
      if (opacity <= 0.001) continue;

      // A scramble is running when the overlay is visible; the real glyph
      // underneath is still holding the layout, exactly as in the DOM.
      const glyphVisible = numberOf(char.glyph, "opacity") > 0.01;
      const text = glyphVisible ? char.glyph.textContent || "" : char.text;
      if (!text) continue;

      const source = glyphVisible ? char.glyph : char.real;
      const colour = window.getComputedStyle(glyphVisible ? char.glyph : char.el).color;

      ctx.save();
      ctx.globalAlpha = Math.min(1, opacity);

      const clip = insetClip(stringOf(char.el, "clipPath"), char);
      if (clip) clipTo(ctx, clip);

      const blur = blurRadius(stringOf(char.el, "filter"));
      if (blur > 0) ctx.filter = `blur(${blur}px)`;

      applyCharTransform(ctx, char);

      // Half-leading: the CSS baseline sits centred in the line box.
      const baseline = (char.h - (ascent + descent)) / 2 + ascent;
      // The scramble overlay is centred in its slot; the real glyph is not.
      const offsetY = glyphVisible ? (numberOf(source, "yPercent") / 100) * char.h : 0;

      ctx.textBaseline = "alphabetic";
      ctx.textAlign = glyphVisible ? "center" : "left";
      const drawX = glyphVisible ? char.w / 2 : 0;

      const fontSize = fontSizeOf(word.font) || 40;

      if (theme.textStroke !== "none" && project.color.outline > 0) {
        const [widthEm, strokeColour] = theme.textStroke.split(" ");
        ctx.lineWidth = Math.max(0.5, Number.parseFloat(widthEm) * fontSize);
        ctx.strokeStyle = strokeColour ?? "#000";
        ctx.strokeText(text, drawX, baseline + offsetY);
      }

      if (project.color.glow > 0) {
        ctx.shadowColor = project.color.glowColor;
        ctx.shadowBlur = project.color.glow * fontSize;
      }

      ctx.fillStyle = fillFor(ctx, char, theme, colour);
      ctx.fillText(text, drawX, baseline + offsetY);
      ctx.restore();
    }

    ctx.restore();
  }

  if (layer.underline) {
    const scaleX = numberOf(layer.underline.el, "scaleX");
    const opacity = numberOf(layer.underline.el, "opacity");
    if (scaleX > 0.001 && opacity > 0.001) {
      const origin = stringOf(layer.underline.el, "transformOrigin") || "0% 50%";
      const fromRight = origin.startsWith("100");
      const width = layer.underline.w * scaleX;
      const x = fromRight ? layer.underline.x + layer.underline.w - width : layer.underline.x;

      const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
      gradient.addColorStop(0, theme.hot);
      gradient.addColorStop(0.54, theme.warm);
      gradient.addColorStop(1, theme.sun);

      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = gradient;
      ctx.fillRect(x, layer.underline.y, width, Math.max(1, layer.underline.h));
      ctx.restore();
    }
  }

  if (layer.cursor) {
    const opacity = numberOf(layer.cursor.el, "opacity");
    if (opacity > 0.001) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = theme.hot;
      ctx.fillRect(layer.cursor.x, layer.cursor.y, layer.cursor.w, layer.cursor.h);
      ctx.restore();
    }
  }

  for (const particle of layer.debris) {
    const opacity = numberOf(particle.el, "opacity");
    if (opacity <= 0.001) continue;
    const scale = numberOf(particle.el, "scaleX") || 1;
    const w = particle.w * scale;
    const h = particle.h * scale;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = particle.color || theme.hot;
    ctx.fillRect(
      particle.x + (particle.w - w) / 2,
      particle.y + (particle.h - h) / 2,
      w,
      h,
    );
    ctx.restore();
  }

  ctx.restore();
}

export function paintFrame(
  ctx: CanvasRenderingContext2D,
  options: PaintOptions,
  image: HTMLImageElement | null = null,
): void {
  const { scale, frame } = options;

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  paintBackground(ctx, options, image);
  // The layout is measured from the canvas' own origin, so the letterbox
  // offset is applied once here rather than added to every box.
  ctx.translate(frame.offsetX, frame.offsetY);
  for (const layer of options.layout.layers) paintLayer(ctx, layer, options);
  ctx.restore();
}
