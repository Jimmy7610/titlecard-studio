"use client";

import * as React from "react";
import {
  BracesIcon,
  CodeIcon,
  CopyIcon,
  FileCodeIcon,
  RotateCcwIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  downloadFile,
  presetJson,
  reactComponent,
  slugify,
  standaloneHtml,
  timelineSource,
} from "@/lib/export";
import { GLYPH_POOLS, type GlyphPoolId } from "@/lib/glyphs";
import { PALETTES, getPalette, gradientOf, type PaletteId } from "@/lib/palettes";
import {
  SEMANTIC_LEXICON,
  normaliseWord,
  type SemanticMatch,
} from "@/lib/semantic-engine";
import { PHRASE_PRESETS, RANGES, type GeneratorSettings } from "@/lib/settings";
import { TEMPLATES, getTemplate, type TemplateId } from "@/lib/templates";

export type ControlPanelProps = {
  settings: GeneratorSettings;
  onChange: (patch: Partial<GeneratorSettings>) => void;
  onReplay: () => void;
  /** Non-null when the semantic engine has taken control of the template. */
  match: SemanticMatch | null;
  activeTemplateId: TemplateId;
  phrase: string;
};

/** Base UI sliders hand back `number | number[]` depending on the value shape. */
function firstValue(value: number | readonly number[]): number {
  return Array.isArray(value) ? value[0] : (value as number);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function SliderField({
  id,
  label,
  hint,
  value,
  display,
  range,
  onValueChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  display: string;
  range: { min: number; max: number; step: number };
  onValueChange: (next: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <span className="tabular text-xs text-muted-foreground">{display}</span>
      </div>
      <Slider
        id={id}
        value={[value]}
        min={range.min}
        max={range.max}
        step={range.step}
        onValueChange={(next) => onValueChange(firstValue(next))}
      />
      {hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground/70">{hint}</p>
      ) : null}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: React.ReactNode;
  hint: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <p className="text-xs leading-relaxed text-muted-foreground/70">{hint}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

function Swatch({ paletteId }: { paletteId: PaletteId }) {
  return (
    <span
      className="size-3.5 shrink-0 rounded-[4px] ring-1 ring-white/15"
      style={{ backgroundImage: gradientOf(getPalette(paletteId)) }}
    />
  );
}

export function ControlPanel({
  settings,
  onChange,
  onReplay,
  match,
  activeTemplateId,
  phrase,
}: ControlPanelProps) {
  const activeTemplate = getTemplate(activeTemplateId);
  const semanticLocked = settings.semantic && match !== null;

  const templateItems = React.useMemo(
    () => TEMPLATES.map((template) => ({ value: template.id, label: template.name })),
    [],
  );
  const paletteItems = React.useMemo(
    () => PALETTES.map((palette) => ({ value: palette.id, label: palette.name })),
    [],
  );
  const poolItems = React.useMemo(
    () => GLYPH_POOLS.map((pool) => ({ value: pool.id, label: pool.name })),
    [],
  );

  /** Words in the current phrase that exist in the lexicon, for highlighting. */
  const litTokens = React.useMemo(
    () =>
      new Set(settings.text.trim().split(/\s+/).map(normaliseWord).filter(Boolean)),
    [settings.text],
  );

  const lexiconSize = React.useMemo(
    () => SEMANTIC_LEXICON.reduce((total, rule) => total + rule.tokens.length, 0),
    [],
  );

  const resolved = React.useMemo(
    () => ({ settings, templateId: activeTemplateId, phrase }),
    [settings, activeTemplateId, phrase],
  );

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(timelineSource(resolved));
      toast.success("GSAP timeline copied", {
        description: `${activeTemplate.name} · runs against the exported markup`,
      });
    } catch {
      toast.error("Clipboard unavailable", {
        description: "Your browser blocked the copy request.",
      });
    }
  }, [resolved, activeTemplate.name]);

  const handleDownload = React.useCallback(
    (kind: "html" | "react" | "preset") => {
      const stem = slugify(phrase || "animation");

      const file = {
        html: {
          name: `${stem}.html`,
          mime: "text/html",
          body: standaloneHtml(resolved),
          label: "Standalone page",
        },
        react: {
          name: `${stem}.tsx`,
          mime: "text/plain",
          body: reactComponent(resolved),
          label: "React component",
        },
        preset: {
          name: `${stem}.preset.json`,
          mime: "application/json",
          body: presetJson(resolved),
          label: "Preset",
        },
      }[kind];

      downloadFile(file.name, file.body, file.mime);
      toast.success(`${file.label} exported`, { description: file.name });
    },
    [resolved, phrase],
  );

  return (
    <aside className="order-2 flex w-full shrink-0 flex-col border-t border-border bg-card/40 lg:order-1 lg:h-dvh lg:w-[380px] lg:border-t-0 lg:border-r">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <span
          className="grid size-7 place-items-center rounded-md text-[0.7rem] font-bold text-black/80"
          style={{ backgroundImage: gradientOf(getPalette(settings.paletteId)) }}
        >
          ST
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Semantic Text</p>
          <p className="text-[0.7rem] text-muted-foreground">Animation Generator</p>
        </div>
      </div>

      <Separator />

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* ---------------------------------------------------- Phrase */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Phrase</CardTitle>
            <CardDescription className="text-xs">
              Trailing digits pick up the gradient treatment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="phrase" className="sr-only">
              Phrase to animate
            </Label>
            <Input
              id="phrase"
              value={settings.text}
              maxLength={48}
              placeholder="Agent 3"
              onChange={(event) => onChange({ text: event.target.value })}
              className="h-9 font-medium"
            />

            <div className="flex flex-wrap gap-1.5">
              {PHRASE_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="xs"
                  variant={settings.text === preset ? "secondary" : "ghost"}
                  onClick={() => onChange({ text: preset })}
                  className="font-normal text-muted-foreground data-[variant=secondary]:text-foreground"
                >
                  {preset}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* -------------------------------------------------- Template */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Template</CardTitle>
            <CardDescription className="text-xs">
              {semanticLocked
                ? "Locked by the semantic engine. Turn auto-detect off to choose."
                : "Every template is bounded by the word's own mask box."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select
              items={templateItems}
              value={activeTemplateId}
              disabled={semanticLocked}
              onValueChange={(value) => onChange({ templateId: value as TemplateId })}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <span className="flex flex-col gap-0.5 py-0.5">
                      <span className="text-sm">{template.name}</span>
                      <span className="text-[0.7rem] text-muted-foreground">
                        {template.tagline}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeTemplate.usesGlyphs ? (
              <div className="space-y-2">
                <Label htmlFor="pool" className="text-sm">
                  Glyph pool
                </Label>
                <Select
                  items={poolItems}
                  value={settings.glyphPool}
                  onValueChange={(value) =>
                    onChange({ glyphPool: value as GlyphPoolId })
                  }
                >
                  <SelectTrigger id="pool" className="h-9 w-full">
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
              </div>
            ) : null}

            <p className="text-xs leading-relaxed text-muted-foreground/80">
              {activeTemplate.description}
            </p>
          </CardContent>
        </Card>

        {/* ------------------------------------------- Semantic engine */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <SparklesIcon className="size-3.5 text-primary" />
              Semantic engine
            </CardTitle>
            <CardDescription className="text-xs">
              Matches whole words against a lexicon and forces the template that
              fits the meaning.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <ToggleRow
              id="semantic"
              label="Auto-detect"
              hint="Off falls back to the template you pick above."
              checked={settings.semantic}
              onCheckedChange={(next) => onChange({ semantic: next })}
            />

            {settings.semantic ? (
              <div className="rounded-lg border border-border bg-background/40 p-3">
                {match ? (
                  <p className="text-xs leading-relaxed">
                    Matched{" "}
                    <span className="rounded bg-primary/15 px-1 py-0.5 font-medium text-primary">
                      {match.word}
                    </span>{" "}
                    → forcing{" "}
                    <span className="font-medium text-foreground">
                      {getTemplate(match.templateId).name}
                    </span>
                    {match.hits > 1 ? (
                      <span className="text-muted-foreground"> ({match.hits} hits)</span>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No lexicon match — using your manual selection.
                  </p>
                )}
              </div>
            ) : null}

            <details className="group">
              <summary className="cursor-pointer list-none text-xs text-muted-foreground transition-colors hover:text-foreground">
                <span className="group-open:hidden">Show lexicon</span>
                <span className="hidden group-open:inline">Hide lexicon</span>
                <span className="text-muted-foreground/60"> · {lexiconSize} words</span>
              </summary>

              <div className="mt-3 space-y-2.5">
                {SEMANTIC_LEXICON.map((rule) => (
                  <div key={rule.templateId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <SectionLabel>{rule.label}</SectionLabel>
                      <span className="text-[0.625rem] text-muted-foreground/60">
                        {getTemplate(rule.templateId).name}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {rule.tokens.map((token) => {
                        const lit = litTokens.has(token);
                        return (
                          <Badge
                            key={token}
                            variant={lit ? "default" : "outline"}
                            className={
                              lit
                                ? "font-mono text-[0.625rem]"
                                : "border-border/60 font-mono text-[0.625rem] text-muted-foreground/70"
                            }
                          >
                            {token}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </CardContent>
        </Card>

        {/* ---------------------------------------------------- Motion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Motion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <SliderField
              id="speed"
              label="Speed"
              hint="Divides every duration in the timeline. 1.00× is the reference tempo."
              value={settings.speed}
              display={`${settings.speed.toFixed(2)}×`}
              range={RANGES.speed}
              onValueChange={(next) => onChange({ speed: next })}
            />
            <SliderField
              id="stagger"
              label="Stagger"
              hint="Delay between neighbouring characters, before the speed multiplier."
              value={settings.stagger}
              display={`${(settings.stagger * 1000).toFixed(0)} ms`}
              range={RANGES.stagger}
              onValueChange={(next) => onChange({ stagger: next })}
            />
          </CardContent>
        </Card>

        {/* ------------------------------------------------ Typography */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Typography</CardTitle>
            <CardDescription className="text-xs">
              Leading pulls lines together without shrinking the mask, so
              descenders survive even at 0.85.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <SliderField
              id="size"
              label="Size"
              value={settings.fontSize}
              display={`${settings.fontSize.toFixed(1)} cqw`}
              range={RANGES.fontSize}
              onValueChange={(next) => onChange({ fontSize: next })}
            />
            <SliderField
              id="tracking"
              label="Tracking"
              value={settings.tracking}
              display={`${settings.tracking > 0 ? "+" : ""}${settings.tracking.toFixed(3)} em`}
              range={RANGES.tracking}
              onValueChange={(next) => onChange({ tracking: next })}
            />
            <SliderField
              id="leading"
              label="Leading"
              value={settings.leading}
              display={settings.leading.toFixed(2)}
              range={RANGES.leading}
              onValueChange={(next) => onChange({ leading: next })}
            />
            <SliderField
              id="weight"
              label="Weight"
              value={settings.weight}
              display={`${settings.weight}`}
              range={RANGES.weight}
              onValueChange={(next) => onChange({ weight: next })}
            />
          </CardContent>
        </Card>

        {/* ---------------------------------------------------- Canvas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Canvas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="palette" className="text-sm">
                Palette
              </Label>
              <Select
                items={paletteItems}
                value={settings.paletteId}
                onValueChange={(value) => onChange({ paletteId: value as PaletteId })}
              >
                <SelectTrigger id="palette" className="h-9 w-full">
                  <Swatch paletteId={settings.paletteId} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PALETTES.map((palette) => (
                    <SelectItem key={palette.id} value={palette.id}>
                      <span className="flex items-center gap-2.5 py-0.5">
                        <Swatch paletteId={palette.id} />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm">{palette.name}</span>
                          <span className="text-[0.7rem] text-muted-foreground">
                            {palette.note}
                          </span>
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ToggleRow
              id="invert"
              label="Invert canvas"
              hint="Swaps to the palette's dark tones. Colour tweens retarget."
              checked={settings.invertCanvas}
              onCheckedChange={(next) => onChange({ invertCanvas: next })}
            />
            <ToggleRow
              id="loop"
              label="Loop playback"
              hint="Replays the timeline with a 1.1s hold on the resting frame."
              checked={settings.loop}
              onCheckedChange={(next) => onChange({ loop: next })}
            />
          </CardContent>
        </Card>

        {/* ---------------------------------------------------- Export */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Export</CardTitle>
            <CardDescription className="text-xs">
              Each option bakes in the current phrase, template and every slider
              value. The markup and CSS travel with the code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDownload("html")}
              className="h-auto w-full justify-start gap-2.5 py-2 text-left"
            >
              <CodeIcon data-icon="inline-start" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm">Standalone page</span>
                <span className="text-[0.7rem] font-normal text-muted-foreground">
                  .html · opens with a double-click, GSAP from CDN
                </span>
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleDownload("react")}
              className="h-auto w-full justify-start gap-2.5 py-2 text-left"
            >
              <FileCodeIcon data-icon="inline-start" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm">React component</span>
                <span className="text-[0.7rem] font-normal text-muted-foreground">
                  .tsx · drop-in, needs gsap + @gsap/react
                </span>
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleDownload("preset")}
              className="h-auto w-full justify-start gap-2.5 py-2 text-left"
            >
              <BracesIcon data-icon="inline-start" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm">Preset</span>
                <span className="text-[0.7rem] font-normal text-muted-foreground">
                  .json · just the settings, for sharing a look
                </span>
              </span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleCopy}
              className="h-auto w-full justify-start gap-2.5 py-2 text-left"
            >
              <CopyIcon data-icon="inline-start" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm">Copy GSAP timeline</span>
                <span className="text-[0.7rem] font-normal text-muted-foreground">
                  clipboard · the timeline code on its own
                </span>
              </span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="p-4">
        <Button type="button" onClick={onReplay} className="w-full">
          <RotateCcwIcon data-icon="inline-start" />
          Replay
        </Button>
      </div>
    </aside>
  );
}
