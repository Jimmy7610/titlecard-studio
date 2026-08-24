import { staticRect, translationOf } from "@/lib/geometry";

/**
 * Does the type still fit on the canvas?
 *
 * Font size is deliberately canvas-relative (`cqw`), so a long phrase at a
 * large size is wider than the canvas and `overflow: hidden` cuts it. That is
 * the size control doing exactly what it says — the problem was only that
 * nothing said so at the moment it happened.
 *
 * So this reports, and nothing here resizes anything. Auto-shrinking would
 * fight a control the user set on purpose, and would do it invisibly.
 *
 * ## Why this measures layout rather than what is on screen
 *
 * Almost every template starts its characters outside the canvas — that is
 * what the reveal is. Reading rectangles off a running composition would warn
 * about every project for the first second and then stop, which is worse than
 * not warning at all.
 *
 * `lib/geometry` reads layout boxes instead. A layout box ignores transforms,
 * and transforms are the entire animation, so the measurement is of the
 * resting frame whatever the playhead is doing and whichever template is
 * loaded. The timeline is never paused or seeked to take it.
 *
 * ## What is measured
 *
 * The text block of each layer: the box the phrase occupies once it has
 * wrapped, at the size, weight, tracking and leading in force, including any
 * per-word size multiplier — those are `font-size`, so they are in the layout.
 * The layer's position offset is added back, because that is a transform and
 * therefore invisible to a layout box.
 *
 * The rule and the caret are not included. Both are absolutely positioned and
 * both are drawn only by the templates that use them, so a box for them exists
 * whether or not anything will be painted in it.
 */

/** How far one layer's type reaches past the canvas, in percent of the canvas. */
export type LayerOverflow = {
  /** Position in the stage's layer order, which is the order of the model. */
  index: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  horizontal: boolean;
  vertical: boolean;
};

/**
 * How far past the edge counts as past the edge, in percent of the canvas.
 *
 * Not zero: `offsetTop` is an integer, so a box measured through a chain of
 * them can land a fraction of a pixel either side of the edge it is flush
 * against. A quarter of a percent is about three pixels of a 1080-tall frame —
 * below what anyone would call a clipped letter, and comfortably above the
 * rounding.
 */
const TOLERANCE = 0.25;

/** Measures every layer currently on the stage. Never throws; never mutates. */
export function measureCanvasOverflow(canvasEl: HTMLElement): LayerOverflow[] {
  const width = canvasEl.offsetWidth;
  const height = canvasEl.offsetHeight;
  if (width <= 0 || height <= 0) return [];

  const reports: LayerOverflow[] = [];

  const layers = canvasEl.querySelectorAll<HTMLElement>("[data-stw-layer]");
  layers.forEach((layerEl, index) => {
    const block = layerEl.querySelector<HTMLElement>(".stw");
    if (!block) return;

    const box = staticRect(block, canvasEl);
    // The offset is a transform on the layer, so the layout box below it knows
    // nothing about it. Added back, or a layer nudged off the canvas would be
    // measured where it would have been had it not been nudged.
    const shift = translationOf(layerEl);
    const x = box.x + shift.x;
    const y = box.y + shift.y;

    const past = {
      left: (-x / width) * 100,
      right: ((x + box.w - width) / width) * 100,
      top: (-y / height) * 100,
      bottom: ((y + box.h - height) / height) * 100,
    };

    const horizontal = past.left > TOLERANCE || past.right > TOLERANCE;
    const vertical = past.top > TOLERANCE || past.bottom > TOLERANCE;
    if (!horizontal && !vertical) return;

    reports.push({
      index,
      left: Math.max(0, past.left),
      right: Math.max(0, past.right),
      top: Math.max(0, past.top),
      bottom: Math.max(0, past.bottom),
      horizontal,
      vertical,
    });
  });

  return reports;
}

/** Two reports describe the same situation. Used to avoid pointless re-renders. */
export function sameOverflow(a: LayerOverflow[], b: LayerOverflow[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      other.index === entry.index &&
      other.horizontal === entry.horizontal &&
      other.vertical === entry.vertical
    );
  });
}

/**
 * The sentence shown under the canvas, and read out to a screen reader.
 *
 * Names the layer when it can, because "something is off the canvas" is not
 * actionable in a composition with four of them.
 */
export function overflowMessage(reports: LayerOverflow[], names: readonly string[]): string {
  if (reports.length === 0) return "";

  const nameOf = (index: number) => {
    const name = names[index]?.trim();
    return name ? `“${name}”` : `Layer ${index + 1}`;
  };

  if (reports.length === 1) {
    const [only] = reports;
    const axis = only.horizontal
      ? only.vertical
        ? "wider and taller than"
        : "wider than"
      : "taller than";
    return `${nameOf(only.index)} is ${axis} the canvas, so it will be cut off here and in every export.`;
  }

  const list = reports.map((report) => nameOf(report.index)).join(", ");
  return `${reports.length} layers reach past the canvas — ${list} — so they will be cut off here and in every export.`;
}
