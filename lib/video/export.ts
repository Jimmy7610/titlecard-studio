"use client";

import { captureLayout } from "@/lib/video/layout";
import { paintFrame } from "@/lib/video/paint";
import { ZipBuilder } from "@/lib/video/zip";
import { slugify } from "@/lib/project";
import type { ResolvedTheme } from "@/lib/theme";
import type { ProjectState, VideoExportConfig } from "@/lib/types";
import type { gsap } from "@/lib/gsap";

/**
 * Video and frame export.
 *
 * Frames are produced by seeking the *real* timeline and rasterising what the
 * DOM is showing, so a recording follows the animation the user approved rather
 * than a second implementation of it. Rendering is driven frame by frame
 * against `captureStream(0)`, not in real time, so a slow frame stretches the
 * export instead of dropping out of the video.
 */

export class VideoExportError extends Error {}

/** Thrown when the user stops an export. Not a failure; not reported as one. */
export class ExportCancelled extends Error {
  constructor() {
    super("Export cancelled");
    this.name = "ExportCancelled";
  }
}

/** Beyond this the tab starts fighting for memory rather than encoding. */
export const MAX_FRAMES = 900;
export const MAX_DURATION = 30;

/**
 * The size a PNG sequence may reach before it is refused.
 *
 * A frame cap alone does not bound anything: 900 frames of 320x180 is a
 * rounding error and 900 frames of 4K is not. The archive streams to a Blob so
 * this is disk rather than heap, but a browser download of several gigabytes is
 * a promise the tab usually cannot keep, so the job is refused before it starts
 * rather than after it has eaten the session.
 */
export const MAX_SEQUENCE_BYTES = 700 * 1024 * 1024;

/**
 * A conservative guess at one rendered frame.
 *
 * Titlecard frames are flat colour and type, which PNG compresses hard — a
 * 1080p frame is typically well under 200 KB. A quarter byte per pixel is
 * several times that, which is the right direction to be wrong in for a
 * pre-flight check.
 */
export function estimateFrameBytes(width: number, height: number): number {
  return Math.round(width * height * 0.25) + 2048;
}

export type SequenceBudget = {
  frames: number;
  estimatedBytes: number;
  withinBudget: boolean;
  /** Populated when the job should not be started. */
  message: string | null;
};

/** What a PNG sequence would cost, for the panel to show before it starts. */
export function sequenceBudget(config: VideoExportConfig): SequenceBudget {
  const frames = Math.min(MAX_FRAMES, Math.max(1, Math.round(config.duration * config.fps)));
  const estimatedBytes = frames * estimateFrameBytes(config.width, config.height);
  const withinBudget = estimatedBytes <= MAX_SEQUENCE_BYTES;

  return {
    frames,
    estimatedBytes,
    withinBudget,
    message: withinBudget
      ? null
      : `${frames} frames at ${config.width}x${config.height} is roughly ${(estimatedBytes / 1024 / 1024 / 1024).toFixed(1)} GB, over the ${Math.round(MAX_SEQUENCE_BYTES / 1024 / 1024)} MB this browser can be relied on to deliver. Use fewer frames, a smaller size, or a video format.`,
  };
}

/** Rejects at the next frame boundary once the signal aborts. */
function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new ExportCancelled();
}

export type VideoFormat = {
  id: string;
  label: string;
  extension: string;
  mimeType: string;
  /** True when this container can carry an alpha channel. */
  alpha: boolean;
};

const CANDIDATES: readonly VideoFormat[] = [
  { id: "webm-vp9-alpha", label: "WebM · VP9 with alpha", extension: "webm", mimeType: "video/webm;codecs=vp9", alpha: true },
  { id: "webm-vp8", label: "WebM · VP8", extension: "webm", mimeType: "video/webm;codecs=vp8", alpha: true },
  { id: "webm", label: "WebM", extension: "webm", mimeType: "video/webm", alpha: true },
  { id: "mp4-avc", label: "MP4 · H.264", extension: "mp4", mimeType: "video/mp4;codecs=avc1", alpha: false },
  { id: "mp4", label: "MP4", extension: "mp4", mimeType: "video/mp4", alpha: false },
];

