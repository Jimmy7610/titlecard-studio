"use client";

import * as React from "react";
import {
  DownloadIcon,
  LayersIcon,
  PaletteIcon,
  PanelRightIcon,
  RedoIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  SquareDashedIcon,
  SwatchBookIcon,
  TypeIcon,
  UndoIcon,
  WandSparklesIcon,
  ZapIcon,
} from "lucide-react";
import { toast } from "sonner";

import { CanvasViewport } from "@/components/editor/canvas-viewport";
import { ExportDialog } from "@/components/editor/export-dialog";
import { Onboarding } from "@/components/editor/onboarding";
import { BackgroundPanel } from "@/components/editor/panels/background-panel";
import { CanvasPanel } from "@/components/editor/panels/canvas-panel";
import { LayersPanel } from "@/components/editor/panels/layers-panel";
import { MotionPanel } from "@/components/editor/panels/motion-panel";
import { PresetsPanel } from "@/components/editor/panels/presets-panel";
import { StylePanel } from "@/components/editor/panels/style-panel";
import { TextPanel } from "@/components/editor/panels/text-panel";
import { TypographyPanel } from "@/components/editor/panels/typography-panel";
import { RightPanel } from "@/components/editor/right-panel";
import type { StageHandle } from "@/components/editor/stage";
import { TemplateGallery } from "@/components/editor/template-gallery";
import { TimelineBar } from "@/components/editor/timeline-bar";
import { Button } from "@/components/ui/button";
import { useProject } from "@/hooks/use-project";
import { buildExportModel } from "@/lib/export";
import { getPalette, gradientOf } from "@/lib/palettes";
import { getTemplate, type TemplateId } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * The editor shell.
 *
 * Three columns and a transport bar: sections on the left, the canvas in the
 * middle with everything else subordinate to it, context settings on the right.
 * The canvas is the largest thing on screen at every breakpoint, because it is
 * the thing being made.
 */

type SectionId =
  | "templates"
  | "text"
  | "typography"
  | "style"
  | "motion"
  | "background"
  | "canvas"
  | "layers"
  | "presets";

const SECTIONS: readonly {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "templates", label: "Templates", icon: WandSparklesIcon },
  { id: "text", label: "Text", icon: TypeIcon },
  { id: "typography", label: "Typography", icon: SwatchBookIcon },
  { id: "style", label: "Style", icon: PaletteIcon },
  { id: "motion", label: "Motion", icon: ZapIcon },
  { id: "background", label: "Background", icon: SlidersHorizontalIcon },
  { id: "canvas", label: "Canvas", icon: SquareDashedIcon },
  { id: "layers", label: "Layers", icon: LayersIcon },
  { id: "presets", label: "Presets", icon: DownloadIcon },
];

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.isContentEditable || TYPING_TAGS.has(element.tagName);
}

