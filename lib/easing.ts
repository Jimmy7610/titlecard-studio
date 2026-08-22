import type { EasingId } from "@/lib/types";

export type EasingOption = {
  id: EasingId;
  name: string;
  hint: string;
  /** The GSAP ease string. `null` means "leave the template's own curve". */
  value: string | null;
};

/**
 * A small vocabulary mapped onto real GSAP eases.
 *
 * `template` exists so the curated curve a template was authored with is the
 * default: overriding every ease globally would flatten the difference between
 * a cinematic reveal and a snappy caption, which is the thing being chosen.
 */
export const EASINGS: readonly EasingOption[] = [
  { id: "template", name: "Template default", hint: "Whatever the template was authored with", value: null },
  { id: "smooth", name: "Smooth", hint: "power2.out — even, unhurried", value: "power2.out" },
  { id: "cinematic", name: "Cinematic", hint: "power4.out — long settle", value: "power4.out" },
  { id: "snappy", name: "Snappy", hint: "back.out — slight overshoot", value: "back.out(1.4)" },
  { id: "elastic", name: "Elastic", hint: "elastic.out — springy", value: "elastic.out(1, 0.62)" },
  { id: "linear", name: "Linear", hint: "none — constant rate", value: "none" },
  { id: "power", name: "Power", hint: "power3.inOut — symmetric", value: "power3.inOut" },
  { id: "expo", name: "Expo", hint: "expo.out — very front-loaded", value: "expo.out" },
] as const;

const EASING_INDEX = new Map(EASINGS.map((easing) => [easing.id, easing]));

export function getEasing(id: EasingId): EasingOption {
  return EASING_INDEX.get(id) ?? EASINGS[0];
}

/** Resolves the ease a tween should actually use. */
export function resolveEase(id: EasingId, templateEase: string): string {
  return getEasing(id).value ?? templateEase;
}
