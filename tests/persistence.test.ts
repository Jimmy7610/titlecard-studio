import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PersistenceError,
  applyStylePreset,
  looksLikeProject,
  parseProjectFile,
  parseStylePreset,
  projectFile,
  projectFileJson,
  projectFileName,
  stylePresetFromProject,
  stylePresetJson,
} from "../lib/persistence";
import { DEFAULT_PROJECT } from "../lib/project";
import type { ProjectState } from "../lib/types";

/**
 * The persistence layer reads data the app did not write: hand-edited files,
 * downloads from strangers, and localStorage that survived an upgrade. It must
 * never crash, never half-apply, and — the rule the whole split exists to
 * enforce — never take a user's words away from them.
 */

const project: ProjectState = {
  ...DEFAULT_PROJECT,
  name: "Round trip",
  paletteId: "ice",
  invertCanvas: true,
  canvas: { formatId: "tiktok", width: 1080, height: 1920, safeZones: true },
  typography: { ...DEFAULT_PROJECT.typography, fontId: "playfair", weight: 700, tracking: 0.14 },
  motion: { ...DEFAULT_PROJECT.motion, speed: 0.7, stagger: 0.08, easing: "cinematic" },
  semantic: { enabled: false, autoApply: true },
  reducePreviewMotion: true,
  layers: [
    {
      ...DEFAULT_PROJECT.layers[0],
      id: "one",
      name: "Headline",
      text: "RÄKSMÖRGÅS ✨",
      templateId: "gold-sweep",
      wordStyles: { 1: { gradient: true, scale: 1.2, delay: 0.3 } },
    },
    {
      ...DEFAULT_PROJECT.layers[0],
      id: "two",
      name: "Sub",
      text: "gyjpq",
      templateId: "glyph-decode",
      delay: 1.2,
      position: { anchor: "bottom", x: 4, y: -8 },
      typography: { fontId: "poppins", weight: 300, italic: true },
    },
  ],
  activeLayerId: "two",
};

/* ------------------------------------------------------------------ *
 * Project files
 * ------------------------------------------------------------------ */

test("a project file round-trips the whole document", () => {
  const { project: restored, warnings } = parseProjectFile(projectFileJson(project));

  assert.deepEqual(warnings, [], "a file this build wrote needs no migration");
  assert.equal(restored.schemaVersion, 4);
  assert.equal(restored.name, "Round trip");
  assert.deepEqual(restored.canvas, project.canvas);
  assert.equal(restored.paletteId, "ice");
  assert.equal(restored.invertCanvas, true);
  assert.equal(restored.typography.fontId, "playfair");
  assert.equal(restored.motion.easing, "cinematic");
  assert.deepEqual(restored.semantic, { enabled: false, autoApply: true });
  assert.equal(restored.reducePreviewMotion, true);

  assert.equal(restored.layers.length, 2);
  assert.equal(restored.layers[0].text, "RÄKSMÖRGÅS ✨");
  assert.deepEqual(restored.layers[0].wordStyles, {
    1: { gradient: true, scale: 1.2, delay: 0.3 },
  });
  assert.equal(restored.layers[1].text, "gyjpq");
  assert.equal(restored.layers[1].delay, 1.2);
  assert.deepEqual(restored.layers[1].position, { anchor: "bottom", x: 4, y: -8 });
  assert.deepEqual(restored.layers[1].typography, {
    fontId: "poppins",
    weight: 300,
    italic: true,
  });
});

test("the active layer survives a round trip", () => {
  // Ids are minted per session, so the file references the layer by position.
  const restored = parseProjectFile(projectFileJson(project)).project;
  const activeIndex = restored.layers.findIndex((layer) => layer.id === restored.activeLayerId);
  assert.equal(activeIndex, 1, "the second layer was active when it was saved");
});

test("a project file stores each phrase exactly once", () => {
  const file = projectFile(project) as unknown as Record<string, unknown>;

  // v2 mirrored every phrase into `text.layers[]` as well as onto the layer,
  // which is what forced the `as unknown as` at the serialisation boundary.
  assert.equal(file.text, undefined, "there is no second copy of the text");
  assert.equal(JSON.stringify(file).split("RÄKSMÖRGÅS").length - 1, 1);
});