/**
 * The formats this browser will actually encode.
 *
 * Probed rather than assumed: MP4 recording exists in some builds and not
 * others, and offering a button that produces a zero-byte file is worse than
 * not offering it.
 */
export function supportedVideoFormats(): VideoFormat[] {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return [];

  const seen = new Set<string>();
  return CANDIDATES.filter((format) => {
    if (!MediaRecorder.isTypeSupported(format.mimeType)) return false;
    if (seen.has(format.extension)) return false;
    seen.add(format.extension);
    return true;
  });
}

export type RenderTarget = {
  /** The `.stw-canvas` element in the preview. */
  canvasEl: HTMLElement;
  timeline: gsap.core.Timeline;
  project: ProjectState;
  theme: ResolvedTheme;
};

export type Progress = (done: number, total: number) => void;

export type ExportOptions = {
  onProgress?: Progress;
  /** Aborting stops at the next frame and restores the editor. */
  signal?: AbortSignal;
};

type FrameJob = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  frames: number;
  render: (frameIndex: number) => void;
  restore: () => void;
};

async function loadBackgroundImage(project: ProjectState): Promise<HTMLImageElement | null> {
  if (project.background.mode !== "image" || !project.background.imageUrl) return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = project.background.imageUrl;
  });
}

async function prepare(
  target: RenderTarget,
  config: VideoExportConfig,
  alpha: boolean,
): Promise<FrameJob> {
  const { canvasEl, timeline, project, theme } = target;

  const layout = captureLayout(canvasEl);
  if (layout.layers.length === 0) {
    throw new VideoExportError("There is nothing on the canvas to record.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = config.width;
  canvas.height = config.height;
  const ctx = canvas.getContext("2d", { alpha });
  if (!ctx) throw new VideoExportError("This browser did not provide a 2D canvas context.");

  // Fit rather than stretch: the output size is free to differ from the canvas
  // aspect, so the canvas is scaled to fit and centred, and the background is
  // painted across the whole frame behind it.
  const scale = Math.min(config.width / layout.width, config.height / layout.height);
  const frame = {
    width: config.width / scale,
    height: config.height / scale,
    offsetX: (config.width / scale - layout.width) / 2,
    offsetY: (config.height / scale - layout.height) / 2,
  };
  const image = await loadBackgroundImage(project);

  const total = Math.min(MAX_FRAMES, Math.round(config.duration * config.fps));
  if (total < 1) throw new VideoExportError("The clip is too short to render a frame.");

  // The preview timeline is the source of truth, so it gets driven directly —
  // and put back where it was when the export finishes.
  const wasPaused = timeline.paused();
  const startedAt = timeline.time();
  timeline.pause();

  return {
    canvas,
    ctx,
    frames: total,
    render: (index) => {
      const time = (index / config.fps) % Math.max(0.001, timeline.duration());
      timeline.seek(time, false);
      paintFrame(ctx, { layout, theme, project, scale, frame, alpha }, image);
    },
    restore: () => {
      timeline.seek(startedAt, false);
      if (!wasPaused) timeline.play();
      // The scratch canvas is the largest single allocation an export makes.
      // Zeroing it lets the backing store go before the next one is created.
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

/** Lets the browser paint and keeps the tab responsive between frames. */
const nextFrame = () =>
  new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

export async function recordVideo(
  target: RenderTarget,
  config: VideoExportConfig,
  format: VideoFormat,
  options: ExportOptions = {},
): Promise<{ blob: Blob; filename: string }> {
  if (typeof MediaRecorder === "undefined") {
    throw new VideoExportError("This browser has no MediaRecorder — video export is unavailable.");
  }
  const { onProgress, signal } = options;
  throwIfCancelled(signal);

  const alpha = config.transparent && format.alpha && target.theme.transparent;
  const job = await prepare(target, config, alpha);

  // A zero-fps stream only emits the frames we ask it for, which is what lets
  // a slow render stretch wall-clock time without stretching the video.
  const stream = job.canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;

  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: Math.round(config.width * config.height * config.fps * 0.12),
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const finished = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new VideoExportError("The recorder stopped unexpectedly."));
  });

  let cancelled = false;

  try {
    recorder.start();
    const passes = Math.max(1, config.loops);

    for (let pass = 0; pass < passes; pass += 1) {
      for (let frame = 0; frame < job.frames; frame += 1) {
        throwIfCancelled(signal);
        job.render(frame);
        track.requestFrame();
        onProgress?.(pass * job.frames + frame + 1, job.frames * passes);
        // Yielding every frame keeps the UI alive; batching would freeze it.
        await nextFrame();
      }
    }

    recorder.stop();
    await finished;
  } catch (error) {
    cancelled = error instanceof ExportCancelled;
    throw error;
  } finally {
    // Every exit path stops the recorder and the track. A running MediaRecorder
    // holds the canvas alive and keeps writing, so leaving one behind on the
    // cancel path is a leak that survives the dialog closing.
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* already stopping */
      }
    }
    for (const streamTrack of stream.getTracks()) streamTrack.stop();
    job.restore();
    // A cancelled run has partial chunks that would decode as a broken file.
    if (cancelled) chunks.length = 0;
  }

  const blob = new Blob(chunks, { type: format.mimeType.split(";")[0] });
  if (blob.size === 0) {
    throw new VideoExportError(
      "The recorder produced an empty file. Try a different format or a shorter clip.",
    );
  }

  const stem = slugify(target.project.layers[0]?.text || target.project.name);
  return { blob, filename: `${stem}.${format.extension}` };
}

