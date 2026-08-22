import type { SpecTarget } from "@/lib/animation/spec";

/**
 * The minimum a consumer needs to know about a unit to compute timing.
 *
 * Both the live preview (which has DOM nodes) and the code exporters (which
 * have only the split phrase) can produce this, which is what lets one timing
 * calculation serve both.
 */
export type UnitMeta = {
  index: number;
  wordIndex: number;
  isGradient: boolean;
};

/** Targets addressed per unit rather than per word or per phrase. */
const UNIT_TARGETS = new Set<SpecTarget>(["chars", "plain", "gradient", "glyphs", "reals"]);

export function isUnitTarget(target: SpecTarget): boolean {
  return UNIT_TARGETS.has(target);
}

/** The units a target addresses, in the order GSAP will see them. */
export function unitsForTarget(target: SpecTarget, units: readonly UnitMeta[]): UnitMeta[] {
  switch (target) {
    case "plain":
      return units.filter((unit) => !unit.isGradient);
    case "gradient":
      return units.filter((unit) => unit.isGradient);
    case "chars":
    case "glyphs":
    case "reals":
      return [...units];
    default:
      return [];
  }
}

/**
 * Extra seconds per position in a target's element list.
 *
 * Word emphasis is authored per word, but GSAP staggers by position in the
 * array it was handed — so the per-word delay has to be projected onto that
 * array before it means anything.
 */
export function delaysForTarget(
  target: SpecTarget,
  units: readonly UnitMeta[],
  wordDelays: Readonly<Record<number, number>>,
): number[] {
  if (!isUnitTarget(target)) return [];
  return unitsForTarget(target, units).map((unit) => wordDelays[unit.wordIndex] ?? 0);
}

export function countForTarget(
  target: SpecTarget,
  units: readonly UnitMeta[],
  wordCount: number,
  extras: { debris: number; hasUnderline: boolean; hasCursor: boolean },
): number {
  switch (target) {
    case "words":
    case "flashes":
      return wordCount;
    case "underline":
      return extras.hasUnderline ? 1 : 0;
    case "cursor":
      return extras.hasCursor ? 1 : 0;
    case "debris":
      return extras.debris;
    default:
      return unitsForTarget(target, units).length;
  }
}