export function Editor() {
  const controller = useProject();
  const { project, layer, update, updateLayer, undo, redo, canUndo, canRedo, reset } =
    controller;

  const [section, setSection] = React.useState<SectionId>("templates");
  const [exportOpen, setExportOpen] = React.useState(false);
  const [rightOpen, setRightOpen] = React.useState(true);
  const [duration, setDuration] = React.useState(0);

  const stage = React.useRef<StageHandle>(null);
  const viewport = React.useRef<HTMLDivElement>(null);

  const model = React.useMemo(() => buildExportModel(project), [project]);

  // Bumped whenever the preview is rebuilt, so the transport bar re-attaches
  // its animation frame to the new timeline.
  const rebuildKey = `${project.layers.map((entry) => entry.templateId).join()}-${model.layers.length}`;

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "z") {
        if (isTyping(event.target)) return;
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        if (isTyping(event.target)) return;
        event.preventDefault();
        redo();
        return;
      }
      if (meta) return;
      // Everything below is a bare key, so typing must never trigger it.
      if (isTyping(event.target)) return;

      switch (event.key) {
        case " ":
          event.preventDefault();
          stage.current?.toggle();
          break;
        case "r":
        case "R":
          event.preventDefault();
          stage.current?.replay();
          break;
        case "l":
        case "L":
          event.preventDefault();
          update(
            (previous) => ({
              ...previous,
              motion: { ...previous.motion, loop: !previous.motion.loop },
            }),
            { tag: "motion.loop" },
          );
          break;
        case "ArrowLeft":
          event.preventDefault();
          stage.current?.step(event.shiftKey ? -10 : -1);
          break;
        case "ArrowRight":
          event.preventDefault();
          stage.current?.step(event.shiftKey ? 10 : 1);
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, update]);

  const selectTemplate = (id: TemplateId) => {
    updateLayer({ templateId: id }, { tag: "layer.template" });
  };

  const panel = () => {
    switch (section) {
      case "templates":
        return (
          <TemplateGallery
            phrase={layer.text}
            theme={model.theme}
            activeId={layer.templateId}
            onSelect={selectTemplate}
          />
        );
      case "text":
        return <TextPanel controller={controller} />;
      case "typography":
        return <TypographyPanel controller={controller} />;
      case "style":
        return <StylePanel controller={controller} />;
      case "motion":
        return <MotionPanel controller={controller} />;
      case "background":
        return <BackgroundPanel controller={controller} />;
      case "canvas":
        return <CanvasPanel controller={controller} />;
      case "layers":
        return <LayersPanel controller={controller} />;
      case "presets":
        return <PresetsPanel controller={controller} />;
    }
  };

  const template = getTemplate(layer.templateId);

  return (
    <div className="app-shell flex h-dvh min-h-0 flex-col overflow-hidden">
      {/* ------------------------------------------------------- Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="grid size-6 place-items-center rounded-md text-[0.62rem] font-bold text-black/80"
            style={{ backgroundImage: gradientOf(getPalette(project.paletteId)) }}
            aria-hidden="true"
          >
            ST
          </span>
          <div className="leading-none">
            <p className="text-xs font-semibold">Motion Typography Studio</p>
            <p className="mt-0.5 hidden text-[0.65rem] text-muted-foreground sm:block">
              {template.name} · {duration.toFixed(2)}s
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={undo}
          >
            <UndoIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={redo}
          >
            <RedoIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Reset project"
            onClick={() => {
              if (window.confirm("Reset the project? Your saved presets are kept.")) {
                reset();
                toast.success("Project reset");
              }
            }}
          >
            <RotateCcwIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={rightOpen ? "Hide context panel" : "Show context panel"}
            aria-pressed={rightOpen}
            onClick={() => setRightOpen((previous) => !previous)}
            className="hidden lg:inline-flex"
          >
            <PanelRightIcon />
          </Button>
          <Button type="button" size="sm" onClick={() => setExportOpen(true)}>
            <DownloadIcon data-icon="inline-start" />
            Export
          </Button>
        </div>
      </header>

      {/* --------------------------------------------------------- Body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Rail */}
        <nav
          aria-label="Editor sections"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-1.5 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-b-0"
        >
          {SECTIONS.map((entry) => {
            const active = section === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setSection(entry.id)}
                title={entry.label}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[0.6rem] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:w-14",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <entry.icon className="size-4" />
                {entry.label}
              </button>
            );
          })}
        </nav>

        {/* Left panel */}
        <aside className="order-3 flex w-full shrink-0 flex-col overflow-hidden border-t border-border lg:order-none lg:w-[19rem] lg:border-t-0 lg:border-r">
          <div className="shrink-0 border-b border-border px-4 py-2.5">
            <h2 className="text-xs font-semibold tracking-tight">
              {SECTIONS.find((entry) => entry.id === section)?.label}
            </h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{panel()}</div>
        </aside>

        {/* Canvas */}
        <main className="order-1 flex min-h-[45dvh] min-w-0 flex-1 flex-col lg:order-none lg:min-h-0">
          <div ref={viewport} className="flex min-h-0 flex-1 flex-col">
            <CanvasViewport
              model={model}
              reduceMotion={project.reducePreviewMotion}
              onReady={setDuration}
              stageRef={stage}
            />
          </div>
          <TimelineBar
            stage={stage}
            loop={project.motion.loop}
            rebuildKey={rebuildKey}
            onLoopChange={(next) =>
              update(
                (previous) => ({ ...previous, motion: { ...previous.motion, loop: next } }),
                { tag: "motion.loop" },
              )
            }
          />
        </main>

        {/* Right panel */}
        {rightOpen ? (
          <aside className="order-4 hidden w-[19rem] shrink-0 border-l border-border lg:order-none lg:block">
            <RightPanel controller={controller} />
          </aside>
        ) : null}
      </div>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        project={project}
        stage={stage}
        canvasRef={viewport}
      />

      <Onboarding />
    </div>
  );
}
