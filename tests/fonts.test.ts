import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dedupeFontRequests,
  fontRequestKey,
  guessVariantFromFilename,
  nearestWeight,
  resolveFont,
  type FontRequest,
} from "../lib/fonts";
import { DEFAULT_PROJECT, projectFontRequests } from "../lib/project";
import type { ProjectState, TextLayer } from "../lib/types";

/**
 * The unit of font loading is a face — a family, a weight and a style — not a
 * family. Loading was keyed by family alone, so the second weight of a family
 * was a cache hit against the first and the timeline measured a variant that
 * was not ready. Everything here guards that boundary.
 */

const key = (fontId: string, weight: number, italic = false) =>
  fontRequestKey({ fontId, weight, italic });

const layer = (over: Partial<TextLayer>): TextLayer => ({
  ...DEFAULT_PROJECT.layers[0],
  ...over,
});

const project = (over: Partial<ProjectState>): ProjectState => ({
  ...DEFAULT_PROJECT,
  ...over,
});

test("a request key separates weight and style", () => {
  assert.notEqual(key("poppins", 400), key("poppins", 600));
  assert.notEqual(key("poppins", 400, false), key("poppins", 400, true));
  assert.equal(key("poppins", 400), "poppins:400:normal");
  assert.equal(key("poppins", 400, true), "poppins:400:italic");
});

test("requests dedupe by face, not by family", () => {
  const requests: FontRequest[] = [
    { fontId: "poppins", weight: 400, italic: false },
    { fontId: "poppins", weight: 400, italic: false },
    { fontId: "poppins", weight: 600, italic: false },
    { fontId: "poppins", weight: 400, italic: true },
  ];

  assert.deepEqual(dedupeFontRequests(requests).map(fontRequestKey), [
    "poppins:400:italic",
    "poppins:400:normal",
    "poppins:600:normal",
  ]);
});

test("a request is normalised to a weight the face actually ships", () => {
  // Anton is a single-weight face. Asking for 600 has to collapse onto 400
  // rather than becoming a second request for something that cannot load.
  assert.deepEqual(
    dedupeFontRequests([
      { fontId: "anton", weight: 600, italic: false },
      { fontId: "anton", weight: 400, italic: false },
    ]).map(fontRequestKey),
    ["anton:400:normal"],
  );

  // Outfit ships no italic; asking for one must not produce a request that can
  // only ever resolve to a synthesised slant.
  assert.deepEqual(
    dedupeFontRequests([{ fontId: "outfit", weight: 600, italic: true }]).map(fontRequestKey),
    ["outfit:600:normal"],
  );
});

test("nearestWeight picks the closest shipped weight", () => {
  assert.equal(nearestWeight([400], 600), 400);
  assert.equal(nearestWeight([300, 400, 700], 600), 700);
  assert.equal(nearestWeight([300, 400, 700], 400), 400);
  assert.equal(nearestWeight([], 500), 500);
});

test("a project's requests include every layer override", () => {
  const keys = projectFontRequests(
    project({
      typography: { ...DEFAULT_PROJECT.typography, fontId: "outfit", weight: 600 },
      layers: [
        layer({ id: "a", text: "one" }),
        layer({ id: "b", text: "two", typography: { fontId: "playfair", weight: 700 } }),
        layer({
          id: "c",
          text: "three",
          typography: { fontId: "poppins", weight: 400, italic: true },
        }),
      ],
    }),
  ).map(fontRequestKey);

  assert.ok(keys.includes("outfit:600:normal"), "the project default is requested");
  assert.ok(keys.includes("playfair:700:normal"), "a layer's own weight is requested");
  assert.ok(keys.includes("poppins:400:italic"), "a layer's own style is requested");
});

test("a per-word weight is a face the project has to load", () => {
  const keys = projectFontRequests(
    project({
      typography: { ...DEFAULT_PROJECT.typography, fontId: "inter", weight: 400 },
      layers: [layer({ text: "BUILD IT", wordStyles: { 1: { weight: 900 } } })],
    }),
  ).map(fontRequestKey);

  // The heavy word renders on the same line as its neighbours, so its face has
  // to be measurable before the boxes around it are measured.
  assert.ok(keys.includes("inter:400:normal"));
  assert.ok(keys.includes("inter:900:normal"));
});

test("a hidden or empty layer still contributes its face", () => {
  // `layerTypography` is what the layer will render with the moment it is shown
  // again, and toggling visibility must not have to re-load a font.
  const keys = projectFontRequests(
    project({
      layers: [
        layer({ id: "a", text: "shown" }),
        layer({ id: "b", text: "", visible: false, typography: { fontId: "anton" } }),
      ],
    }),
  ).map(fontRequestKey);

  assert.ok(keys.includes("anton:400:normal"));
});

test("an unknown font id degrades instead of throwing", () => {
  const resolved = resolveFont("not-a-real-font");
  assert.equal(resolved.id, "outfit");
  assert.deepEqual(resolved.variants, []);
  assert.equal(resolved.custom, null);
});

test("a built-in face reports only the weights it ships", () => {
  assert.deepEqual(resolveFont("anton").weights, [400]);
  assert.equal(resolveFont("anton").italic, false);
  assert.equal(resolveFont("playfair").italic, true);
});

test("an uploaded filename is read for a family, a weight and a style", () => {
  assert.deepEqual(guessVariantFromFilename("MyFont-Bold.woff2"), {
    name: "MyFont",
    weight: 700,
    italic: false,
  });
  assert.deepEqual(guessVariantFromFilename("MyFont-BoldItalic.otf"), {
    name: "MyFont",
    weight: 700,
    italic: true,
  });
  assert.deepEqual(guessVariantFromFilename("Acme_Variable_300.ttf"), {
    name: "Acme Variable",
    weight: 300,
    italic: false,
  });
  // "SemiBold" must not be read as "Bold" by a looser matcher.
  assert.equal(guessVariantFromFilename("Thing-SemiBold.woff").weight, 600);
  assert.equal(guessVariantFromFilename("Thing-ExtraLight.woff").weight, 200);
  // Nothing recognisable is regular upright, and keeps its name.
  assert.deepEqual(guessVariantFromFilename("brandface.woff2"), {
    name: "brandface",
    weight: 400,
    italic: false,
  });
});
