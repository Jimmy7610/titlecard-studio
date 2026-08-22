import type { SpecPalette, SpecTarget } from "@/lib/animation/spec";

/**
 * One animated box.
 *
 * `el` is the transformed element, `real` holds the actual text and `glyph` is
 * an empty overlay the scramble templates write into — keeping the real text in
 * the layout at all times means a decode never shifts the line, however wide the
 * substituted glyph is.
 */
export type CharUnit = {
  el: HTMLElement;
  glyph: HTMLElement;
  real: HTMLElement;
  /** Index across the whole phrase. Drives stagger order. */
  index: number;
  wordIndex: number;
  isGradient: boolean;
};

export type WordUnit = {
  el: HTMLElement;
  flash: HTMLElement | null;
  chars: CharUnit[];
  index: number;
};

/** Resting colours every template reads its tween targets from. */
export type StagePalette = SpecPalette;

export type TemplateContext = {
  units: CharUnit[];
  words: WordUnit[];
  debris: HTMLElement[];
  underline: HTMLElement | null;
  cursor: HTMLElement | null;
  palette: StagePalette;
  /** Character pool the scramble templates draw from. */
  glyphPool: string;
  /** 1 = reference tempo. Higher is faster. */
  speed: number;
  /** Seconds between neighbouring units, before the speed multiplier. */
  stagger: number;
  /** `null` keeps each template's authored curve. */
  easeOverride?: string | null;
  /** Extra seconds per unit index, from per-word emphasis. */
  unitDelays?: readonly number[];
};

export const boxes = (units: CharUnit[]) => units.map((unit) => unit.el);
export const glyphsOf = (units: CharUnit[]) => units.map((unit) => unit.glyph);
export const realsOf = (units: CharUnit[]) => units.map((unit) => unit.real);
export const plainOf = (units: CharUnit[]) => units.filter((unit) => !unit.isGradient);
export const gradientOf = (units: CharUnit[]) => units.filter((unit) => unit.isGradient);

export function flashesOf(words: WordUnit[]): HTMLElement[] {
  return words
    .map((word) => word.flash)
    .filter((node): node is HTMLElement => node !== null);
}

/** Resolves a spec target name to the DOM nodes it addresses. */
export function selectTargets(
  target: SpecTarget,
  context: TemplateContext,
): HTMLElement[] {
  const { units, words, debris, underline, cursor } = context;

  switch (target) {
    case "chars":
      return boxes(units);
    case "plain":
      return boxes(plainOf(units));
    case "gradient":
      return boxes(gradientOf(units));
    case "glyphs":
      return glyphsOf(units);
    case "reals":
      return realsOf(units);
    case "flashes":
      return flashesOf(words);
    case "words":
      return words.map((word) => word.el);
    case "underline":
      return underline ? [underline] : [];
    case "cursor":
      return cursor ? [cursor] : [];
    case "debris":
      return debris;
  }
}

/** How many units a target addresses — the denominator for `spread` and friends. */
export function targetCount(target: SpecTarget, context: TemplateContext): number {
  return selectTargets(target, context).length;
}
