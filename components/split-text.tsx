"use client";

import * as React from "react";

import { useSplitText } from "@/hooks/use-split-text";
import { cn } from "@/lib/utils";

export type SplitTextProps = {
  text: string;
  /** Reserves inline space for the block cursor. Terminal templates only. */
  showCursor?: boolean;
  className?: string;
};

/**
 * Renders the nested structure every template animates against:
 *
 *   span.stw-word      -> overflow: hidden  (the mask box, one per word)
 *     span.stw-flash   -> colour slab, behind the glyphs
 *     span.stw-char    -> the transformed element, one per character
 *       span.stw-glyph -> absolute overlay the scramble templates write into
 *       span.stw-real  -> the actual character, always holding the layout
 *
 * Because the mask is the word's own box, a character can never be seen outside
 * the footprint the finished word occupies. And because `.stw-real` never
 * leaves the flow, substituting a wide glyph during a decode cannot reflow the
 * line — the overlay is painted on top of a slot that is already the right size.
 *
 * The split spans are hidden from assistive tech and the untouched phrase is
 * exposed once via `sr-only`, so screen readers announce "Agent 3" rather than
 * seven disconnected letters.
 */
export function SplitText({ text, showCursor = false, className }: SplitTextProps) {
  const { words } = useSplitText(text);

  return (
    <span className={cn("stw", className)}>
      <span className="sr-only">{text}</span>

      <span className="stw-visual" aria-hidden="true">
        {words.map((word, index) => (
          <React.Fragment key={word.key}>
            <span className="stw-word" data-stw-word data-word-index={word.index}>
              <span className="stw-flash" data-stw-flash />
              {word.characters.map((character) => (
                <span
                  key={character.key}
                  className="stw-char"
                  data-stw-char
                  data-index={character.globalIndex}
                  data-gradient={character.isGradient ? "true" : undefined}
                >
                  <span className="stw-glyph" data-stw-glyph />
                  <span className="stw-real" data-stw-real>
                    {character.char}
                  </span>
                </span>
              ))}
            </span>
            {index < words.length - 1 ? (
              <span className="stw-space"> </span>
            ) : null}
          </React.Fragment>
        ))}

        {showCursor ? <span className="stw-cursor" data-stw-cursor /> : null}
      </span>
    </span>
  );
}
