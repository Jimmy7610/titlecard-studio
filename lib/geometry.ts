/**
 * Transform-blind box geometry.
 *
 * `offsetLeft`, `offsetTop`, `offsetWidth` and `offsetHeight` are layout
 * values: they describe where the browser put a box, and they are deliberately
 * unaffected by any `transform` on it. That is a limitation in most code and
 * the whole point here.
 *
 * Everything this app animates is a transform — characters, words, the rule,
 * the caret. So a layout box *is* the resting frame, read without pausing the
 * timeline, seeking anywhere, or knowing which template is playing. The video
 * exporter uses that to place glyphs it then animates itself, and the overflow
 * check uses it to ask whether the type fits the canvas rather than whether a
 * character is currently mid-flight outside it.
 *
 * The one thing a layout box will not tell you is the layer's own offset,
 * because that is a transform too. `translationOf` reads it back separately.
 */

export type Box = { x: number; y: number; w: number; h: number };

/**
 * An element's layout box, relative to an ancestor.
 *
 * The walk is up the `offsetParent` chain rather than through
 * `getBoundingClientRect`, so no transform anywhere between the two elements
 * contributes. `offsetTop` is an integer, so a deep chain rounds once per step
 * — under a pixel in practice, and well under the scale between a preview and
 * an exported frame.
 */
export function staticRect(el: HTMLElement, root: HTMLElement): Box {
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

/**
 * An element's own translation, in pixels.
 *
 * Only meaningful for an element nothing animates — `.stw-layer`, which carries
 * the position offset and is otherwise left alone. Reading a translate off an
 * element a template is moving would be reading the animation.
 */
export function translationOf(el: HTMLElement): { x: number; y: number } {
  const transform = window.getComputedStyle(el).transform;
  if (!transform || transform === "none") return { x: 0, y: 0 };
  try {
    const matrix = new DOMMatrixReadOnly(transform);
    return { x: matrix.e, y: matrix.f };
  } catch {
    return { x: 0, y: 0 };
  }
}
