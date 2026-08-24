"use client";

import * as React from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";

import { Field, InfoNote, SectionLabel, SliderField } from "@/components/editor/controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectController } from "@/hooks/use-project";
import { RANGES, createLayer } from "@/lib/project";
import type { PositionAnchor } from "@/lib/types";
import { cn } from "@/lib/utils";

const ANCHORS: readonly { value: PositionAnchor; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top", label: "Top" },
  { value: "top-right", label: "Top right" },
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom", label: "Bottom" },
  { value: "bottom-right", label: "Bottom right" },
];

/**
 * Layers.
 *
 * A small, honest subset of a compositing app: each layer is one text block
 * with its own template, delay and position. Nesting, masks between layers and
 * per-layer effects are deliberately absent — they would double the export
 * surface for a feature most projects never reach for.
 */
export function LayersPanel({ controller }: { controller: ProjectController }) {
  const { project, update, updateLayer, layer } = controller;
  const layers = project.layers;

  const move = (id: string, direction: -1 | 1) => {
    const index = layers.findIndex((entry) => entry.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= layers.length) return;

    const next = [...layers];
    [next[index], next[target]] = [next[target], next[index]];
    update({ layers: next }, { tag: "layers.reorder" });
  };

  const add = () => {
    const created = createLayer({
      name: `Layer ${layers.length + 1}`,
      text: "NEXT LINE",
      templateId: layer.templateId,
      glyphPool: layer.glyphPool,
      delay: Number((layers.length * 0.8).toFixed(2)),
      position: { anchor: "center", x: 0, y: 18 },
    });
    update(
      (previous) => ({
        ...previous,
        layers: [...previous.layers, created],
        activeLayerId: created.id,
      }),
      { tag: "layers.add" },
    );
  };

  const duplicate = (id: string) => {
    const source = layers.find((entry) => entry.id === id);
    if (!source) return;
    // `createLayer` mints the id last, so spreading the source here cannot hand
    // the copy the original's identity.
    const copy = createLayer({
      ...source,
      name: `${source.name} copy`,
      delay: source.delay + 0.4,
    });
    update(
      (previous) => ({
        ...previous,
        layers: [...previous.layers, copy],
        activeLayerId: copy.id,
      }),
      { tag: "layers.duplicate" },
    );
  };

  const remove = (id: string) => {
    if (layers.length <= 1) return;
    update(
      (previous) => {
        const next = previous.layers.filter((entry) => entry.id !== id);
        return {
          ...previous,
          layers: next,
          activeLayerId: previous.activeLayerId === id ? next[0].id : previous.activeLayerId,
        };
      },
      { tag: "layers.remove" },
    );
  };

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Layers</SectionLabel>
          <Button type="button" variant="ghost" size="xs" onClick={add}>
            <PlusIcon data-icon="inline-start" />
            Add
          </Button>
        </div>

        <ul className="space-y-1">
          {layers.map((entry, index) => {
            const active = entry.id === project.activeLayerId;
            return (
              <li
                key={entry.id}
                className={cn(
                  "rounded-lg border transition-colors",
                  active ? "border-primary/50 bg-primary/5" : "border-border bg-card/40",
                )}
              >
                <div className="flex items-center gap-1 px-1.5 py-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      update({ activeLayerId: entry.id }, { tag: "layers.select", silent: true })
                    }
                    className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="block truncate font-medium">{entry.name}</span>
                    <span className="tabular block truncate text-[0.65rem] text-muted-foreground">
                      {entry.text.trim() || "empty"} · +{entry.delay.toFixed(2)}s
                    </span>
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={entry.visible ? `Hide ${entry.name}` : `Show ${entry.name}`}
                    onClick={() =>
                      update(
                        (previous) => ({
                          ...previous,
                          layers: previous.layers.map((item) =>
                            item.id === entry.id ? { ...item, visible: !item.visible } : item,
                          ),
                        }),
                        { tag: "layers.visible" },
                      )
                    }
                  >
                    {entry.visible ? <EyeIcon /> : <EyeOffIcon />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${entry.name} up`}
                    disabled={index === 0}
                    onClick={() => move(entry.id, -1)}
                  >
                    <ChevronUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${entry.name} down`}
                    disabled={index === layers.length - 1}
                    onClick={() => move(entry.id, 1)}
                  >
                    <ChevronDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Duplicate ${entry.name}`}
                    onClick={() => duplicate(entry.id)}
                  >
                    <CopyIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Delete ${entry.name}`}
                    disabled={layers.length <= 1}
                    onClick={() => remove(entry.id)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-4 border-t border-border pt-4">
        <SectionLabel>{layer.name}</SectionLabel>

        <Field label="Layer name" htmlFor="layer-name">
          <Input
            id="layer-name"
            value={layer.name}
            onChange={(event) => updateLayer({ name: event.target.value }, { tag: "layer.name" })}
            className="h-8 text-xs"
          />
        </Field>

        <Field
          label="Position"
          hint="Anchor first, then nudge. The offset is a percentage of the canvas, so the same value moves a subtitle and a headline by the same distance."
        >
          <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-muted/50 p-0.5">
            {ANCHORS.map((anchor) => (
              <button
                key={anchor.value}
                type="button"
                role="radio"
                aria-checked={layer.position.anchor === anchor.value}
                aria-label={anchor.label}
                title={anchor.label}
                onClick={() =>
                  updateLayer(
                    { position: { ...layer.position, anchor: anchor.value } },
                    { tag: "layer.anchor" },
                  )
                }
                className={cn(
                  "grid h-7 place-items-center rounded-md transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  layer.position.anchor === anchor.value
                    ? "bg-background shadow-sm"
                    : "hover:bg-background/40",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    layer.position.anchor === anchor.value
                      ? "bg-primary"
                      : "bg-muted-foreground/40",
                  )}
                />
              </button>
            ))}
          </div>
        </Field>

        <SliderField
          id="offset-x"
          label="Offset X"
          value={layer.position.x}
          display={`${layer.position.x.toFixed(1)}%`}
          range={RANGES.offset}
          onValueChange={(next) =>
            updateLayer({ position: { ...layer.position, x: next } }, { tag: "layer.x" })
          }
        />
        <SliderField
          id="offset-y"
          label="Offset Y"
          value={layer.position.y}
          display={`${layer.position.y.toFixed(1)}%`}
          range={RANGES.offset}
          onValueChange={(next) =>
            updateLayer({ position: { ...layer.position, y: next } }, { tag: "layer.y" })
          }
        />
        <SliderField
          id="layer-scale"
          label="Size multiplier"
          value={layer.typography.scale ?? 1}
          display={`${(layer.typography.scale ?? 1).toFixed(2)}×`}
          range={RANGES.wordScale}
          onValueChange={(next) =>
            updateLayer(
              { typography: { ...layer.typography, scale: next } },
              { tag: "layer.scale" },
            )
          }
        />

        {layers.length > 1 ? (
          <InfoNote>
            Layers share the master timeline. Each one starts at its own delay, and the
            export builds one function per layer — so a multi-layer scene exports as
            readable code rather than as one tangled block.
          </InfoNote>
        ) : null}
      </section>
    </div>
  );
}
