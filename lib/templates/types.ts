import type { MotionSpec } from "@/lib/animation/spec";
import type { TemplateContext } from "@/lib/animation/units";
import type { gsap } from "@/lib/gsap";

export type TemplateId =
  // Clean
  | "weightless-blur"
  | "fade-up"
  | "soft-reveal"
  | "slide-reveal"
  | "focus-in"
  | "line-mask"
  // Cinematic
  | "agent-reveal"
  | "film-title"
  | "dramatic-mask"
  | "light-sweep"
  | "letterbox-reveal"
  // Tech
  | "glyph-decode"
  | "glitch-mask"
  | "odometer-roll"
  | "terminal-type"
  | "scanline"
  | "data-stream"
  // Social
  | "punch-words"
  | "pop-caption"
  | "bounce-reveal"
  | "zoom-impact"
  // Luxury
  | "ribbon-wipe"
  | "editorial-reveal"
  | "luxury-tracking"
  | "gold-sweep"
  // Experimental
  | "wave"
  | "split-reveal"
  | "particle-assemble";

export type TemplateCategory =
  | "clean"
  | "cinematic"
  | "tech"
  | "social"
  | "luxury"
  | "experimental";

export const TEMPLATE_CATEGORIES: readonly {
  id: TemplateCategory;
  name: string;
  note: string;
}[] = [
  { id: "clean", name: "Clean", note: "Restrained reveals that stay out of the way" },
  { id: "cinematic", name: "Cinematic", note: "Slow, weighted, title-sequence motion" },
  { id: "tech", name: "Tech", note: "Decode, scan and terminal behaviour" },
  { id: "social", name: "Social", note: "Fast hooks built for vertical video" },
  { id: "luxury", name: "Luxury", note: "Editorial pacing and generous tracking" },
  { id: "experimental", name: "Experimental", note: "Motion with a point of view" },
] as const;

/** `mask` templates clip inside the word box; `terminal` ones substitute glyphs. */
export type TemplateFamily = "mask" | "terminal";

export type TemplateDefinition = {
  id: TemplateId;
  name: string;
  category: TemplateCategory;
  family: TemplateFamily;
  tagline: string;
  description: string;
  /** Drives the glyph-pool control's visibility. */
  usesGlyphs: boolean;
  /** Reserves inline space for a block cursor after the phrase. */
  showCursor: boolean;
  /**
   * Relaxes the word box's `overflow: hidden`.
   *
   * The mask is the premise of this app, and most templates want it. But a
   * template whose whole idea is oversize scale or a seeded scatter is not
   * "bounded" by the mask, it is amputated by it — so those few opt out
   * explicitly rather than being quietly clipped.
   */
  unmasked?: boolean;
  /**
   * Declarative templates carry a spec, which the preview builder and the code
   * exporters both consume. The six originals predate the spec system and keep
   * their hand-written builder plus a hand-written source string, so their
   * motion and their exports are byte-for-byte what they always were.
   */
  spec?: MotionSpec;
  build?: (timeline: gsap.core.Timeline, context: TemplateContext) => void;
};

export type { TemplateContext, CharUnit, WordUnit, StagePalette } from "@/lib/animation/units";
