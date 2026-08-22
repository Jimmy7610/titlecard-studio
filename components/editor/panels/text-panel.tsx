"use client";

import * as React from "react";
import { RefreshCwIcon, SparklesIcon, WandSparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { Field, InfoNote, SectionLabel, ToggleRow } from "@/components/editor/controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectController } from "@/hooks/use-project";
import { PHRASE_PRESETS } from "@/lib/project";
import { applyLook, direct, suggest } from "@/lib/semantic/engine";
import { LEXICON_SIZE } from "@/lib/semantic/lexicon";
import { getTemplate } from "@/lib/templates";

/**
 * Text, and the suggestion engine that used to be a lock.
 *
 * The old engine matched a word and *forced* a template, which meant a phrase
 * containing "system" could not be animated any other way. Everything here
 * proposes: a suggestion is a card with an Apply button on it, and the manual
 * choice in the Templates panel always wins until someone presses that button.
 */
export function TextPanel({ controller }: { controller: ProjectController }) {
  const { project, layer, update, updateLayer } = controller;
  const [variant, setVariant] = React.useState(0);
  const [ignored, setIgnored] = React.useState<string | null>(null);
  const [brief, setBrief] = React.useState("");

  const suggestion = React.useMemo(
    () => (project.semantic.enabled ? suggest(layer.text, variant) : null),
    [project.semantic.enabled, layer.text, variant],
  );

  const dismissed = ignored !== null && ignored === layer.text;
  const alreadyApplied = suggestion?.templateId === layer.templateId;

  const apply = React.useCallback(() => {
    if (!suggestion) return;
    update((previous) => applyLook(previous, suggestion.look, suggestion.templateId), {
      tag: "suggestion",
    });
    toast.success(`Applied ${getTemplate(suggestion.templateId).name}`, {
      description: `${suggestion.mood.label} · ${suggestion.mood.reason.toLowerCase()}`,
    });
  }, [suggestion, update]);

  // Auto-apply is opt-in and off by default: a suggestion that reaches in and
  // changes the project while someone is still typing is the old lock wearing
  // a different hat.
  const autoApply = project.semantic.autoApply;
  const suggestedId = suggestion?.templateId;
  React.useEffect(() => {
    if (!autoApply || !suggestion || suggestedId === layer.templateId) return;
    update((previous) => applyLook(previous, suggestion.look, suggestion.templateId), {
      tag: "suggestion-auto",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoApply, suggestedId]);

  const runDirector = () => {
    const result = direct(brief);
    update((previous) => applyLook(previous, result.look, result.templateId), {
      tag: "director",
    });
    toast.success(result.fallback ? "No strong signal — applied a neutral look" : `Applied ${result.mood.label}`, {
      description: result.matched.length
        ? `Matched ${result.matched.slice(0, 4).join(", ")}`
        : "Try words like calm, luxury, terminal, framtid, lugn.",
    });
  };

  return (
    <div className="space-y-5">
      <Field
        label="Phrase"
        htmlFor="phrase"
        hint="Line breaks become separate lines. Every template accepts any text."
      >
        <Textarea
          id="phrase"
          value={layer.text}
          rows={2}
          maxLength={220}
          placeholder="Type anything"
          spellCheck={false}
          onChange={(event) => updateLayer({ text: event.target.value }, { tag: "layer.text" })}
          className="font-medium"
        />
      </Field>

      <div className="space-y-2">
        <SectionLabel>Starting points</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {PHRASE_PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="xs"
              variant={layer.text === preset ? "secondary" : "ghost"}
              onClick={() => updateLayer({ text: preset }, { tag: `phrase-preset-${preset}` })}
              className="font-normal text-muted-foreground data-[variant=secondary]:text-foreground"
            >
              {preset}
            </Button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------ Smart Suggest */}
      <div className="space-y-3 rounded-xl border border-border bg-card/50 p-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-3.5 text-primary" />
          <SectionLabel className="text-foreground">Smart Suggest</SectionLabel>
        </div>

        <ToggleRow
          id="semantic"
          label="Show suggestions"
          hint={`Reads the phrase against a ${LEXICON_SIZE}-word English and Swedish lexicon.`}
          checked={project.semantic.enabled}
          onCheckedChange={(next) =>
            update({ semantic: { ...project.semantic, enabled: next } }, { tag: "semantic" })
          }
        />

        {project.semantic.enabled ? (
          suggestion && !dismissed ? (
            <div className="space-y-2.5 rounded-lg border border-primary/25 bg-primary/5 p-2.5">
              <div className="space-y-1">
                <p className="text-xs">
                  Suggested{" "}
                  <span className="font-medium text-foreground">
                    {getTemplate(suggestion.templateId).name}
                  </span>
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  {suggestion.mood.reason} —{" "}
                  {suggestion.hits.slice(0, 3).map((hit) => (
                    <span
                      key={`${hit.word}-${hit.wordIndex}`}
                      className="mr-1 rounded bg-primary/15 px-1 font-medium text-primary"
                    >
                      {hit.word}
                    </span>
                  ))}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="xs" onClick={apply} disabled={alreadyApplied}>
                  {alreadyApplied ? "Applied" : "Apply suggestion"}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setVariant((previous) => previous + 1)}
                >
                  <RefreshCwIcon data-icon="inline-start" />
                  Regenerate
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setIgnored(layer.text)}
                >
                  Ignore
                </Button>
              </div>
            </div>
          ) : (
            <InfoNote>
              {dismissed
                ? "Suggestion ignored for this phrase."
                : "No lexicon match. Your manual choice stands — as it does either way."}
            </InfoNote>
          )
        ) : null}

        <ToggleRow
          id="auto-apply"
          label="Auto-apply suggestions"
          hint="Off by default. On, a matching phrase restyles the project as you type."
          checked={project.semantic.autoApply}
          onCheckedChange={(next) =>
            update({ semantic: { ...project.semantic, autoApply: next } }, { tag: "auto-apply" })
          }
        />
      </div>

      {/* --------------------------------------------- Style director */}
      <div className="space-y-2.5 rounded-xl border border-border bg-card/50 p-3">
        <div className="flex items-center gap-2">
          <WandSparklesIcon className="size-3.5 text-primary" />
          <SectionLabel className="text-foreground">Style director</SectionLabel>
        </div>
        <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
          Describe the feeling and get a complete look — motion, palette, face,
          tempo and background. Runs locally against the same lexicon; no API key.
        </p>
        <div className="flex gap-1.5">
          <Input
            value={brief}
            placeholder="Calm futuristic AI launch"
            onChange={(event) => setBrief(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") runDirector();
            }}
            className="h-8 text-xs"
          />
          <Button type="button" size="sm" onClick={runDirector} disabled={!brief.trim()}>
            Apply look
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="tabular font-mono text-[0.65rem]">
          {layer.text.trim() ? controller.project.layers.length : 0} layers
        </Badge>
        <Badge variant="outline" className="tabular font-mono text-[0.65rem]">
          {getTemplate(layer.templateId).name}
        </Badge>
      </div>
    </div>
  );
}
