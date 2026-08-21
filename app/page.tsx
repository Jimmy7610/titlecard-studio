"use client";

import * as React from "react";

import {
  AnimationStage,
  type AnimationStageHandle,
} from "@/components/animation-stage";
import { ControlPanel } from "@/components/control-panel";
import { Badge } from "@/components/ui/badge";
import { splitText } from "@/lib/split";
import { resolveSemanticTemplate } from "@/lib/semantic-engine";
import { DEFAULT_SETTINGS, type GeneratorSettings } from "@/lib/settings";
import { getTemplate } from "@/lib/templates";

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export default function Page() {
  const [settings, setSettings] =
    React.useState<GeneratorSettings>(DEFAULT_SETTINGS);
  const [duration, setDuration] = React.useState(0);
  const stageRef = React.useRef<AnimationStageHandle>(null);

  const update = React.useCallback((patch: Partial<GeneratorSettings>) => {
    setSettings((previous) => ({ ...previous, ...patch }));
  }, []);

  const replay = React.useCallback(() => {
    stageRef.current?.replay();
  }, []);

  const handleDuration = React.useCallback((seconds: number) => {
    setDuration((previous) =>
      Math.abs(previous - seconds) < 0.005 ? previous : seconds,
    );
  }, []);

  // The engine only runs when auto-detect is on; otherwise the manual pick wins.
  const match = React.useMemo(
    () => (settings.semantic ? resolveSemanticTemplate(settings.text) : null),
    [settings.semantic, settings.text],
  );

  const activeTemplateId = match?.templateId ?? settings.templateId;
  const activeTemplate = getTemplate(activeTemplateId);

  const phrase = settings.text.trim();
  const split = React.useMemo(() => splitText(phrase), [phrase]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "r" && event.key !== "R") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target && INPUT_TAGS.has(target.tagName)) return;

      event.preventDefault();
      stageRef.current?.replay();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="app-shell flex min-h-dvh flex-1 flex-col lg:flex-row">
      <ControlPanel
        settings={settings}
        onChange={update}
        onReplay={replay}
        match={match}
        activeTemplateId={activeTemplateId}
        phrase={phrase}
      />

      <section className="order-1 flex min-w-0 flex-1 flex-col gap-4 p-4 lg:order-2 lg:h-dvh lg:p-6">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">
              {activeTemplate.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {activeTemplate.tagline}
              {match ? (
                <>
                  {" · "}
                  <span className="text-primary">
                    semantic override on “{match.word}”
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="tabular font-mono">
              {split.charCount} chars
            </Badge>
            <Badge variant="outline" className="tabular font-mono">
              {split.words.length} masks
            </Badge>
            {split.gradientCount > 0 ? (
              <Badge variant="outline" className="tabular font-mono">
                {split.gradientCount} gradient
              </Badge>
            ) : null}
            <Badge variant="outline" className="tabular font-mono">
              {duration.toFixed(2)}s
            </Badge>
          </div>
        </header>

        <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-2xl border border-border shadow-2xl shadow-black/40">
          {phrase ? (
            <AnimationStage
              ref={stageRef}
              text={phrase}
              templateId={activeTemplateId}
              paletteId={settings.paletteId}
              glyphPool={settings.glyphPool}
              speed={settings.speed}
              stagger={settings.stagger}
              fontSize={settings.fontSize}
              tracking={settings.tracking}
              leading={settings.leading}
              weight={settings.weight}
              invertCanvas={settings.invertCanvas}
              loop={settings.loop}
              onDuration={handleDuration}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-card/30 text-sm text-muted-foreground">
              Type a phrase to animate.
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <p>
            Every character is masked by its own word box — nothing travels
            outside the finished text footprint.
          </p>
          <p>
            Press{" "}
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[0.7rem]">
              R
            </kbd>{" "}
            to replay
          </p>
        </footer>
      </section>
    </main>
  );
}
