/**
 * Static layout capture.
 *
 * The video exporter paints to a 2D canvas, and to do that it needs to know
 * where every glyph sits *before* any transform is applied. That is what
 * `lib/geometry` reads: layout values, unaffected by `transform`. So the
 * geometry is read once, from the browser's own layout — kerning, tracking,
 * font metrics and line breaking all included — and only the animated part is
 * recomputed per frame.
 *
 * Measuring text in canvas instead would mean reimplementing text layout, and
 * getting it subtly wrong for exactly the fonts this app is about.
 */

import { staticRect, translationOf, type Box } from "@/lib/geometry";

export type BoxLayout = Box;

export type CharLayout = BoxLayout & {
  el: HTMLElement;
  glyph: HTMLElement;
  real: HTMLElement;
  text: string;
  isGradient: boolean;
  wordIndex: number;
};

export type WordLayout = BoxLayout & {
  el: HTMLElement;
  flash: (BoxLayout & { el: HTMLElement }) | null;
  /**
   * The clip box, which is not the word box.
   *
   * The word carries the baseline and the word-level type; the mask inside it
   * carries `overflow: hidden`. Painting has to clip to the mask, or a word
   * with a size multiplier would be clipped against a box that is not the one
   * the DOM is clipping against.
   */
  mask: BoxLayout;
  /** Canvas `font` shorthand for every glyph in this word. */
  font: string;
  chars: CharLayout[];
};

export type DecorLayout = BoxLayout & { el: HTMLElement; color: string };

export type LayerLayout = {
  root: HTMLElement;
  words: WordLayout[];
  chars: CharLayout[];
  underline: DecorLayout | null;
  cursor: DecorLayout | null;
  debris: DecorLayout[];
  /** Overflow clipping is the premise of most templates; a few opt out. */
  masked: boolean;
  /**
   * The layer's own displacement, in preview pixels.
   *
   * `offsetLeft`/`offsetTop` are layout values and deliberately blind to
   * transforms — which is what makes them the right way to read glyph
   * positions, and the wrong way to read the layer offset, because that *is* a
   * transform. Reading it separately is what stopped the raster exporters
   * silently dropping Offset X/Y out of every video and PNG.
   */
  offset: { x: number; y: number };
};

export type StageLayout = {
  width: number;
  height: number;
  layers: LayerLayout[];
};

/** The canvas `font` shorthand for an element's computed type. */
function fontOf(el: HTMLElement): string {
  const style = window.getComputedStyle(el);
  const family = style.fontFamily || "sans-serif";
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${family}`;
}

function decor(el: HTMLElement | null, root: HTMLElement): DecorLayout | null {
  if (!el) return null;
  return {
    el,
    ...staticRect(el, root),
    color: window.getComputedStyle(el).backgroundColor,
  };
}

/**
 * Reads the whole stage.
 *
 * Call this with the timeline parked anywhere — the values are layout, not
 * paint, so the frame the preview happens to be on does not matter.
 */
export function captureLayout(canvasEl: HTMLElement): StageLayout {
  const layerRoots = [...canvasEl.querySelectorAll<HTMLElement>("[data-stw-layer]")];

  const layers: LayerLayout[] = layerRoots.map((root) => {
    const chars: CharLayout[] = [];

    const words: WordLayout[] = [...root.querySelectorAll<HTMLElement>(".stw-word")].map(
      (wordEl, wordIndex) => {
        const font = fontOf(wordEl);
        const flashEl = wordEl.querySelector<HTMLElement>(".stw-flash");
        const maskEl = wordEl.querySelector<HTMLElement>(".stw-mask") ?? wordEl;

        const wordChars: CharLayout[] = [
          ...wordEl.querySelectorAll<HTMLElement>(".stw-char"),
        ]
          .map((el) => {
            const glyph = el.querySelector<HTMLElement>(".stw-glyph");
            const real = el.querySelector<HTMLElement>(".stw-real");
            if (!glyph || !real) return null;

            const entry: CharLayout = {
              el,
              glyph,
              real,
              text: real.textContent ?? "",
              isGradient: el.dataset.gradient === "true",
              wordIndex,
              ...staticRect(el, canvasEl),
            };
            chars.push(entry);
            return entry;
          })
          .filter((entry): entry is CharLayout => entry !== null);

        return {
          el: wordEl,
          font,
          chars: wordChars,
          flash: flashEl ? { el: flashEl, ...staticRect(flashEl, canvasEl) } : null,
          mask: staticRect(maskEl, canvasEl),
          ...staticRect(wordEl, canvasEl),
        };
      },
    );

    const display = root.querySelector<HTMLElement>(".stw");

    return {
      root,
      words,
      chars,
      underline: decor(root.querySelector<HTMLElement>(".stw-underline"), canvasEl),
      cursor: decor(root.querySelector<HTMLElement>(".stw-cursor"), canvasEl),
      debris: [...root.querySelectorAll<HTMLElement>(".stw-debris")]
        .map((el) => decor(el, canvasEl))
        .filter((entry): entry is DecorLayout => entry !== null),
      masked: display?.dataset.overflow !== "visible",
      offset: translationOf(root),
    };
  });

  return {
    width: canvasEl.offsetWidth,
    height: canvasEl.offsetHeight,
    layers,
  };
}
