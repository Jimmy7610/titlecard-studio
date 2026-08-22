/**
 * Static layout capture.
 *
 * The video exporter paints to a 2D canvas, and to do that it needs to know
 * where every glyph sits *before* any transform is applied. `offsetLeft` and
 * `offsetTop` are exactly that: layout values, unaffected by `transform`. So
 * the geometry is read once, from the browser's own layout — kerning, tracking,
 * font metrics and line breaking all included — and only the animated part is
 * recomputed per frame.
 *
 * Measuring text in canvas instead would mean reimplementing text layout, and
 * getting it subtly wrong for exactly the fonts this app is about.
 */

export type BoxLayout = { x: number; y: number; w: number; h: number };

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
};

export type StageLayout = {
  width: number;
  height: number;
  layers: LayerLayout[];
};

/** Position of `el` relative to `root`, ignoring every transform on the way. */
function staticRect(el: HTMLElement, root: HTMLElement): BoxLayout {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;

  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }

  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

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
    };
  });

  return {
    width: canvasEl.offsetWidth,
    height: canvasEl.offsetHeight,
    layers,
  };
}
