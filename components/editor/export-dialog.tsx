"use client";

import * as React from "react";
import {
  BracesIcon,
  CodeIcon,
  CopyIcon,
  FileCodeIcon,
  FilmIcon,
  ImagesIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { InfoNote, NumberField, SectionLabel, SegmentedControl, ToggleRow } from "@/components/editor/controls";
import type { StageHandle } from "@/components/editor/stage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildExportModel, downloadFile, generate, type CodeExportKind } from "@/lib/export";
import {
  MAX_DURATION,
  MAX_FRAMES,
  VIDEO_PRESETS,
  VideoExportError,
  recordVideo,
  renderFrames,
  supportedVideoFormats,
  type VideoFormat,
} from "@/lib/video/export";
import type { ProjectState, VideoExportConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The export centre.
 *
 * Every format the app has ever produced is still here — standalone HTML, React
 * component, preset JSON and the GSAP timeline — grouped rather than removed.
 * The video tab only lists containers this browser will actually encode; a
 * button that produces a zero-byte file is worse than a missing button.
 */

const CODE_EXPORTS: readonly {
  kind: CodeExportKind;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  note: string;
}[] = [
  {
    kind: "html",
    icon: CodeIcon,
    title: "Standalone page",
    note: ".html · opens with a double-click, GSAP from CDN, fonts and CSS included",
  },
  {
    kind: "react",
    icon: FileCodeIcon,
    title: "React component",
    note: ".tsx · drop-in client component, needs gsap + @gsap/react",
  },
  {
    kind: "preset",
    icon: BracesIcon,
    title: "Preset",
    note: ".json · the full look, versioned and re-importable",
  },
];

export type ExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectState;
  stage: React.RefObject<StageHandle | null>;
  /** Wraps the preview; the rasteriser finds `.stw-canvas` inside it. */
  canvasRef: React.RefObject<HTMLElement | null>;
};

export function ExportDialog({
  open,
  onOpenChange,
  project,
  stage,
  canvasRef,
}: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,46rem)]">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Everything bakes in the current phrase, layers, template and every slider value.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <ExportPanel project={project} stage={stage} canvasRef={canvasRef} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The dialog body.
 *
 * Split out so it mounts fresh each time the dialog opens: the video defaults
 * are then plain `useState` initialisers reading the current canvas, rather
 * than effects that reach in and reset state after the fact.
 */
