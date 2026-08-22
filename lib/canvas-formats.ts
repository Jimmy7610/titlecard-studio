import type { CanvasConfig } from "@/lib/types";

export type CanvasFormat = {
  id: string;
  name: string;
  /** Where the format is used, shown under the name. */
  note: string;
  ratio: string;
  width: number;
  height: number;
  group: "video" | "social" | "square" | "cinema";
  /** Editing guides, in percent of the canvas, for platform chrome. */
  safe?: { top: number; bottom: number; left: number; right: number };
};

/**
 * Safe-zone insets are approximations of each platform's UI overlay, taken
 * from the published creator guidelines. They are editing guides only — the
 * exporters never render them.
 */
export const CANVAS_FORMATS: readonly CanvasFormat[] = [
  {
    id: "youtube",
    name: "YouTube / Landscape",
    note: "16:9 · 1920 × 1080",
    ratio: "16:9",
    width: 1920,
    height: 1080,
    group: "video",
    safe: { top: 5, bottom: 10, left: 5, right: 5 },
  },
  {
    id: "tiktok",
    name: "TikTok / Reels / Shorts",
    note: "9:16 · 1080 × 1920",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    group: "social",
    safe: { top: 12, bottom: 20, left: 6, right: 18 },
  },
  {
    id: "instagram-square",
    name: "Instagram Square",
    note: "1:1 · 1080 × 1080",
    ratio: "1:1",
    width: 1080,
    height: 1080,
    group: "square",
    safe: { top: 6, bottom: 6, left: 6, right: 6 },
  },
  {
    id: "instagram-portrait",
    name: "Instagram Portrait",
    note: "4:5 · 1080 × 1350",
    ratio: "4:5",
    width: 1080,
    height: 1350,
    group: "social",
    safe: { top: 8, bottom: 14, left: 6, right: 6 },
  },
  {
    id: "cinema",
    name: "Cinema",
    note: "21:9 · 2560 × 1080",
    ratio: "21:9",
    width: 2560,
    height: 1080,
    group: "cinema",
    safe: { top: 6, bottom: 6, left: 4, right: 4 },
  },
  {
    id: "hd-720",
    name: "HD Landscape",
    note: "16:9 · 1280 × 720",
    ratio: "16:9",
    width: 1280,
    height: 720,
    group: "video",
    safe: { top: 5, bottom: 10, left: 5, right: 5 },
  },
] as const;

export const CUSTOM_FORMAT_ID = "custom";

/** Hard ceiling on either axis. Beyond this a browser canvas gets unreliable. */
export const MAX_CANVAS_EDGE = 4096;
export const MIN_CANVAS_EDGE = 120;

const FORMAT_INDEX = new Map(CANVAS_FORMATS.map((format) => [format.id, format]));

export function getCanvasFormat(id: string): CanvasFormat | null {
  return FORMAT_INDEX.get(id) ?? null;
}

export function clampEdge(value: number): number {
  if (!Number.isFinite(value)) return MIN_CANVAS_EDGE;
  return Math.min(MAX_CANVAS_EDGE, Math.max(MIN_CANVAS_EDGE, Math.round(value)));
}

export function canvasFromFormat(id: string, previous: CanvasConfig): CanvasConfig {
  const format = getCanvasFormat(id);
  if (!format) return { ...previous, formatId: CUSTOM_FORMAT_ID };
  return {
    ...previous,
    formatId: format.id,
    width: format.width,
    height: format.height,
  };
}

/** Reduces a width/height pair to its simplest ratio, for the readout. */
export function aspectLabel(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height) || 1;
  const w = Math.round(width / divisor);
  const h = Math.round(height / divisor);
  // Anything past two digits reads as noise rather than as a ratio.
  if (w > 99 || h > 99) return `${(width / height).toFixed(2)}:1`;
  return `${w}:${h}`;
}
