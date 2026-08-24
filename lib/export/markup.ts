import { DEBRIS } from "@/lib/debris";
import { layerVars } from "@/lib/export/css";
import type { LayerModel } from "@/lib/export/model";
import type { WordStyle } from "@/lib/types";

/**
 * The split markup, in the two shapes the exporters need.
 *
 * Both are generated from the same `LayerModel`, which already holds the
 * grapheme-segmented, case-transformed phrase — so the React export animates
 * exactly the units the preview animated, rather than re-deriving them from a
 * string at runtime and hoping the two agree about emoji.
 */

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Per-word styling, as CSS declarations. */
export function wordStyleVars(style: WordStyle | undefined): Record<string, string> {
  if (!style) return {};
  const vars: Record<string, string> = {};

  if (style.color) vars.color = style.color;
  if (style.weight) vars["font-weight"] = String(style.weight);
  // Scaling by font-size rather than transform keeps the mask box in
  // proportion — a transform would scale the glyph out of its own clip.
  if (style.scale && style.scale !== 1) vars["font-size"] = `${style.scale}em`;
  if (style.opacity !== undefined && style.opacity !== 1) vars.opacity = String(style.opacity);
  if (style.glow) {
    vars["text-shadow"] = `0 0 ${(style.glow * 0.9).toFixed(3)}em currentColor, 0 0 ${(
      style.glow * 2
    ).toFixed(3)}em currentColor`;
  }
  if (style.emphasis === "pop" && !style.scale) vars["font-size"] = "1.12em";

  return vars;
}

/**
 * A `style` attribute body, escaped.
 *
 * Not optional: the font stack is quoted (`"Outfit", sans-serif`), and writing
 * it raw closed the attribute early — which silently dropped the font, size,
 * weight, tracking, leading and alignment from every standalone export.
 */
export const declarationsAttr = (vars: Record<string, string>): string =>
  escapeHtml(
    Object.entries(vars)
      .map(([key, value]) => `${key}:${value}`)
      .join(";"),
  );

/**
 * The join between two inline-level elements in pretty-printed markup.
 *
 * A newline between two inline-block spans is collapsible whitespace, and it
 * renders — so the printed markup set every character a space apart and every
 * word three, while the editor (whose JSX carries no whitespace between the
 * same spans) set them flush. The comment swallows the break, so the file stays
 * readable and the two renderers lay out identically.
 */
const seam = (indent: string) => `<!--\n${indent}-->`;

/**
 * The same declarations, keyed the way React wants them.
 *
 * `wordStyleVars` speaks CSS because the HTML exporter prints CSS. React does
 * not: handing it `font-size` logs "Unsupported style property" on every styled
 * word — in the editor and, worse, inside the component this app generates.
 */
export function wordStyleProps(style: WordStyle | undefined): Record<string, string> {
  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(wordStyleVars(style))) {
    props[key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value;
  }
  return props;
}

const styleAttr = (vars: Record<string, string>): string => {
  const entries = Object.entries(vars);
  if (!entries.length) return "";
  return ` style="${declarationsAttr(vars)}"`;
};

/* ------------------------------------------------------------------ *
 * HTML
 * ------------------------------------------------------------------ */

export function layerMarkup(model: LayerModel, indent: string): string {
  const pad = (depth: number) => indent + "  ".repeat(depth);
  const { split, layer, template } = model;

  const lastLine = split.lines.length - 1;

  const lines = split.lines
    .map((line, lineIndex) => {
      const words = line.words
        .map((word, wordIndex) => {
          const style = layer.wordStyles[word.index];
          const gradientWord = style?.gradient ? ' data-gradient="true"' : "";

          const chars = word.characters
            .map(
              (character) =>
                `<span class="stw-char"${
                  character.isGradient || style?.gradient ? ' data-gradient="true"' : ""
                } data-index="${character.globalIndex}" data-word="${word.index}"><span class="stw-glyph"></span><span class="stw-real">${escapeHtml(
                  character.char,
                )}</span></span>`,
            )
            .join(seam(pad(4)));

          const space =
            wordIndex < line.words.length - 1
              ? `${seam(pad(3))}<span class="stw-space"> </span>`
              : "";

          // The mask is a separate box from the word: the word carries the
          // baseline and the word-level typography, the mask carries the clip.
          return `<span class="stw-word" data-word-index="${word.index}"${styleAttr(
            wordStyleVars(style),
          )}${gradientWord}><span class="stw-mask"><span class="stw-flash"></span>${seam(
            pad(4),
          )}${chars}</span></span>${space}`;
        })
        .join(seam(pad(3)));

      // The caret belongs inside the last line. As a sibling of the line
      // blocks it would open a line box of its own, parking it under the
      // phrase and stretching the block past its own descent.
      const caret =
        template.showCursor && lineIndex === lastLine
          ? `${seam(pad(3))}<span class="stw-cursor"></span>`
          : "";

      return `${pad(2)}<span class="stw-line">${seam(pad(3))}${words}${caret}</span>`;
    })
    .join("\n");

  const debris = DEBRIS.map(
    (particle) =>
      `${pad(2)}<span class="stw-debris" data-tone="${particle.tone}" style="left:${
        particle.left
      }%;top:${particle.top}%;width:${particle.size}em;height:${particle.size}em"></span>`,
  ).join("\n");

  const vars = declarationsAttr(layerVars(model));

  return `${indent}<div class="stw-layer" data-stw-layer="${model.index}" style="${vars}">
${pad(1)}<span class="stw" data-stw-scope${
    template.unmasked ? ' data-overflow="visible"' : ""
  }${split.profile.rtl ? ' dir="rtl"' : ""}>
${pad(2)}<span class="stw-sr">${escapeHtml(layer.text)}</span>
${pad(2)}<span class="stw-visual" aria-hidden="true">
${lines}
${pad(2)}<span class="stw-underline"></span>
${debris}
${pad(2)}</span>
${pad(1)}</span>
${indent}</div>`;
}

/* ------------------------------------------------------------------ *
 * React data
 * ------------------------------------------------------------------ */

export type SerialisedChar = { c: string; g: boolean; i: number; w: number };
export type SerialisedWord = {
  chars: SerialisedChar[];
  style: Record<string, string>;
  gradient: boolean;
  index: number;
};
export type SerialisedLayer = {
  index: number;
  text: string;
  rtl: boolean;
  unmasked: boolean;
  cursor: boolean;
  vars: Record<string, string>;
  lines: SerialisedWord[][];
};

export function layerData(model: LayerModel): SerialisedLayer {
  const { split, layer, template } = model;

  return {
    index: model.index,
    text: layer.text,
    rtl: split.profile.rtl,
    unmasked: template.unmasked === true,
    cursor: template.showCursor,
    vars: layerVars(model),
    lines: split.lines.map((line) =>
      line.words.map((word) => {
        const style = layer.wordStyles[word.index];
        return {
          index: word.index,
          gradient: style?.gradient === true,
          style: wordStyleProps(style),
          chars: word.characters.map((character) => ({
            c: character.char,
            g: character.isGradient || style?.gradient === true,
            i: character.globalIndex,
            w: word.index,
          })),
        };
      }),
    ),
  };
}

/** Debris, in the compact shape the React export embeds. */
export const DEBRIS_DATA = DEBRIS.map((particle) => ({
  l: particle.left,
  t: particle.top,
  s: particle.size,
  c: particle.tone,
}));