test("a project file names itself after the project", () => {
  assert.equal(projectFileName(project), "round-trip.titlecard.json");
  assert.ok(projectFileName({ ...project, name: "" }).endsWith(".titlecard.json"));
});

/* ------------------------------------------------------------------ *
 * Style presets
 * ------------------------------------------------------------------ */

test("a look carries style and nothing else", () => {
  const raw = stylePresetJson(stylePresetFromProject(project, "My look"));
  const file = JSON.parse(raw) as Record<string, unknown>;

  for (const forbidden of ["layers", "text", "canvas", "activeLayerIndex"]) {
    assert.equal(file[forbidden], undefined, `a look must not carry ${forbidden}`);
  }
  assert.ok(!raw.includes("RÄKSMÖRGÅS"), "a look must not carry the words");
  assert.ok(!raw.includes("gyjpq"));

  const parsed = parseStylePreset(raw);
  assert.equal(parsed.preset.paletteId, "ice");
  assert.equal(parsed.preset.typography.fontId, "playfair");
  // The active layer's template is the look's template.
  assert.equal(parsed.preset.templateId, "glyph-decode");
});

test("applying a look leaves the document alone", () => {
  const look = parseStylePreset(
    stylePresetJson({
      ...stylePresetFromProject(project, "Loud"),
      paletteId: "plasma",
      templateId: "zoom-impact",
    }),
  ).preset;

  const before: ProjectState = {
    ...DEFAULT_PROJECT,
    canvas: { formatId: "custom", width: 1440, height: 1440, safeZones: false },
    layers: [
      { ...DEFAULT_PROJECT.layers[0], id: "a", text: "MINE", wordStyles: { 0: { glow: 0.4 } } },
      { ...DEFAULT_PROJECT.layers[0], id: "b", text: "ALSO MINE" },
    ],
    activeLayerId: "a",
  };

  const after = applyStylePreset(before, look);

  assert.equal(after.paletteId, "plasma", "the look applied");
  assert.deepEqual(after.canvas, before.canvas, "the canvas is document, not style");
  assert.equal(after.layers.length, 2, "no layer was added or lost");
  assert.deepEqual(
    after.layers.map((layer) => layer.text),
    ["MINE", "ALSO MINE"],
    "the words are untouched",
  );
  assert.deepEqual(after.layers[0].wordStyles, { 0: { glow: 0.4 } });
  assert.equal(after.activeLayerId, "a");

  // Only the active layer takes the template: stamping one motion idea across a
  // composed scene would be a document edit wearing a preset's clothes.
  assert.equal(after.layers[0].templateId, "zoom-impact");
  assert.equal(after.layers[1].templateId, before.layers[1].templateId);
});

/* ------------------------------------------------------------------ *
 * Migration
 * ------------------------------------------------------------------ */

const V1 = JSON.stringify({
  $schema: "semantic-text-animator/preset@1",
  phrase: "Agent 3",
  template: "odometer-roll",
  palette: "plasma",
  glyphPool: "katakana",
  motion: { speed: 1.6, stagger: 0.012, loop: false },
  type: { fontSize: 7.5, tracking: 0.2, leading: 1.6, weight: 500 },
  canvas: "dark",
});

test("a version 1 file opens as a project", () => {
  const { project: restored, warnings, sourceVersion } = parseProjectFile(V1);

  assert.equal(sourceVersion, 1);
  assert.ok(warnings.some((warning) => warning.includes("version 1")));
  assert.equal(restored.layers[0].text, "Agent 3");
  assert.equal(restored.layers[0].templateId, "odometer-roll");
  assert.equal(restored.layers[0].glyphPool, "katakana");
  assert.equal(restored.paletteId, "plasma");
  assert.equal(restored.invertCanvas, true);
  assert.equal(restored.motion.speed, 1.6);
  assert.equal(restored.typography.weight, 500);
});

