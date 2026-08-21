import { mulberry32 } from "@/lib/random";

export type DebrisSpec = {
  key: string;
  /** Percentage offsets inside the text bounding box. */
  left: number;
  top: number;
  /** Size in `em`, so debris scales with the display type. */
  size: number;
  tone: "hot" | "warm" | "sun";
};

const TONES = ["hot", "warm", "sun"] as const;

/**
 * Pixel debris that flickers around the wordmark in the reference clip.
 * Positions are generated once, deterministically, and stay inside the text
 * footprint — nothing flies in from off-screen.
 */
export const DEBRIS: readonly DebrisSpec[] = Array.from({ length: 18 }, (_, index) => {
  const rand = mulberry32(index * 9176 + 31);
  const left = rand() * 104 - 2;
  const top = rand() * 108 - 4;
  const size = 0.035 + rand() * 0.055;
  const tone = TONES[Math.floor(rand() * TONES.length)];

  return {
    key: `debris-${index}`,
    left: Math.round(left * 100) / 100,
    top: Math.round(top * 100) / 100,
    size: Math.round(size * 1000) / 1000,
    tone,
  } satisfies DebrisSpec;
});
