import { buildFromSpec } from "@/lib/animation/runtime";
import { baseline } from "@/lib/animation/effects";
import type { gsap } from "@/lib/gsap";
import { LEGACY_TEMPLATES } from "@/lib/templates/legacy";
import { SPEC_TEMPLATES } from "@/lib/templates/library";
import {
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  type TemplateContext,
  type TemplateDefinition,
  type TemplateId,
} from "@/lib/templates/types";

export type {
  TemplateId,
  TemplateCategory,
  TemplateDefinition,
  TemplateFamily,
  TemplateContext,
  CharUnit,
  WordUnit,
  StagePalette,
} from "@/lib/templates/types";
export { TEMPLATE_CATEGORIES } from "@/lib/templates/types";
export { LEGACY_TEMPLATE_IDS } from "@/lib/templates/legacy";

/**
 * Every template, ordered by category so the gallery and the picker agree.
 *
 * The six originals carry hand-written builders; everything after them is a
 * `MotionSpec` interpreted by `lib/animation/runtime`. Both kinds produce a
 * real GSAP timeline, so nothing downstream — export, video capture, playback —
 * needs to know which is which.
 */
export const TEMPLATES: readonly TemplateDefinition[] = [
  ...LEGACY_TEMPLATES,
  ...SPEC_TEMPLATES,
].sort((a, b) => {
  const order = TEMPLATE_CATEGORIES.map((category) => category.id);
  const byCategory = order.indexOf(a.category) - order.indexOf(b.category);
  return byCategory !== 0 ? byCategory : a.name.localeCompare(b.name);
});

const TEMPLATE_INDEX = new Map(TEMPLATES.map((template) => [template.id, template]));

/**
 * Falls back to the first template rather than throwing. This id can arrive
 * from a preset written against another build, and an unknown name should
 * degrade to a default look — not take the whole page down.
 */
export function getTemplate(id: TemplateId): TemplateDefinition {
  return TEMPLATE_INDEX.get(id) ?? TEMPLATES[0];
}

export function hasTemplate(id: string): id is TemplateId {
  return TEMPLATE_INDEX.has(id as TemplateId);
}

export function templatesByCategory(
  category: TemplateCategory,
): TemplateDefinition[] {
  return TEMPLATES.filter((template) => template.category === category);
}

/** Builds a template's timeline, whichever kind it is. */
export function buildTemplate(
  template: TemplateDefinition,
  timeline: gsap.core.Timeline,
  context: TemplateContext,
): void {
  if (template.build) {
    template.build(timeline, context);
    return;
  }
  if (template.spec) {
    // The hand-written templates each open with their own `baseline` call; the
    // spec ones get it here so a spec never has to restate the reset.
    baseline(timeline, context);
    buildFromSpec(timeline, template.spec, context);
  }
}