test("a version 1 file also opens as a look, without its phrase", () => {
  const parsed = parseStylePreset(V1);
  assert.equal(parsed.preset.templateId, "odometer-roll");
  assert.equal(parsed.preset.paletteId, "plasma");
  // The words it carried are offered back, never applied.
  assert.deepEqual(parsed.texts, ["Agent 3"]);
});

test("a version 3 file opens, and says its offsets now mean something else", () => {
  // v4 changed no field shape at all. It changed what `position.x/y` measure,
  // from a percentage of the text block to a percentage of the canvas — so the
  // same bytes describe a different picture, which is what the version is for.
  const withOffset = JSON.stringify({
    $schema: "titlecard/project@3",
    schemaVersion: 3,
    name: "Nudged",
    layers: [
      { name: "A", text: "ONE", templateId: "fade-up", visible: true, position: { anchor: "center", x: 0, y: 18 } },
    ],
  });

  const parsed = parseProjectFile(withOffset);
  assert.equal(parsed.sourceVersion, 3);
  assert.equal(parsed.project.schemaVersion, 4);
  // The number is carried across, not converted: the old unit was a percentage
  // of the rendered text block, and no file records that block's size.
  assert.deepEqual(parsed.project.layers[0].position, { anchor: "center", x: 0, y: 18 });
  assert.ok(
    parsed.warnings.some((warning) => warning.includes("percentage of the canvas")),
    "the reader has to say the offset may have moved",
  );
});

test("a version 3 file with no offsets is upgraded quietly", () => {
  // Nothing moved, so there is nothing to warn about. A notice on every old
  // file would be noise, and noise is how real notices get ignored.
  const parsed = parseProjectFile(
    JSON.stringify({
      schemaVersion: 3,
      name: "Untouched",
      layers: [{ name: "A", text: "ONE", templateId: "fade-up", visible: true }],
    }),
  );
  assert.equal(parsed.project.schemaVersion, 4);
  assert.equal(
    parsed.warnings.some((warning) => warning.includes("percentage of the canvas")),
    false,
  );
});

test("a look has no positions, so v4 is a version bump and nothing else", () => {
  const parsed = parseStylePreset(
    JSON.stringify({ $schema: "titlecard/style-preset@3", schemaVersion: 3, paletteId: "ice" }),
  );
  assert.equal(parsed.preset.paletteId, "ice");
  assert.equal(
    parsed.warnings.some((warning) => warning.includes("percentage of the canvas")),
    false,
  );
});

test("a version 2 session recovers both copies of the text", () => {
  // v2 wrote the phrases twice. The layer copy wins; a file that only had the
  // mirror still has to open.
  const bothCopies = JSON.stringify({
    $schema: "semantic-text-animator/preset@2",
    schemaVersion: 2,
    name: "Old session",
    text: { layers: [{ name: "Stale", text: "STALE" }] },
    layers: [{ templateId: "fade-up", text: "CURRENT", name: "Headline", visible: true }],
  });
  assert.equal(parseProjectFile(bothCopies).project.layers[0].text, "CURRENT");

  const mirrorOnly = JSON.stringify({
    schemaVersion: 2,
    name: "Mirror only",
    text: { layers: [{ name: "Headline", text: "ONLY HERE" }] },
    layers: [],
  });
  assert.equal(parseProjectFile(mirrorOnly).project.layers[0].text, "ONLY HERE");
});

test("a document declares which format it is", () => {
  assert.equal(looksLikeProject(JSON.parse(projectFileJson(project))), true);
  assert.equal(
    looksLikeProject(JSON.parse(stylePresetJson(stylePresetFromProject(project, "x")))),
    false,
  );
  // A v1 preset carries a phrase, so it opens as a project when handed to the
  // file picker — which is what a user dropping their only copy expects.
  assert.equal(looksLikeProject(JSON.parse(V1)), true);
});

/* ------------------------------------------------------------------ *
 * Hostile and malformed input
 * ------------------------------------------------------------------ */

test("input that is not a document is reported, not swallowed", () => {
  for (const raw of ["not json at all", "[1,2,3]", '"a string"', "42"]) {
    assert.throws(() => parseProjectFile(raw), PersistenceError, raw);
    assert.throws(() => parseStylePreset(raw), PersistenceError, raw);
  }
});

