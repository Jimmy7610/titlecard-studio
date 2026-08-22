"use client";

import * as React from "react";
import { ShuffleIcon } from "lucide-react";
import { toast } from "sonner";

import {
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
import { EASINGS } from "@/lib/easing";
import { RANGES } from "@/lib/project";
import { applyLook, surprise } from "@/lib/semantic/engine";
import { getTemplate } from "@/lib/templates";
import type { EasingId, MotionConfig } from "@/lib/types";

/**
 * Motion.
 *
 * Basic is four numbers; everything a template author would want is behind
 * Advanced. Exposing GSAP's whole vocabulary by default would make the panel
 * honest and unusable at the same time.
 */
export function MotionPanel({ controller }: { controller: ProjectController }) {
  const { project, update, layer } = controller;
  const motion = project.motion;

  /** A small ring so Surprise Me can be stepped through, not just re-rolled. */
  const history = React.useRef<number[]>([]);
  const cursor = React.useRef(-1);

  const setMotion = (patch: Partial<MotionConfig>, tag: string) =>
    update({ motion: { ...motion, ...patch } }, { tag });

  const applySeed = (seed: number) => {
    const result = surprise(seed);
    update((previous) => applyLook(previous, result.look, result.templateId), {
      tag: `surprise-${seed}`,
    });
    toast.success(`${result.mood.label} · ${getTemplate(result.templateId).name}`, {
      description: "A variation inside one style family, not a random draw.",
    });
  };

  const roll = () => {
    const seed = Math.floor(Math.random() * 1e9);
    history.current = [...history.current.slice(0, cursor.current + 1), seed].slice(-24);
    cursor.current = history.current.length - 1;
    applySeed(seed);
  };

  const stepHistory = (direction: -1 | 1) => {
    const next = cursor.current + direction;
    if (next < 0 || next >= history.current.length) return;
    cursor.current = next;
    applySeed(history.current[next]);
  };

  return (
    <div className="space-y-5">
      <SliderField
        id="speed"
        label="Speed"
        value={motion.speed}
        display={`${motion.speed.toFixed(2)}×`}
        range={RANGES.speed}
        hint="Divides every duration in the timeline. 1.00× is the authored tempo."
        onValueChange={(next) => setMotion({ speed: next }, "motion.speed")}
      />

      <SliderField
        id="stagger"
        label="Stagger"
        value={motion.stagger}
        display={`${(motion.stagger * 1000).toFixed(0)} ms`}
        range={RANGES.stagger}
        hint="Delay between neighbouring units, before the speed multiplier."
        onValueChange={(next) => setMotion({ stagger: next }, "motion.stagger")}
      />

      <SliderField
        id="delay"
        label="Start delay"
        value={motion.delay}
        display={`${motion.delay.toFixed(2)} s`}
        range={RANGES.delay}
        onValueChange={(next) => setMotion({ delay: next }, "motion.delay")}
      />

      <Field label="Easing" htmlFor="easing" hint="Structural curves — stepped and linear — are never replaced.">
        <Select
          items={EASINGS.map((entry) => ({ value: entry.id, label: entry.name }))}
          value={motion.easing}
          onValueChange={(value) => setMotion({ easing: value as EasingId }, "motion.easing")}
        >
          <SelectTrigger id="easing" className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EASINGS.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                <span className="flex flex-col gap-0.5 py-0.5">
                  <span className="text-sm">{entry.name}</span>
                  <span className="font-mono text-[0.7rem] text-muted-foreground">
                    {entry.hint}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <ToggleRow
        id="loop"
        label="Loop"
        hint="Replays after a hold on the resting frame."
        checked={motion.loop}
        onCheckedChange={(next) => setMotion({ loop: next }, "motion.loop")}
      />

      {motion.loop ? (
        <SliderField
          id="hold"
          label="Loop hold"
          value={motion.hold}
          display={`${motion.hold.toFixed(1)} s`}
          range={RANGES.hold}
          onValueChange={(next) => setMotion({ hold: next }, "motion.hold")}
        />
      ) : null}

      {/* ------------------------------------------------- Surprise me */}
      <div className="space-y-2.5 rounded-xl border border-border bg-card/50 p-3">
        <SectionLabel>Surprise me</SectionLabel>
        <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
          Picks a style family, then varies inside it — a calm look never gets an
          elastic bounce. Your phrase and canvas are untouched.
        </p>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" onClick={roll} className="flex-1">
            <ShuffleIcon data-icon="inline-start" />
            Surprise me
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Previous variation"
            onClick={() => stepHistory(-1)}
          >
            ←
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Next variation"
            onClick={() => stepHistory(1)}
          >
            →
          </Button>
        </div>
      </div>

      <Collapsible className="space-y-3">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card/40 px-3 py-2 text-xs font-medium transition-colors outline-none hover:bg-card/70 focus-visible:ring-3 focus-visible:ring-ring/50">
          Advanced
          <span className="text-[0.7rem] text-muted-foreground">layer timing · preview</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 rounded-xl border border-border bg-card/40 p-3">
            <SliderField
              id="layer-delay"
              label={`"${layer.name}" delay`}
              value={layer.delay}
              display={`${layer.delay.toFixed(2)} s`}
              range={RANGES.layerDelay}
              hint="When this layer joins the master timeline."
              onValueChange={(next) =>
                controller.updateLayer({ delay: next }, { tag: "layer.delay" })
              }
            />

            <ToggleRow
              id="reduce-preview"
              label="Reduce preview motion"
              hint="Commits the resting frame instead of animating. Exports are unaffected."
              checked={project.reducePreviewMotion}
              onCheckedChange={(next) =>
                update({ reducePreviewMotion: next }, { tag: "reduce-motion" })
              }
            />

            <InfoNote>
              The OS <code className="font-mono">prefers-reduced-motion</code> setting is
              already respected on its own — this switch is for damping the preview while you
              work on something else.
            </InfoNote>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
