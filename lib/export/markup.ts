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

const styleAttr = (vars: Record<string, string>): string => {
  const entries = Object.entries(vars);
  if (!entries.length) return "";
  return ` style="${entries.map(([key, value]) => `${key}:${value}`).join(";")}"`;
};

/* ------------------------------------------------------------------ *
 * HTML
 * ------------------------------------------------------------------ */

export function layerMarkup(model: LayerModel, indent: string): string {
  const pad = (depth: number) => indent + "  ".repeat(depth);
  const { split, layer, template } = model;

  const lines = split.lines
    .map((line) => {
      const words = line.words
        .map((word, wordIndex) => {
          const style = layer.wordStyles[word.index];
          const gradientWord = style?.gradient ? ' data-gradient="true"' : "";

          const chars = word.characters
            .map(
              (character) =>
                `${pad(4)}<span class="stw-char"${
                  character.isGradient || style?.gradient ? ' data-gradient="true"' : ""
                } data-index="${character.globalIndex}" data-word="${word.index}"><span class="stw-glyph"></span><span class="stw-real">${escapeHtml(
                  character.char,
                )}</span></span>`,
            )
            .join("\n");

          const space =
            wordIndex < line.words.length - 1
              ? `\n${pad(3)}<span class="stw-space"> </span>`
              : "";

          return `${pad(3)}<span class="stw-word" data-word-index="${word.index}"${styleAttr(
            wordStyleVars(style),
          )}${gradientWord}>\n${pad(4)}<span class="stw-flash"></span>\n${chars}\n${pad(
            3,
          )}</span>${space}`;
        })
        .join("\n");

      return `${pad(2)}<span class="stw-line">\n${words}\n${pad(2)}</span>`;
    })
    .join("\n");

  const cursor = template.showCursor ? `\n${pad(2)}<span class="stw-cursor"></span>` : "";
  const debris = DEBRIS.map(
    (particle) =>
      `${pad(2)}<span class="stw-debris" data-tone="${particle.tone}" style="left:${
        particle.left
      }%;top:${particle.top}%;width:${particle.size}em;height:${particle.size}em"></span>`,
  ).join("\n");

  const vars = Object.entries(layerVars(model))
    .map(([key, value]) => `${key}:${value}`)
    .join(";");

  return `${indent}<div class="stw-layer" data-stw-layer="${model.index}" style="${vars}">
${pad(1)}<span class="stw" data-stw-scope${
    template.unmasked ? ' data-overflow="visible"' : ""
  }${split.profile.rtl ? ' dir="rtl"' : ""}>
${pad(2)}<span class="stw-sr">${escapeHtml(layer.text)}</span>
${pad(2)}<span class="stw-visual" aria-hidden="true">
${lines}${cursor}
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
          style: wordStyleVars(style),
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
