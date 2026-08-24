import { expect, test } from "@playwright/test";

import {
  LEGACY_SESSION_KEY,
  SESSION_KEY,
  collectErrors,
  dismissOnboarding,
  gotoEditor,
  openPanel,
  realErrors,
  seedSession,
  setPhrase,
  waitForStage,
} from "./helpers";

/**
 * Storage is the one place the app reads bytes it did not just write. These
 * cover the round trip, the upgrade path from the previous schema, and the
 * promise that a bad byte cannot make the editor unopenable.
 */

test.beforeEach(async ({ page }) => {
  await dismissOnboarding(page);
});

const readSession = (page: import("@playwright/test").Page) =>
  page.evaluate((key) => {
    const raw = window.localStorage.getItem(key as string);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  }, SESSION_KEY);

test("a project survives a reload", async ({ page }) => {
  await gotoEditor(page);
  await setPhrase(page, "SURVIVES A RELOAD");

  await openPanel(page, "Canvas");
  await page.getByRole("button", { name: /Instagram Square/ }).first().click();

  await openPanel(page, "Layers");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(".stw-preview [data-stw-layer]")).toHaveCount(2);

  // The debounce has to have run before the reload.
  await expect.poll(async () => (await readSession(page))?.layers).toHaveLength(2);

  await page.reload();
  await waitForStage(page);

  await expect(page.locator(".stw-preview [data-stw-layer]")).toHaveCount(2);
  await expect(page.locator(".stw-preview .stw-sr").first()).toHaveText("SURVIVES A RELOAD");

  const box = (await page.locator(".stw-preview .stw-canvas").boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(1, 1);
});

test("the active layer comes back with the project", async ({ page }) => {
  await gotoEditor(page);
  await openPanel(page, "Layers");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  // The second layer is active after adding it; that has to survive a reload,
  // or every panel reopens pointed at a different layer than the user left.
  await expect(page.getByText("Layer 2", { exact: true }).first()).toBeVisible();
  await expect.poll(async () => (await readSession(page))?.activeLayerIndex).toBe(1);

  await page.reload();
  await waitForStage(page);
  await openPanel(page, "Layers");
  await expect(page.locator("#layer-name")).toHaveValue("Layer 2");
});

test("a session written by the previous schema is migrated, not abandoned", async ({ page }) => {
  // A v2 session stored the phrases twice and lived under a different key. A
  // reader that only looked at the current key would open to a blank canvas
  // with the user's project still sitting in storage.
  await seedSession(
    page,
    {
      $schema: "semantic-text-animator/preset@2",
      schemaVersion: 2,
      name: "From v2",
      text: { layers: [{ name: "Headline", text: "OLD SESSION" }] },
      typography: { fontId: "outfit", weight: 600, fontSize: 11 },
      layers: [
        {
          templateId: "film-title",
          glyphPool: "hex",
          delay: 0,
          position: { anchor: "center", x: 0, y: 0 },
          typography: {},
          wordStyles: {},
          visible: true,
          text: "OLD SESSION",
          name: "Headline",
        },
      ],
    },
    LEGACY_SESSION_KEY,
  );

  await gotoEditor(page);
  await waitForStage(page);

  await expect(page.locator(".stw-preview .stw-sr").first()).toHaveText("OLD SESSION");

  // It is written forward under the current key, and only then is the old copy
  // dropped — a crash in between must leave the original where it was.
  await expect.poll(async () => (await readSession(page))?.schemaVersion).toBe(4);
  const legacy = await page.evaluate(
    (key) => window.localStorage.getItem(key as string),
    LEGACY_SESSION_KEY,
  );
  expect(legacy).toBeNull();
});

test("corrupted storage recovers instead of bricking the editor", async ({ page }) => {
  const errors = collectErrors(page);

  await page.addInitScript(
    ([key, onboarding]) => {
      window.localStorage.setItem(key as string, '{"schemaVersion":3,"layers":[{"text":');
      window.localStorage.setItem(onboarding as string, "true");
    },
    [SESSION_KEY, "stw:onboarding-dismissed:v1"] as const,
  );

  await gotoEditor(page);
  await waitForStage(page);

  // The default project, not a blank screen and not a thrown error.
  await expect(page.locator(".stw-preview .stw-sr").first()).toHaveText("MOTION STUDIO");
  expect(realErrors(errors)).toEqual([]);

  // And the editor is usable straight away.
  await setPhrase(page, "STILL WORKS");
  await expect(page.locator(".stw-preview .stw-sr").first()).toHaveText("STILL WORKS");
});

test("hostile values in storage cannot escape into the page", async ({ page }) => {
  await seedSession(page, {
    schemaVersion: 3,
    name: "Hostile",
    color: { mode: "custom", text: "red;} body{display:none}" },
    background: { mode: "image", imageUrl: "https://tracker.example/beacon.png" },
    layers: [{ text: "SAFE", templateId: "fade-up", visible: true }],
  });

  await gotoEditor(page);
  await waitForStage(page);

  // The body is still visible, so the colour never reached the stylesheet.
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator(".stw-preview .stw-sr").first()).toHaveText("SAFE");

  const requestedTracker = await page.evaluate(() =>
    performance.getEntriesByType("resource").some((entry) => entry.name.includes("tracker.example")),
  );
  expect(requestedTracker, "a remote background image must not be fetched").toBe(false);
});

test("a look leaves the words and the canvas alone", async ({ page }) => {
  await gotoEditor(page);
  await setPhrase(page, "MY OWN WORDS");

  await openPanel(page, "Canvas");
  await page.getByRole("button", { name: /TikTok/ }).first().click();

  await openPanel(page, "Presets");
  await page.getByRole("button", { name: /Luxury Brand/ }).click();

  // The look applied…
  await expect
    .poll(() =>
      page.evaluate(
        () => getComputedStyle(document.querySelector(".stw-preview .stw")!).fontFamily,
      ),
    )
    .toContain("Playfair");

  // …and took nothing with it.
  await expect(page.locator(".stw-preview .stw-sr").first()).toHaveText("MY OWN WORDS");
  const box = (await page.locator(".stw-preview .stw-canvas").boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(1080 / 1920, 1);
});