export async function renderFrames(
  target: RenderTarget,
  config: VideoExportConfig,
  options: ExportOptions = {},
): Promise<{ blob: Blob; filename: string; frames: number }> {
  const { onProgress, signal } = options;
  throwIfCancelled(signal);

  const budget = sequenceBudget(config);
  if (!budget.withinBudget) throw new VideoExportError(budget.message!);

  const alpha = config.transparent && target.theme.transparent;
  const job = await prepare(target, config, alpha);
  const archive = new ZipBuilder();
  const stem = slugify(target.project.layers[0]?.text || target.project.name);

  try {
    for (let frame = 0; frame < job.frames; frame += 1) {
      throwIfCancelled(signal);
      job.render(frame);

      const blob = await new Promise<Blob | null>((resolve) =>
        job.canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new VideoExportError("This browser could not encode a PNG.");

      // The blob goes into the archive as a blob. Reading it into a byte array
      // here is what used to put every frame of the sequence on the JS heap.
      await archive.add(`${stem}/${stem}-${String(frame).padStart(4, "0")}.png`, blob);

      // Compressed reality can run ahead of the estimate; stop before the tab
      // does rather than after.
      if (archive.bytes > MAX_SEQUENCE_BYTES) {
        throw new VideoExportError(
          `The sequence passed ${Math.round(MAX_SEQUENCE_BYTES / 1024 / 1024)} MB at frame ${frame + 1}. Use fewer frames, a smaller size, or a video format.`,
        );
      }

      onProgress?.(frame + 1, job.frames);
      await nextFrame();
    }
  } finally {
    job.restore();
  }

  return { blob: archive.finish(), filename: `${stem}-frames.zip`, frames: archive.count };
}

/** Sensible video presets, kept away from sizes that lock up a tab. */
export const VIDEO_PRESETS: readonly { id: string; label: string; width: number; height: number }[] = [
  { id: "720p", label: "720p landscape", width: 1280, height: 720 },
  { id: "1080p", label: "1080p landscape", width: 1920, height: 1080 },
  { id: "vertical", label: "1080 × 1920 vertical", width: 1080, height: 1920 },
  { id: "square", label: "1080 × 1080 square", width: 1080, height: 1080 },
];
