import assert from "node:assert/strict";
import { test } from "node:test";

import { aspectLabel, canvasFromFormat, clampEdge } from "../lib/canvas-formats";
import { buildExportModel, generate } from "../lib/export";
import { resolveEase } from "../lib/easing";
import { BUILTIN_PRESETS, applyPreset } from "../lib/presets/builtin";
import { DEFAULT_PROJECT } from "../lib/project";
import { TEMPLATES, TEMPLATE_CATEGORIES, getTemplate, hasTemplate } from "../lib/templates";
import type { ProjectState } from "../lib/types";

/**
 * The built-in looks, the template registry and the export model.
 *
 * File parsing and migration live in `persistence.test.ts`; this covers the
 * data the app ships with and the model every exporter is built from.
 */

const project: ProjectState = {
  ...DEFAULT_PROJECT,
  name: "Round trip",
  paletteId: "ice",
  invertCanvas: true,
  canvas: { formatId: "tiktok", width: 1080, height: 1920, safeZones: true },
  typography: { ...DEFAULT_PROJECT.typography, fontId: "playfair", weight: 700, tracking: 0.14 },
  motion: { ...DEFAULT_PROJECT.motion, speed: 0.7, stagger: 0.08, easing: "cinematic" },
  layers: [
    {
      ...DEFAULT_PROJECT.layers[0],
      text: "RÄKSMÖRGÅS ✨",
      templateId: "gold-sweep",
      wordStyles: { 1: { gradient: true, scale: 1.2, delay: 0.3 } },
    },
  ],
};

test("every built-in preset is coherent and text-safe", () => {
  for (const preset of BUILTIN_PRESETS) {
    assert.ok(hasTemplate(preset.templateId), `${preset.id} references ${preset.templateId}`);

    const after = applyPreset(project, preset);
    assert.equal(after.layers[0].text, project.layers[0].text, `${preset.id} changed the text`);
    assert.deepEqual(after.canvas, project.canvas, `${preset.id} changed the canvas`);
    assert.deepEqual(
      after.layers[0].wordStyles,
      project.layers[0].wordStyles,
      `${preset.id} changed word styling`,
    );
    assert.equal(after.layers[0].templateId, preset.templateId);
  }
});

test("preset ids are unique", () => {
  const ids = BUILTIN_PRESETS.map((preset) => preset.id);
  assert.equal(new Set(ids).size, ids.length);
});

/* ------------------------------------------------------------------ *
 * Templates and configuration
 * ------------------------------------------------------------------ */

test("template ids are unique and every category is populated", () => {
  const ids = TEMPLATES.map((template) => template.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(TEMPLATES.length >= 20, "the library should carry at least 20 templates");

  for (const category of TEMPLATE_CATEGORIES) {
    const inCategory = TEMPLATES.filter((template) => template.category === category.id);
    assert.ok(inCategory.length > 0, `${category.id} is empty`);
  }
});

test("every template can actually build something", () => {
  for (const template of TEMPLATES) {
    assert.ok(
      template.build !== undefined || template.spec !== undefined,
      `${template.id} has neither a builder nor a spec`,
    );
    assert.ok(template.description.length > 40, `${template.id} has no real description`);
  }
});

test("an unknown template id degrades to the first one", () => {
  assert.equal(getTemplate("nope" as never).id, TEMPLATES[0].id);
  assert.equal(hasTemplate("nope"), false);
});

test("easing ids map onto real GSAP curves", () => {
  assert.equal(resolveEase("template", "agentReveal"), "agentReveal");
  assert.equal(resolveEase("smooth", "agentReveal"), "power2.out");
  assert.equal(resolveEase("elastic", "agentReveal"), "elastic.out(1, 0.62)");
});

test("canvas helpers clamp and describe correctly", () => {
  assert.equal(clampEdge(999999), 4096);
  assert.equal(clampEdge(-4), 120);
  assert.equal(clampEdge(Number.NaN), 120);
  assert.equal(aspectLabel(1920, 1080), "16:9");
  assert.equal(aspectLabel(1080, 1920), "9:16");
  assert.equal(aspectLabel(1080, 1350), "4:5");

  const swapped = canvasFromFormat("tiktok", DEFAULT_PROJECT.canvas);
  assert.equal(swapped.width, 1080);
  assert.equal(swapped.height, 1920);
  assert.equal(canvasFromFormat("nope", DEFAULT_PROJECT.canvas).formatId, "custom");
});

/* ------------------------------------------------------------------ *
 * Export configuration
 * ------------------------------------------------------------------ */

test("the export model reflects the project it was built from", () => {
  const model = buildExportModel(project);
  assert.equal(model.layers.length, 1);
  assert.equal(model.layers[0].template.id, "gold-sweep");
  assert.equal(model.layers[0].typography.fontId, "playfair");
  assert.equal(model.easeOverride, "power4.out");
  // The word delay reaches the timing layer as seconds.
  assert.equal(model.layers[0].wordDelays[1], 0.3);
});

test("hidden and empty layers are left out of every export", () => {
  const model = buildExportModel({
    ...project,
    layers: [
      { ...project.layers[0], id: "a" },
      { ...project.layers[0], id: "b", text: "   " },
      { ...project.layers[0], id: "c", visible: false },
    ],
  });
  assert.equal(model.layers.length, 1);
});

test("each export kind produces a plausible file", () => {
  for (const kind of ["html", "react", "project", "timeline"] as const) {
    const file = generate(kind, project);
    assert.ok(file.body.length > 500, `${kind} is suspiciously short`);
    assert.ok(file.name.length > 0);
    assert.ok(file.mime.includes("/"));
  }

  assert.ok(generate("html", project).body.startsWith("<!doctype html>"));
  assert.ok(generate("react", project).body.startsWith('"use client"'));
  assert.doesNotThrow(() => JSON.parse(generate("project", project).body));
});
