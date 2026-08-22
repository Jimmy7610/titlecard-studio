import assert from "node:assert/strict";
import { test } from "node:test";

import { aspectLabel, canvasFromFormat, clampEdge } from "../lib/canvas-formats";
import { buildExportModel, generate } from "../lib/export";
import { resolveEase } from "../lib/easing";
import { BUILTIN_PRESETS, applyPreset } from "../lib/presets/builtin";
import { PresetError, parsePreset, presetJson } from "../lib/presets/schema";
import { DEFAULT_PROJECT } from "../lib/project";
import { TEMPLATES, TEMPLATE_CATEGORIES, getTemplate, hasTemplate } from "../lib/templates";
import type { ProjectState } from "../lib/types";

/**
 * Preset handling is the other high-risk area: it is the only place the app
 * reads data it did not write, and it must never crash, never half-apply, and
 * never take a user's phrase away from them.
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

test("a preset survives a round trip", () => {
  const parsed = parsePreset(presetJson(project));

  assert.equal(parsed.project.paletteId, "ice");
  assert.equal(parsed.project.invertCanvas, true);
  assert.deepEqual(parsed.project.canvas, project.canvas);
  assert.equal(parsed.project.typography.fontId, "playfair");
  assert.equal(parsed.project.typography.weight, 700);
  assert.equal(parsed.project.motion.easing, "cinematic");
  assert.equal(parsed.project.layers[0].templateId, "gold-sweep");
  assert.deepEqual(parsed.project.layers[0].wordStyles, { 1: { gradient: true, scale: 1.2, delay: 0.3 } });
  // The phrase comes back separately, so importing a look cannot overwrite one.
  assert.deepEqual(parsed.texts, ["RÄKSMÖRGÅS ✨"]);
});

test("migrates a version 1 preset without losing anything it could express", () => {
  const v1 = JSON.stringify({
    $schema: "semantic-text-animator/preset@1",
    phrase: "Agent 3",
    template: "odometer-roll",
    palette: "plasma",
    glyphPool: "katakana",
    motion: { speed: 1.6, stagger: 0.012, loop: false },
    type: { fontSize: 7.5, tracking: 0.2, leading: 1.6, weight: 500 },
    canvas: "dark",
  });

  const parsed = parsePreset(v1);
  assert.equal(parsed.sourceVersion, 1);
  assert.equal(parsed.project.layers[0].templateId, "odometer-roll");
  assert.equal(parsed.project.layers[0].glyphPool, "katakana");
  assert.equal(parsed.project.paletteId, "plasma");
  assert.equal(parsed.project.invertCanvas, true);
  assert.equal(parsed.project.motion.speed, 1.6);
  assert.equal(parsed.project.motion.stagger, 0.012);
  assert.equal(parsed.project.motion.loop, false);
  assert.equal(parsed.project.typography.fontSize, 7.5);
  assert.equal(parsed.project.typography.leading, 1.6);
  assert.equal(parsed.project.typography.weight, 500);
  assert.deepEqual(parsed.texts, ["Agent 3"]);
  assert.ok(parsed.warnings.some((w) => w.includes("version 1")));
});

test("a v1 preset with no version marker is still recognised", () => {
  const parsed = parsePreset(JSON.stringify({ phrase: "Hi", template: "agent-reveal" }));
  assert.equal(parsed.sourceVersion, 1);
  assert.equal(parsed.project.layers[0].templateId, "agent-reveal");
});

test("unknown fields from a newer schema are ignored, not fatal", () => {
  const parsed = parsePreset(
    JSON.stringify({ schemaVersion: 99, name: "Future", somethingNew: { deeply: [1, 2] }, layers: [{ text: "Hi" }] }),
  );
  assert.equal(parsed.project.name, "Future");
  assert.ok(parsed.warnings.some((w) => w.includes("newer version")));
});

test("an unknown template degrades instead of throwing", () => {
  const parsed = parsePreset(JSON.stringify({ schemaVersion: 2, layers: [{ templateId: "no-such", text: "Hi" }] }));
  assert.equal(parsed.project.layers[0].templateId, "agent-reveal");
  assert.ok(parsed.warnings.some((w) => w.includes("Unknown template")));
});

test("missing sections fall back to defaults", () => {
  const parsed = parsePreset('{"schemaVersion":2}');
  assert.deepEqual(parsed.project.typography, DEFAULT_PROJECT.typography);
  assert.deepEqual(parsed.project.motion, DEFAULT_PROJECT.motion);
  assert.equal(parsed.project.layers.length, 1);
});

test("out-of-range numbers are clamped, not trusted", () => {
  const parsed = parsePreset(
    JSON.stringify({ schemaVersion: 2, motion: { speed: 9999, stagger: -5 }, typography: { weight: 4000 } }),
  );
  assert.ok(parsed.project.motion.speed <= 6);
  assert.ok(parsed.project.motion.stagger >= 0);
  assert.ok(parsed.project.typography.weight <= 900);
});

test("a colour that could escape a stylesheet is rejected", () => {
  const parsed = parsePreset(
    JSON.stringify({
      schemaVersion: 2,
      color: { mode: "custom", text: "red;} body{display:none", accent1: "url(http://x)" },
    }),
  );
  assert.ok(!parsed.project.color.text.includes("}"));
  assert.ok(!parsed.project.color.accent1.includes("url"));
  // Legitimate colour syntax still gets through.
  const ok = parsePreset(
    JSON.stringify({ schemaVersion: 2, color: { text: "#ff00aa", accent1: "rgb(1 2 3 / 0.5)" } }),
  );
  assert.equal(ok.project.color.text, "#ff00aa");
  assert.equal(ok.project.color.accent1, "rgb(1 2 3 / 0.5)");
});

test("a remote background image is dropped on import", () => {
  const parsed = parsePreset(
    JSON.stringify({ schemaVersion: 2, background: { mode: "image", imageUrl: "https://example.com/x.png" } }),
  );
  assert.equal(parsed.project.background.imageUrl, "");
  assert.ok(parsed.warnings.some((w) => w.includes("background image")));

  const inline = parsePreset(
    JSON.stringify({ schemaVersion: 2, background: { mode: "image", imageUrl: "data:image/png;base64,AAAA" } }),
  );
  assert.ok(inline.project.background.imageUrl.startsWith("data:image/"));
});

test("input that is not a preset is reported, not swallowed", () => {
  assert.throws(() => parsePreset("not json"), PresetError);
  assert.throws(() => parsePreset("[1,2,3]"), PresetError);
  assert.throws(() => parsePreset("42"), PresetError);
});

test("layer count is bounded", () => {
  const many = { schemaVersion: 2, layers: Array.from({ length: 40 }, () => ({ text: "x" })) };
  assert.ok(parsePreset(JSON.stringify(many)).project.layers.length <= 8);
});

/* ------------------------------------------------------------------ *
 * Built-in presets
 * ------------------------------------------------------------------ */

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
  for (const kind of ["html", "react", "preset", "timeline"] as const) {
    const file = generate(kind, project);
    assert.ok(file.body.length > 500, `${kind} is suspiciously short`);
    assert.ok(file.name.length > 0);
    assert.ok(file.mime.includes("/"));
  }

  assert.ok(generate("html", project).body.startsWith("<!doctype html>"));
  assert.ok(generate("react", project).body.startsWith('"use client"'));
  assert.doesNotThrow(() => JSON.parse(generate("preset", project).body));
});