function ExportPanel({
  project,
  stage,
  canvasRef,
}: Omit<ExportDialogProps, "open" | "onOpenChange">) {
  const model = React.useMemo(() => buildExportModel(project), [project]);

  const [formats] = React.useState<VideoFormat[]>(supportedVideoFormats);
  const [formatId, setFormatId] = React.useState<string>(() => supportedVideoFormats()[0]?.id ?? "");
  const [config, setConfig] = React.useState<VideoExportConfig>(() => ({
    // Even edges: some encoders pad odd dimensions and shift the whole frame.
    width: Math.round(project.canvas.width / 2) * 2,
    height: Math.round(project.canvas.height / 2) * 2,
    fps: 30,
    duration: 4,
    transparent: project.background.mode === "transparent",
    loops: 1,
  }));
  const [busy, setBusy] = React.useState<null | { label: string; done: number; total: number }>(
    null,
  );

  const format = formats.find((entry) => entry.id === formatId) ?? formats[0] ?? null;
  const transparentProject = model.theme.transparent;

  const download = (kind: CodeExportKind) => {
    const file = generate(kind, project, model);
    downloadFile(file.name, file.body, file.mime);
    toast.success(`${file.label} exported`, { description: file.name });
  };

  const copyTimeline = async () => {
    const file = generate("timeline", project, model);
    try {
      await navigator.clipboard.writeText(file.body);
      toast.success("GSAP timeline copied", {
        description: `${model.layers.map((layer) => layer.template.name).join(" · ")} · runs against the exported markup`,
      });
    } catch {
      // Clipboard access is blocked in some contexts; the file is still useful.
      downloadFile(file.name, file.body, file.mime);
      toast.warning("Clipboard blocked — downloaded instead", { description: file.name });
    }
  };

  const runVideo = async () => {
    const timeline = stage.current?.timeline();
    const canvasEl = canvasRef.current?.querySelector<HTMLElement>(".stw-canvas") ?? null;

    if (!timeline || !canvasEl) {
      toast.error("Nothing to record", {
        description: "The preview is not running — check the phrase and reduce-motion setting.",
      });
      return;
    }
    if (!format) {
      toast.error("No supported video format in this browser.");
      return;
    }

    setBusy({ label: "Recording", done: 0, total: 1 });
    try {
      const result = await recordVideo(
        { canvasEl, timeline, project, theme: model.theme },
        config,
        format,
        (done, total) => setBusy({ label: "Recording", done, total }),
      );
      downloadFile(result.filename, result.blob);
      toast.success("Video exported", {
        description: `${result.filename} · ${(result.blob.size / 1024 / 1024).toFixed(1)} MB`,
      });
    } catch (error) {
      toast.error("Video export failed", {
        description:
          error instanceof VideoExportError ? error.message : "The browser stopped the recording.",
      });
    } finally {
      setBusy(null);
    }
  };

  const runFrames = async () => {
    const timeline = stage.current?.timeline();
    const canvasEl = canvasRef.current?.querySelector<HTMLElement>(".stw-canvas") ?? null;

    if (!timeline || !canvasEl) {
      toast.error("Nothing to render.");
      return;
    }

    setBusy({ label: "Rendering frames", done: 0, total: 1 });
    try {
      const result = await renderFrames(
        { canvasEl, timeline, project, theme: model.theme },
        config,
        (done, total) => setBusy({ label: "Rendering frames", done, total }),
      );
      downloadFile(result.filename, result.blob);
      toast.success(`${result.frames} frames exported`, { description: result.filename });
    } catch (error) {
      toast.error("Frame export failed", {
        description:
          error instanceof VideoExportError ? error.message : "The browser could not encode a PNG.",
      });
    } finally {
      setBusy(null);
    }
  };

  const frameCount = Math.min(MAX_FRAMES, Math.round(config.duration * config.fps));

  return (
    <Tabs defaultValue="web">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="web">Web</TabsTrigger>
              <TabsTrigger value="video">Video</TabsTrigger>
              <TabsTrigger value="frames">Frames</TabsTrigger>
            </TabsList>

            {/* ------------------------------------------------------ Web */}
            <TabsContent value="web" className="space-y-2">
              {CODE_EXPORTS.map((entry) => (
                <Button
                  key={entry.kind}
                  type="button"
                  variant="outline"
                  onClick={() => download(entry.kind)}
                  className="h-auto w-full justify-start gap-2.5 py-2.5 text-left"
                >
                  <entry.icon data-icon="inline-start" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm">{entry.title}</span>
                    <span className="text-[0.7rem] font-normal text-wrap text-muted-foreground">
                      {entry.note}
                    </span>
                  </span>
                </Button>
              ))}

              <Button
                type="button"
                variant="ghost"
                onClick={copyTimeline}
                className="h-auto w-full justify-start gap-2.5 py-2.5 text-left"
              >
                <CopyIcon data-icon="inline-start" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm">Copy GSAP timeline</span>
                  <span className="text-[0.7rem] font-normal text-wrap text-muted-foreground">
                    clipboard · the timeline code alone, with your actual timing and easing
                  </span>
                </span>
              </Button>

              {model.warnings.length > 0 ? (
                <InfoNote>{model.warnings[0]}</InfoNote>
              ) : null}

              {model.fonts.some((font) => font.custom) ? (
                <InfoNote>
                  Your uploaded face is embedded in the standalone page and in the React
                  component as a <code className="font-mono">@font-face</code> data URL, so
                  neither file depends on this editor.
                </InfoNote>
              ) : (
                <InfoNote>
                  The standalone page links the Google Fonts stylesheet it needs. The React
                  component documents it in a header comment instead of injecting a link into
                  your app.
                </InfoNote>
              )}
            </TabsContent>

            {/* ---------------------------------------------------- Video */}
            <TabsContent value="video" className="space-y-4">
              {formats.length === 0 ? (
                <InfoNote>
                  This browser exposes no <code className="font-mono">MediaRecorder</code>{" "}
                  format that can encode a canvas. Frames still work — the PNG sequence tab
                  gives you something to bring into an editor.
                </InfoNote>
              ) : (
                <>
                  <SegmentedControl
                    label="Format"
                    value={format?.id ?? ""}
                    columns={Math.min(3, formats.length)}
                    onChange={(next) => setFormatId(next)}
                    options={formats.map((entry) => ({
                      value: entry.id,
                      label: entry.extension.toUpperCase(),
                      title: entry.label,
                    }))}
                  />

                  <div className="space-y-2">
                    <SectionLabel>Resolution</SectionLabel>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {VIDEO_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            setConfig((previous) => ({
                              ...previous,
                              width: preset.width,
                              height: preset.height,
                            }))
                          }
                          className={cn(
                            "tabular rounded-lg border px-2 py-1.5 text-[0.7rem] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            config.width === preset.width && config.height === preset.height
                              ? "border-primary/60 bg-primary/5 text-foreground"
                              : "border-border bg-card/40 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {preset.width} × {preset.height}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <NumberField
                      id="video-width"
                      label="Width"
                      value={config.width}
                      min={64}
                      max={3840}
                      suffix="px"
                      onChange={(next) => setConfig((p) => ({ ...p, width: next }))}
                    />
                    <NumberField
                      id="video-height"
                      label="Height"
                      value={config.height}
                      min={64}
                      max={3840}
                      suffix="px"
                      onChange={(next) => setConfig((p) => ({ ...p, height: next }))}
                    />
                    <NumberField
                      id="video-fps"
                      label="FPS"
                      value={config.fps}
                      min={10}
                      max={60}
                      onChange={(next) => setConfig((p) => ({ ...p, fps: next }))}
                    />
                    <NumberField
                      id="video-duration"
                      label="Duration"
                      value={config.duration}
                      min={0.5}
                      max={MAX_DURATION}
                      step={0.5}
                      suffix="s"
                      onChange={(next) => setConfig((p) => ({ ...p, duration: next }))}
                    />
                  </div>

                  {format?.alpha && transparentProject ? (
                    <ToggleRow
                      id="video-alpha"
                      label="Keep transparency"
                      hint="Only WebM carries alpha. MP4 will composite onto black."
                      checked={config.transparent}
                      onCheckedChange={(next) =>
                        setConfig((previous) => ({ ...previous, transparent: next }))
                      }
                    />
                  ) : null}

                  <Button
                    type="button"
                    className="w-full"
                    disabled={busy !== null}
                    onClick={() => void runVideo()}
                  >
                    {busy ? (
                      <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
                    ) : (
                      <FilmIcon data-icon="inline-start" />
                    )}
                    {busy
                      ? `${busy.label} ${Math.round((busy.done / Math.max(1, busy.total)) * 100)}%`
                      : `Record ${frameCount} frames`}
                  </Button>

                  <InfoNote>
                    Frames are rasterised from the running timeline, not screen-captured, so
                    the clip is not affected by anything else on your machine. Film grain and
                    the line-wide gradient fill are approximated — everything else matches the
                    preview.
                  </InfoNote>
                </>
              )}
            </TabsContent>

            {/* --------------------------------------------------- Frames */}
            <TabsContent value="frames" className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumberField
                  id="frames-width"
                  label="Width"
                  value={config.width}
                  min={64}
                  max={3840}
                  suffix="px"
                  onChange={(next) => setConfig((p) => ({ ...p, width: next }))}
                />
                <NumberField
                  id="frames-height"
                  label="Height"
                  value={config.height}
                  min={64}
                  max={3840}
                  suffix="px"
                  onChange={(next) => setConfig((p) => ({ ...p, height: next }))}
                />
                <NumberField
                  id="frames-fps"
                  label="FPS"
                  value={config.fps}
                  min={5}
                  max={60}
                  onChange={(next) => setConfig((p) => ({ ...p, fps: next }))}
                />
                <NumberField
                  id="frames-duration"
                  label="Duration"
                  value={config.duration}
                  min={0.5}
                  max={MAX_DURATION}
                  step={0.5}
                  suffix="s"
                  onChange={(next) => setConfig((p) => ({ ...p, duration: next }))}
                />
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={busy !== null}
                onClick={() => void runFrames()}
              >
                {busy ? (
                  <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <ImagesIcon data-icon="inline-start" />
                )}
                {busy
                  ? `${busy.label} ${busy.done} / ${busy.total}`
                  : `Export ${frameCount} PNGs as a zip`}
              </Button>

              <InfoNote>
                PNG keeps the alpha channel, so a transparent project comes out ready to key
                over footage. Frames are capped at {MAX_FRAMES} so a long clip cannot take the
                tab down with it.
              </InfoNote>
            </TabsContent>
    </Tabs>
  );
}
