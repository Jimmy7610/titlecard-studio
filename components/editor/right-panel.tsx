"use client";

import * as React from "react";
import { RotateCcwIcon } from "lucide-react";

import {
  ColorField,
  Field,
  InfoNote,
  SectionLabel,
  SegmentedControl,
  SliderField,
  ToggleRow,
} from "@/components/editor/controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectController } from "@/hooks/use-project";
import { GLYPH_POOLS, type GlyphPoolId } from "@/lib/glyphs";
import { RANGES } from "@/lib/project";
import { splitText } from "@/lib/split";
import { getTemplate } from "@/lib/templates";
import type { WordEmphasis, WordStyle } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Context settings.
 *
 * What is shown follows what is selected: pick a word and word styling appears;
 * pick a template that substitutes glyphs and the glyph pool appears. The panel
 * is never all of the settings at once, which is what keeps a studio layout
 * legible as the feature count grows.
 */
export function RightPanel({ controller }: { controller: ProjectController }) {
  const { project, layer, updateLayer } = controller;
  const [selected, setSelected] = React.useState<number | null>(null);

  const template = getTemplate(layer.templateId);
  const split = React.useMemo(
    () =>
      splitText(layer.text, {
        granularity: project.typography.granularity,
        gradientDigits: project.gradientDigits,
        transform: project.typography.transform,
      }),
    [layer.text, project.typography.granularity, project.typography.transform, project.gradientDigits],
  );

  // A word index that no longer exists — the phrase was edited down — must not
  // leave the panel editing a style nothing renders. Dropping it during render
  // rather than in an effect avoids painting the stale panel for a frame.
  const valid = selected !== null && selected < split.words.length ? selected : null;
  if (valid !== selected) setSelected(valid);

  const style: WordStyle = (valid !== null && layer.wordStyles[valid]) || {};

  const setStyle = (patch: Partial<WordStyle>, tag: string) => {
    if (valid === null) return;
    updateLayer(
      {
        wordStyles: {
          ...layer.wordStyles,
          [valid]: { ...style, ...patch },
        },
      },
      { tag },
    );
  };

  const clearStyle = () => {
    if (valid === null) return;
    const next = { ...layer.wordStyles };
    delete next[valid];
    updateLayer({ wordStyles: next }, { tag: "word.clear" });
  };

  const styledCount = Object.keys(layer.wordStyles).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold tracking-tight">{template.name}</p>
          <p className="text-[0.7rem] text-muted-foreground">{template.tagline}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[0.6rem] capitalize">
          {template.category}
        </Badge>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
          {template.description}
        </p>

        {template.usesGlyphs ? (
          <Field
            label="Glyph pool"
            htmlFor="pool"
            hint="What the scramble cycles through before each slot locks."
          >
            <Select
              items={GLYPH_POOLS.map((pool) => ({ value: pool.id, label: pool.name }))}
              value={layer.glyphPool}
              onValueChange={(value) =>
                updateLayer({ glyphPool: value as GlyphPoolId }, { tag: "layer.pool" })
              }
            >
              <SelectTrigger id="pool" className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GLYPH_POOLS.map((pool) => (
                  <SelectItem key={pool.id} value={pool.id}>
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-sm">{pool.name}</span>
                      <span className="font-mono text-[0.7rem] text-muted-foreground">
                        {Array.from(pool.chars).slice(0, 6).join("")}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        {/* ------------------------------------------------ Word styling */}
        <section className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Word styling</SectionLabel>
            {styledCount > 0 ? (
              <Badge variant="outline" className="text-[0.6rem]">
                {styledCount} styled
              </Badge>
            ) : null}
          </div>

          {split.words.length === 0 ? (
            <InfoNote>Type something to style individual words.</InfoNote>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                {split.words.map((word) => {
                  const active = valid === word.index;
                  const styled = layer.wordStyles[word.index] !== undefined;
                  return (
                    <button
                      key={word.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelected(active ? null : word.index)}
                      className={cn(
                        "max-w-full truncate rounded-md border px-1.5 py-0.5 text-[0.7rem] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : styled
                            ? "border-primary/40 bg-card/60 text-foreground"
                            : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {word.text}
                    </button>
                  );
                })}
              </div>

              {valid === null ? (
                <InfoNote>
                  Select a word above to give it its own colour, weight, size, glow or
                  entrance delay. Everything else in the phrase keeps the project style.
                </InfoNote>
              ) : (
                <div className="space-y-4 rounded-xl border border-border bg-card/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium">
                      {split.words[valid]?.text}
                    </p>
                    <Button type="button" variant="ghost" size="xs" onClick={clearStyle}>
                      <RotateCcwIcon data-icon="inline-start" />
                      Clear
                    </Button>
                  </div>

                  <ToggleRow
                    id="word-gradient"
                    label="Gradient fill"
                    hint="Paints this word with the palette gradient."
                    checked={style.gradient === true}
                    onCheckedChange={(next) => setStyle({ gradient: next }, "word.gradient")}
                  />

                  {!style.gradient ? (
                    <ColorField
                      id="word-colour"
                      label="Colour"
                      value={style.color ?? project.color.text}
                      onChange={(next) => setStyle({ color: next }, "word.colour")}
                    />
                  ) : null}

                  <SliderField
                    id="word-scale"
                    label="Size"
                    value={style.scale ?? 1}
                    display={`${(style.scale ?? 1).toFixed(2)}×`}
                    range={RANGES.wordScale}
                    onValueChange={(next) => setStyle({ scale: next }, "word.scale")}
                  />

                  <SliderField
                    id="word-weight"
                    label="Weight"
                    value={style.weight ?? project.typography.weight}
                    display={String(style.weight ?? project.typography.weight)}
                    range={RANGES.weight}
                    onValueChange={(next) => setStyle({ weight: next }, "word.weight")}
                  />

                  <SliderField
                    id="word-glow"
                    label="Glow"
                    value={style.glow ?? 0}
                    display={(style.glow ?? 0) === 0 ? "off" : (style.glow ?? 0).toFixed(2)}
                    range={RANGES.glow}
                    onValueChange={(next) => setStyle({ glow: next }, "word.glow")}
                  />

                  <SliderField
                    id="word-opacity"
                    label="Opacity"
                    value={style.opacity ?? 1}
                    display={`${Math.round((style.opacity ?? 1) * 100)}%`}
                    range={RANGES.opacity}
                    onValueChange={(next) => setStyle({ opacity: next }, "word.opacity")}
                  />

                  <SliderField
                    id="word-delay"
                    label="Entrance delay"
                    value={style.delay ?? 0}
                    display={`${(style.delay ?? 0).toFixed(2)} s`}
                    range={RANGES.wordDelay}
                    hint="Holds this word back inside the same timeline."
                    onValueChange={(next) => setStyle({ delay: next }, "word.delay")}
                  />

                  <SegmentedControl<WordEmphasis>
                    label="Emphasis"
                    value={style.emphasis ?? "none"}
                    onChange={(next) => setStyle({ emphasis: next }, "word.emphasis")}
                    columns={3}
                    options={[
                      { value: "none", label: "None" },
                      { value: "pop", label: "Pop", title: "Slightly larger than its neighbours" },
                      { value: "delay", label: "Late", title: "Lands after the rest of the line" },
                    ]}
                  />
                </div>
              )}
            </>
          )}
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <SectionLabel>Phrase</SectionLabel>
          <ToggleRow
            id="gradient-digits"
            label="Gradient on trailing digits"
            hint='Gives the number at the end of a phrase the gradient treatment — "Agent 3".'
            checked={project.gradientDigits}
            onCheckedChange={(next) =>
              controller.update({ gradientDigits: next }, { tag: "gradient-digits" })
            }
          />

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="tabular font-mono text-[0.6rem]">
              {split.charCount} units
            </Badge>
            <Badge variant="outline" className="tabular font-mono text-[0.6rem]">
              {split.words.length} masks
            </Badge>
            <Badge variant="outline" className="tabular font-mono text-[0.6rem]">
              {split.lines.length} {split.lines.length === 1 ? "line" : "lines"}
            </Badge>
          </div>

          {split.downgraded ? (
            <InfoNote>
              This script shapes or reorders across characters, so the phrase animates per
              word instead of per character. Splitting it finer would render it wrong.
            </InfoNote>
          ) : null}
        </section>
      </div>
    </div>
  );
}
