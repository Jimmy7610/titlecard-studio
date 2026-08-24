import { expect, test } from "@playwright/test";

import { dismissOnboarding, gotoEditor, seedSession, waitForStage, freezeAt } from "./helpers";

/**
 * A small, curated screenshot suite.
 *
 * Deliberately few. A screenshot is the most expensive kind of assertion to
 * maintain, and a suite of forty is a suite nobody re-baselines honestly — they
 * get bulk-accepted and stop meaning anything. These eight cover the geometry
 * that is hardest to assert any other way and easiest to break by accident:
 * mask clipping, descender clearance, the rule's position, accents, the caret,
 * and multi-layer composition.
 *
 * Determinism comes from three places: the fonts are served from a fixture
 * rather than the network, the timeline is parked on an exact time rather than
 * left running, and CSS animation is paused before the shot.
 *
 * Baselines are per platform (Playwright suffixes them), because font
 * rasterisation is not portable. See `docs/TESTING.md` for how to add the ones
 * for a platform you do not have.
 */

const CANVAS = ".stw-preview .stw-canvas";

type Scene = {
  name: string;
  at: number;
  project: Record<string, unknown>;
};

const layer = (over: Record<string, unknown>) => ({
  name: "Headline",
  glyphPool: "hex",
  delay: 0,
  position: { anchor: "center", x: 0, y: 0 },
  typography: {},
  wordStyles: {},
  visible: true,
  ...over,
});

const scene = (
  name: string,
  at: number,
  project: Record<string, unknown>,
): Scene => ({
  name,
  at,
  project: {
    schemaVersion: 3,
    name,
    canvas: { formatId: "youtube", width: 1920, height: 1080, safeZones: false },
    motion: { speed: 1, stagger: 0.045, delay: 0, easing: "template", loop: false, hold: 1.1 },
    ...project,
  },
});

const SCENES: Scene[] = [
  scene("agent-reveal-outfit", 2.2, {
    typography: { fontId: "outfit", weight: 600, fontSize: 11, tracking: -0.025, leading: 1.1 },
    layers: [layer({ text: "AGENT 3", templateId: "agent-reveal" })],
  }),

  scene("film-title-playfair", 3.6, {
    paletteId: "mono",
    invertCanvas: true,
    background: { mode: "solid", color: "#08090c", vignette: 0.4, grid: 0 },
    typography: {
      fontId: "playfair",
      weight: 500,
      fontSize: 9,
      tracking: 0.16,
      leading: 1.2,
      transform: "uppercase",
    },
    layers: [layer({ text: "JIMMY ELIASSON", templateId: "film-title" })],
  }),

  scene("terminal-caret", 2.4, {
    paletteId: "terminal",
    invertCanvas: true,
    background: { mode: "solid", color: "#05070a", grid: 0.2 },
    layers: [layer({ text: "Boot gyjpq", templateId: "terminal-type" })],
  }),

  scene("glyph-decode", 2.5, {
    paletteId: "terminal",
    invertCanvas: true,
    background: { mode: "solid", color: "#05070a", grid: 0.2 },
    layers: [layer({ text: "SYSTEM BOOT", templateId: "glyph-decode", glyphPool: "binary" })],
  }),

  // The descender case the underline geometry exists for. Line Mask lands its
  // characters at 1.05s and holds the rule at full width until 1.29s, so 1.1s
  // is the one frame where both are fully on screen.
  scene("descenders-and-rule", 1.1, {
    typography: { fontId: "outfit", weight: 600, fontSize: 12, tracking: -0.02, leading: 1.1 },
    layers: [layer({ text: "Typography gyjpq", templateId: "line-mask" })],
  }),

  // Swedish across two lines, tight leading: accents at the top of one line and
  // descenders at the bottom of the one above it.
  scene("swedish-multiline", 2.6, {
    typography: { fontId: "outfit", weight: 700, fontSize: 9, tracking: 0, leading: 0.95 },
    layers: [layer({ text: "RÄKSMÖRGÅS ÄR GOTT\nÉÜÇ gyjpq", templateId: "line-mask" })],
  }),

  scene("word-styling", 3.2, {
    typography: { fontId: "outfit", weight: 600, fontSize: 8 },
    layers: [
      layer({
        text: "BUILD SOMETHING IMPOSSIBLE",
        templateId: "punch-words",
        wordStyles: { 2: { gradient: true, scale: 1.25, glow: 0.2 } },
      }),
    ],
  }),

  scene("multi-layer-scene", 3.0, {
    paletteId: "ice",
    invertCanvas: true,
    background: { mode: "gradient", gradientStart: "#101826", gradientEnd: "#05080f", gradientAngle: 160 },
    typography: { fontId: "outfit", weight: 600, fontSize: 8 },
    // Anchors, not offsets: the offset is a percentage of the layer's own text
    // block, so at ±50% it cannot move a short line far enough to clear another
    // one. Separating layers is what the nine-point anchor is for.
    layers: [
      layer({ text: "WHAT IF", templateId: "fade-up", position: { anchor: "top", x: 0, y: 40 } }),
      layer({
        name: "Sub",
        text: "AI COULD BUILD",
        templateId: "punch-words",
        delay: 0.9,
        position: { anchor: "bottom", x: 0, y: -40 },
        typography: { scale: 0.7 },
      }),
    ],
  }),
];

for (const item of SCENES) {
  test(`renders ${item.name}`, async ({ page }) => {
    await dismissOnboarding(page);
    await seedSession(page, item.project);
    await gotoEditor(page);
    await waitForStage(page);
    await freezeAt(page, item.at);

    await expect(page.locator(CANVAS)).toHaveScreenshot(`${item.name}.png`);
  });
}
