"use client";

import * as React from "react";
import { MaximizeIcon, MinusIcon, PlusIcon } from "lucide-react";

import { Stage, type StageHandle } from "@/components/editor/stage";
import { Button } from "@/components/ui/button";
import { getCanvasFormat } from "@/lib/canvas-formats";
import type { ExportModel } from "@/lib/export/model";
import { cn } from "@/lib/utils";

/**
 * The preview viewport.
 *
 * The canvas is laid out at a real pixel width rather than scaled with a CSS
 * transform. That matters: the display size is expressed in `cqw` against the
 * canvas, so laying it out at its true proportion means the preview measures
 * type exactly the way an export will, at any zoom.
 */

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];

export type CanvasViewportProps = {
  model: ExportModel;
  reduceMotion: boolean;
  onReady?: (duration: number) => void;
  stageRef?: React.Ref<StageHandle>;
};

export function CanvasViewport({
  model,
  reduceMotion,
  onReady,
  stageRef,
}: CanvasViewportProps) {
  const frame = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ width: 0, height: 0 });
  /** `null` means "fit"; a number is an explicit zoom the user asked for. */
  const [zoom, setZoom] = React.useState<number | null>(null);

  const { canvas, safeZones } = {
    canvas: model.project.canvas,
    safeZones: model.project.canvas.safeZones,
  };

  React.useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;

    const measure = (width: number, height: number) =>
      setBox((previous) =>
        Math.abs(previous.width - width) < 1 &&
        Math.abs(previous.height - height) < 1
          ? previous
          : { width, height },
      );

    // Measured up front rather than waiting for the observer's first delivery.
    // ResizeObserver callbacks ride the rendering lifecycle, so a pane that is
    // not compositing — a background tab, a hidden container — never delivers
    // one, and the canvas would simply never appear.
    const rect = node.getBoundingClientRect();
    measure(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      measure(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fitScale = React.useMemo(() => {
    if (box.width === 0 || box.height === 0) return 0;
    const padding = 48;
    return Math.max(
      0.02,
      Math.min(
        (box.width - padding) / canvas.width,
        (box.height - padding) / canvas.height,
      ),
    );
  }, [box, canvas.width, canvas.height]);

  // Falls back to a readable width if the frame has not been measured at all,
  // so the preview is never a blank rectangle waiting on a measurement.
  const scale = zoom ?? (fitScale || 720 / canvas.width);
  const displayWidth = Math.max(80, canvas.width * scale);
  const format = getCanvasFormat(canvas.formatId);
  const safe = safeZones ? format?.safe : undefined;

  const stepZoom = (direction: 1 | -1) => {
    const current = scale;
    const candidates = direction === 1 ? ZOOM_STEPS : [...ZOOM_STEPS].reverse();
    const next = candidates.find((step) =>
      direction === 1 ? step > current + 0.001 : step < current - 0.001,
    );
    setZoom(next ?? current);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={frame}
        className="stw-viewport relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-6"
      >
        <div
          className="relative shrink-0 shadow-2xl shadow-black/50 ring-1 ring-white/10"
          style={{ width: displayWidth }}
        >
          {model.theme.transparent ? (
            <div
              className="stw-checkerboard pointer-events-none absolute inset-0"
              aria-hidden="true"
            />
          ) : null}

          {model.layers.length > 0 ? (
            <Stage
              ref={stageRef}
              model={model}
              reduceMotion={reduceMotion}
              onReady={onReady}
            />
          ) : (
            <div
              className="grid place-items-center bg-card/40 text-sm text-muted-foreground"
              style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
            >
              Type a phrase to animate.
            </div>
          )}

          {safe ? (
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
            >
              <div
                className="absolute rounded-sm border border-dashed border-sky-400/70"
                style={{
                  top: `${safe.top}%`,
                  bottom: `${safe.bottom}%`,
                  left: `${safe.left}%`,
                  right: `${safe.right}%`,
                }}
              />
              <span className="absolute left-1/2 top-1.5 -translate-x-1/2 rounded bg-sky-500/20 px-1.5 py-0.5 text-[0.6rem] font-medium text-sky-200">
                Safe zone · guide only
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-1.5">
        <p className="tabular text-[0.7rem] text-muted-foreground">
          {canvas.width} × {canvas.height}
        </p>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Zoom out"
            onClick={() => stepZoom(-1)}
          >
            <MinusIcon />
          </Button>
          <span className="tabular w-11 text-center text-[0.7rem] text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Zoom in"
            onClick={() => stepZoom(1)}
          >
            <PlusIcon />
          </Button>
          <Button
            type="button"
            variant={zoom === null ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setZoom(null)}
            className={cn("gap-1", zoom === null && "text-foreground")}
          >
            <MaximizeIcon data-icon="inline-start" />
            Fit
          </Button>
        </div>
      </div>
    </div>
  );
}
