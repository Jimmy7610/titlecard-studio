"use client";

import * as React from "react";
import { RotateCcwIcon } from "lucide-react";

import {
  ColorField,
  Field,
  InfoNote,
  SectionLabel,
  SliderField,
  ToggleRow,
} from "@/components/editor/controls";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectController } from "@/hooks/use-project";
import { PALETTES, getPalette, gradientOf, type PaletteId } from "@/lib/palettes";
import { DEFAULT_COLOR, RANGES } from "@/lib/project";
import type { ColorConfig } from "@/lib/types";

function Swatch({ paletteId }: { paletteId: PaletteId }) {
  return (
    <span
      className="size-3.5 shrink-0 rounded-[4px] ring-1 ring-white/15"
      style={{ backgroundImage: gradientOf(getPalette(paletteId)) }}
    />
  );
}

/**
 * Colour.
 *
 * The palette is the default path and stays one control. Everything below it is
 * an override that only appears once someone opts into custom colour — a
 * fourteen-field colour panel open by default would bury the one decision most
 * projects actually make.
 */
export function StylePanel({ controller }: { controller: ProjectController }) {
  const { project, update } = controller;
  const colour = project.color;
  const palette = getPalette(project.paletteId);
  const custom = colour.mode === "custom";

  const setColor = (patch: Partial<ColorConfig>, tag: string) =>
    update({ color: { ...colour, ...patch } }, { tag });

  /**
   * Puts the colours back to the palette and touches nothing else.
   *
   * It used to spread the whole default colour config, which also silently
   * switched off glow, drop shadow, outline and text opacity — controls that
   * live in a different section and have nothing to do with the palette.
   */
  const resetToPalette = () => {
    update(
      {
        color: {
          ...colour,
          mode: "palette",
          text: project.invertCanvas ? palette.dark.ink : palette.light.ink,
          accent1: palette.hot,
          accent2: palette.warm,
          accent3: palette.sun,
          gradientStart: palette.hot,
          gradientEnd: palette.sun,
          gradientAngle: DEFAULT_COLOR.gradientAngle,
          glowColor: palette.hot,
          outlineColor: project.invertCanvas ? palette.dark.ink : palette.light.ink,
        },
      },
      { tag: "color.reset" },
    );
  };

  return (
    <div className="space-y-5">
      <Field label="Palette" htmlFor="palette">
        <Select
          items={PALETTES.map((entry) => ({ value: entry.id, label: entry.name }))}
          value={project.paletteId}
          onValueChange={(value) =>
            update({ paletteId: value as PaletteId }, { tag: "palette" })
          }
        >
          <SelectTrigger id="palette" className="h-8 w-full">
            <Swatch paletteId={project.paletteId} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PALETTES.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                <span className="flex items-center gap-2.5 py-0.5">
                  <Swatch paletteId={entry.id} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm">{entry.name}</span>
                    <span className="text-[0.7rem] text-muted-foreground">{entry.note}</span>
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <ToggleRow
        id="invert"
        label="Dark canvas tones"
        hint="Swaps to the palette's dark ramp. Colour tweens retarget rather than fight it."
        checked={project.invertCanvas}
        onCheckedChange={(next) => update({ invertCanvas: next }, { tag: "invert" })}
      />

      <ToggleRow
        id="custom-colour"
        label="Custom colours"
        hint="Overrides the palette with your own text, accents and gradient."
        checked={custom}
        onCheckedChange={(next) => {
          if (next) {
            // Seed the overrides from the palette so switching on changes
            // nothing visible — the first edit is the user's, not ours.
            setColor(
              {
                mode: "custom",
                text: project.invertCanvas ? palette.dark.ink : palette.light.ink,
                accent1: palette.hot,
                accent2: palette.warm,
                accent3: palette.sun,
                gradientStart: palette.hot,
                gradientEnd: palette.sun,
              },
              "color.mode",
            );
          } else {
            setColor({ mode: "palette" }, "color.mode");
          }
        }}
      />

      {custom ? (
        <div className="space-y-4 rounded-xl border border-border bg-card/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Overrides</SectionLabel>
            <Button type="button" variant="ghost" size="xs" onClick={resetToPalette}>
              <RotateCcwIcon data-icon="inline-start" />
              Reset to palette
            </Button>
          </div>

          <ColorField
            id="text-colour"
            label="Text"
            value={colour.text}
            onChange={(next) => setColor({ text: next }, "color.text")}
          />
          <ColorField
            id="accent-1"
            label="Accent 1"
            value={colour.accent1}
            onChange={(next) => setColor({ accent1: next }, "color.accent1")}
            hint="Leads every colour tween and paints the flash slab."
          />
          <ColorField
            id="accent-2"
            label="Accent 2"
            value={colour.accent2}
            onChange={(next) => setColor({ accent2: next }, "color.accent2")}
          />
          <ColorField
            id="accent-3"
            label="Accent 3"
            value={colour.accent3}
            onChange={(next) => setColor({ accent3: next }, "color.accent3")}
          />

          <div className="grid grid-cols-2 gap-3">
            <ColorField
              id="gradient-start"
              label="Gradient from"
              value={colour.gradientStart}
              onChange={(next) => setColor({ gradientStart: next }, "color.gradientStart")}
            />
            <ColorField
              id="gradient-end"
              label="Gradient to"
              value={colour.gradientEnd}
              onChange={(next) => setColor({ gradientEnd: next }, "color.gradientEnd")}
            />
          </div>

          <SliderField
            id="gradient-angle"
            label="Gradient angle"
            value={colour.gradientAngle}
            display={`${Math.round(colour.gradientAngle)}°`}
            range={RANGES.angle}
            onValueChange={(next) => setColor({ gradientAngle: next }, "color.gradientAngle")}
          />
        </div>
      ) : null}

      <Collapsible className="space-y-3">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card/40 px-3 py-2 text-xs font-medium transition-colors outline-none hover:bg-card/70 focus-visible:ring-3 focus-visible:ring-ring/50">
          Effects
          <span className="text-[0.7rem] text-muted-foreground">glow · shadow · outline</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 rounded-xl border border-border bg-card/40 p-3">
            <SliderField
              id="glow"
              label="Glow"
              value={colour.glow}
              display={colour.glow === 0 ? "off" : `${colour.glow.toFixed(2)} em`}
              range={RANGES.glow}
              onValueChange={(next) => setColor({ glow: next }, "color.glow")}
            />
            {colour.glow > 0 ? (
              <ColorField
                id="glow-colour"
                label="Glow colour"
                value={colour.glowColor}
                onChange={(next) => setColor({ glowColor: next }, "color.glowColor")}
              />
            ) : null}

            <SliderField
              id="shadow"
              label="Drop shadow"
              value={colour.shadow}
              display={colour.shadow === 0 ? "off" : colour.shadow.toFixed(2)}
              range={RANGES.shadow}
              onValueChange={(next) => setColor({ shadow: next }, "color.shadow")}
            />

            <SliderField
              id="outline"
              label="Outline"
              value={colour.outline}
              display={colour.outline === 0 ? "off" : `${colour.outline.toFixed(3)} em`}
              range={RANGES.outline}
              onValueChange={(next) => setColor({ outline: next }, "color.outline")}
            />
            {colour.outline > 0 ? (
              <ColorField
                id="outline-colour"
                label="Outline colour"
                value={colour.outlineColor}
                onChange={(next) => setColor({ outlineColor: next }, "color.outlineColor")}
              />
            ) : null}

            <SliderField
              id="text-opacity"
              label="Text opacity"
              value={colour.opacity}
              display={`${Math.round(colour.opacity * 100)}%`}
              range={RANGES.opacity}
              onValueChange={(next) => setColor({ opacity: next }, "color.opacity")}
            />

            <InfoNote>
              Glow and outline are painted by the browser on the live text, so they survive
              into every export — including the video recorder, which reads the same pixels.
            </InfoNote>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