test("missing sections fall back to defaults", () => {
  const { project: restored } = parseProjectFile('{"schemaVersion":3}');
  assert.equal(restored.layers.length, 1);
  assert.deepEqual(restored.typography, DEFAULT_PROJECT.typography);
  assert.deepEqual(restored.motion, DEFAULT_PROJECT.motion);
});

test("a field from a newer schema is ignored, not fatal", () => {
  const { project: restored, warnings } = parseProjectFile(
    JSON.stringify({
      schemaVersion: 99,
      name: "From the future",
      quantumMotion: { entangled: true },
      layers: [{ text: "hi", templateId: "fade-up", sparkles: 12 }],
    }),
  );
  assert.equal(restored.name, "From the future");
  assert.equal(restored.layers[0].text, "hi");
  assert.ok(warnings.some((warning) => warning.includes("newer version")));
});

test("out-of-range numbers are clamped to what the controls can express", () => {
  const { project: restored } = parseProjectFile(
    JSON.stringify({
      schemaVersion: 3,
      typography: { fontSize: 9999, leading: -5, tracking: 40 },
      motion: { speed: 500, stagger: -1 },
      layers: [{ text: "hi" }],
    }),
  );

  assert.ok(restored.typography.fontSize <= 22 && restored.typography.fontSize >= 2);
  assert.ok(restored.typography.leading >= 0.75);
  assert.ok(restored.motion.speed <= 3);
  assert.ok(restored.motion.stagger >= 0.002);
});

test("a colour that could escape a stylesheet is rejected", () => {
  const hostile = JSON.stringify({
    schemaVersion: 3,
    color: {
      text: "red;} body{display:none",
      accent1: "url(https://tracker.example/pixel)",
      accent2: "#ff0000",
      accent3: "expression(alert(1))",
    },
    layers: [{ text: "hi" }],
  });

  const { color } = parseProjectFile(hostile).project;
  assert.ok(!color.text.includes("}"));
  assert.ok(!color.accent1.includes("url("));
  assert.equal(color.accent2, "#ff0000", "a real colour still gets through");
  assert.ok(!color.accent3.includes("("));
});

test("a remote background image is dropped on import", () => {
  const { project: restored, warnings } = parseProjectFile(
    JSON.stringify({
      schemaVersion: 3,
      background: { mode: "image", imageUrl: "https://tracker.example/beacon.png" },
      layers: [{ text: "hi" }],
    }),
  );
  assert.equal(restored.background.imageUrl, "");
  assert.ok(warnings.some((warning) => warning.toLowerCase().includes("image")));

  // An embedded one is the user's own bytes and is kept.
  const inline = parseProjectFile(
    JSON.stringify({
      schemaVersion: 3,
      background: { mode: "image", imageUrl: "data:image/png;base64,iVBORw0KGgo=" },
      layers: [{ text: "hi" }],
    }),
  );
  assert.ok(inline.project.background.imageUrl.startsWith("data:image/"));
});

test("layer count is bounded", () => {
  const many = parseProjectFile(
    JSON.stringify({
      schemaVersion: 3,
      layers: Array.from({ length: 400 }, (_, index) => ({ text: `layer ${index}` })),
    }),
  );
  assert.ok(many.project.layers.length <= 8);
  assert.ok(many.warnings.some((warning) => warning.includes("first 8")));
});

test("an unknown template degrades instead of throwing", () => {
  const { project: restored, warnings } = parseProjectFile(
    JSON.stringify({ schemaVersion: 3, layers: [{ templateId: "nope", text: "hi" }] }),
  );
  assert.equal(restored.layers[0].templateId, "agent-reveal");
  assert.ok(warnings.some((warning) => warning.includes("nope")));
});

test("a layer id from a file never survives into the session", () => {
  // Ids are minted per session; honouring one from a file would let a crafted
  // document collide two layers onto one identity.
  const restored = parseProjectFile(
    JSON.stringify({
      schemaVersion: 3,
      layers: [
        { id: "same", text: "one" },
        { id: "same", text: "two" },
      ],
    }),
  ).project;

  assert.notEqual(restored.layers[0].id, restored.layers[1].id);
});
