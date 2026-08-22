"use client";

import * as React from "react";

import {
  Field,
  InfoNote,
  NumberField,
  SectionLabel,
  ToggleRow,
} from "@/components/editor/controls";
import { Button } from "@/components/ui/button";
import type { ProjectController } from "@/hooks/use-project";
import {
  CANVAS_FORMATS,
  CUSTOM_FORMAT_ID,
  MAX_CANVAS_EDGE,
  MIN_CANVAS_EDGE,
  aspectLabel,
  canvasFromFormat,
  clampEdge,
  getCanvasFormat,
} from "@/lib/canvas-formats";
import { cn } from "@/lib/utils";

export function CanvasPanel({ controller }: { controller: ProjectController }) {
  const { project, update } = controller;
  const canvas = project.canvas;
  const format = getCanvasFormat(canvas.formatId);

  const setCanvas = (patch: Partial<typeof canvas>, tag: string) =>
    update({ canvas: { ...canvas, ...patch } }, { tag });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <SectionLabel>Format</SectionLabel>
        <div className="grid gap-1.5">
          {CANVAS_FORMATS.map((entry) => {
            const active = canvas.formatId === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  update({ canvas: canvasFromFormat(entry.id, canvas) }, { tag: "canvas.format" })
                }
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "border-primary/60 bg-primary/5"
                    : "border-border bg-card/40 hover:bg-card/70",
                )}
              >
                <span
                  className="shrink-0 rounded-[3px] bg-muted-foreground/30 ring-1 ring-white/10"
                  style={{
                    width: entry.width >= entry.height ? 26 : (26 * entry.width) / entry.height,
                    height: entry.height >= entry.width ? 26 : (26 * entry.height) / entry.width,
                  }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{entry.name}</span>
                  <span className="tabular block truncate text-[0.65rem] text-muted-foreground">
                    {entry.note}
                  </span>
                </span>
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={canvas.formatId === CUSTOM_FORMAT_ID}
            onClick={() => setCanvas({ formatId: CUSTOM_FORMAT_ID }, "canvas.format")}
            className={cn(
              "rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              canvas.formatId === CUSTOM_FORMAT_ID
                ? "border-primary/60 bg-primary/5"
                : "border-border bg-card/40 hover:bg-card/70",
            )}
          >
            Custom size
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          id="canvas-width"
          label="Width"
          value={canvas.width}
          min={MIN_CANVAS_EDGE}
          max={MAX_CANVAS_EDGE}
          suffix="px"
          onChange={(next) =>
            setCanvas(
              { width: clampEdge(next), formatId: CUSTOM_FORMAT_ID },
              "canvas.width",
            )
          }
        />
        <NumberField
          id="canvas-height"
          label="Height"
          value={canvas.height}
          min={MIN_CANVAS_EDGE}
          max={MAX_CANVAS_EDGE}
          suffix="px"
          onChange={(next) =>
            setCanvas(
              { height: clampEdge(next), formatId: CUSTOM_FORMAT_ID },
              "canvas.height",
            )
          }
        />
      </div>

      <Field label="Aspect">
        <div className="tabular flex items-center gap-2 rounded-lg border border-border bg-card/40 px-2.5 py-1.5 text-xs">
          <span className="font-medium">{aspectLabel(canvas.width, canvas.height)}</span>
          <span className="text-muted-foreground">
            · {(canvas.width / canvas.height).toFixed(3)}
          </span>
        </div>
      </Field>

      <ToggleRow
        id="safe-zones"
        label="Show safe zones"
        hint="Platform UI guides for the selected format. Editor only — never exported."
        checked={canvas.safeZones}
        onCheckedChange={(next) => setCanvas({ safeZones: next }, "canvas.safe")}
      />

      {canvas.safeZones && !format?.safe ? (
        <InfoNote>
          A custom size has no published safe area, so nothing is drawn. Pick a social format
          to see its guides.
        </InfoNote>
      ) : null}

      <Field label="Swap orientation">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            setCanvas(
              { width: canvas.height, height: canvas.width, formatId: CUSTOM_FORMAT_ID },
              "canvas.swap",
            )
          }
        >
          {canvas.width >= canvas.height ? "Make it vertical" : "Make it horizontal"}
        </Button>
      </Field>

      <InfoNote>
        The display size is set in <code className="font-mono">cqw</code> against the canvas,
        so switching format rescales the type in proportion instead of reflowing it.
      </InfoNote>
    </div>
  );
}
