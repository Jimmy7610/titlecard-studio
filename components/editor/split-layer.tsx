"use client";

import * as React from "react";

import { DEBRIS } from "@/lib/debris";
import { layerVars } from "@/lib/export/css";
import { wordStyleVars } from "@/lib/export/markup";
import type { LayerModel } from "@/lib/export/model";

/**
 * Renders the structure every template animates against:
 *
 *   div.stw-layer          -> position and per-layer typography
 *     span.stw             -> the type scope
 *       span.stw-visual
 *         span.stw-line
 *           span.stw-word  -> overflow: hidden (the mask box, one per word)
 *             span.stw-flash
 *             span.stw-char
 *               span.stw-glyph -> scramble overlay, absolute
 *               span.stw-real  -> the real text, always holds the layout
 *
 * The markup is deliberately identical to what `lib/export/markup` prints, down
 * to the data attributes, because the exported file has to animate against the
 * same shape the preview does.
 *
 * The split spans are hidden from assistive tech and the untouched phrase is
 * exposed once via `.stw-sr`, so a screen reader announces "MOTION STUDIO"
 * rather than thirteen disconnected letters.
 */
export function SplitLayer({ model }: { model: LayerModel }) {
  const { split, layer, template } = model;
  const vars = layerVars(model) as React.CSSProperties;

  return (
    <div
      className="stw-layer"
      data-stw-layer={model.index}
      style={vars}
    >
      <span
        className="stw"
        data-stw-scope=""
        data-overflow={template.unmasked ? "visible" : undefined}
        dir={split.profile.rtl ? "rtl" : undefined}
      >
        <span className="stw-sr">{layer.text}</span>

        <span className="stw-visual" aria-hidden="true">
          {split.lines.map((line) => (
            <span className="stw-line" key={line.key}>
              {line.words.map((word, wordIndex) => {
                const style = layer.wordStyles[word.index];
                return (
                  <React.Fragment key={word.key}>
                    <span
                      className="stw-word"
                      data-word-index={word.index}
                      style={wordStyleVars(style) as React.CSSProperties}
                    >
                      <span className="stw-flash" data-stw-flash />
                      {word.characters.map((character) => (
                        <span
                          key={character.key}
                          className="stw-char"
                          data-stw-char
                          data-index={character.globalIndex}
                          data-word={word.index}
                          data-gradient={
                            character.isGradient || style?.gradient ? "true" : undefined
                          }
                        >
                          <span className="stw-glyph" data-stw-glyph />
                          <span className="stw-real" data-stw-real>
                            {character.char}
                          </span>
                        </span>
                      ))}
                    </span>
                    {wordIndex < line.words.length - 1 ? (
                      <span className="stw-space"> </span>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </span>
          ))}

          {template.showCursor ? <span className="stw-cursor" data-stw-cursor /> : null}
          <span className="stw-underline" data-stw-underline />

          {DEBRIS.map((particle) => (
            <span
              key={particle.key}
              data-stw-debris
              data-tone={particle.tone}
              className="stw-debris"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                width: `${particle.size}em`,
                height: `${particle.size}em`,
              }}
            />
          ))}
        </span>
      </span>
    </div>
  );
}
