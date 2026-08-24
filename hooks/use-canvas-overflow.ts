"use client";

import * as React from "react";

import type { ExportModel } from "@/lib/export/model";
import { measureCanvasOverflow, sameOverflow, type LayerOverflow } from "@/lib/overflow";

/**
 * Watches whether the type still fits the canvas.
 *
 * Three things make this awkward and each has its own answer.
 *
 * *When to measure.* Anything that changes a box changes the answer: the
 * phrase, the face, weight, size, tracking, leading, per-word multipliers, the
 * canvas format, and the layer's own position. They are folded into one digest
 * below rather than listed as dependencies, because the model is rebuilt on
 * every render and comparing it by identity would measure on every keystroke
 * whether or not anything moved.
 *
 * *Which font.* A phrase measured against the fallback face and never measured
 * again is measured against the wrong metrics — the real face is wider or
 * narrower, and the answer can flip either way. So the measurement is taken
 * again after the faces are ready, and once more after two frames, which is
 * when the stage has committed the layout built against them.
 *
 * *Not fighting itself.* The result is only written to state when the
 * situation has actually changed, so a measurement provoked by a resize cannot
 * schedule a render that provokes another measurement.
 */
export function useCanvasOverflow(
  model: ExportModel,
  root: React.RefObject<HTMLElement | null>,
): LayerOverflow[] {
  const [reports, setReports] = React.useState<LayerOverflow[]>([]);

  const digest = React.useMemo(
    () =>
      JSON.stringify({
        canvas: [model.project.canvas.formatId, model.project.canvas.width, model.project.canvas.height],
        typography: model.project.typography,
        layers: model.layers.map((layer) => [
          layer.layer.text,
          layer.layer.typography,
          layer.layer.wordStyles,
          layer.layer.position,
        ]),
      }),
    [model.project.canvas, model.project.typography, model.layers],
  );

  React.useEffect(() => {
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const canvas = root.current?.querySelector<HTMLElement>(".stw-canvas") ?? null;
      const next = canvas ? measureCanvasOverflow(canvas) : [];
      setReports((previous) => (sameOverflow(previous, next) ? previous : next));
    };

    // Straight away, and then again after a couple of frames.
    //
    // The first pass is the one that has to be synchronous. Reading a layout
    // box flushes pending style and layout, so the answer is accurate here —
    // and `requestAnimationFrame` does not run in a tab that is not
    // compositing, so a warning that waited for a frame would never appear for
    // anyone who set up a composition in a background tab and came back to it.
    // The later passes are refinements, and are allowed to depend on painting.
    measure();

    const afterTwoFrames = (run: () => void) =>
      requestAnimationFrame(() => requestAnimationFrame(run));

    // The stage rebuilds its timeline in a layout effect of its own and paints
    // on the next frame; a per-word multiplier or a face swap can settle a box
    // a frame late. Cheap enough to simply look again.
    const frame = afterTwoFrames(measure);

    // `document.fonts.ready` resolves for the whole document, so it also waits
    // on a face requested by some other part of the page. Worth it: measuring a
    // phrase against the fallback and never again is the difference between
    // warning about metrics nobody will see and warning about the export.
    void (document.fonts ? document.fonts.ready : Promise.resolve())
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        measure();
        afterTwoFrames(measure);
      });

    // The canvas is laid out at a real pixel width rather than scaled, so a
    // zoom really does re-lay-out the type. Sizes are canvas-relative and the
    // answer should not change — observing it is how that stays true rather
    // than being assumed.
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [digest, root]);

  return reports;
}
