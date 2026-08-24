import { expect, test } from "@playwright/test";

import {
  SESSION_KEY,
  dismissOnboarding,
  freezeAtRest,
  gotoEditor,
  setPhrase,
  stubWebFonts,
  waitForStage,
} from "./helpers";

/**
 * The canvas overflow warning.
 *
 * Font size is canvas-relative on purpose, so a phrase set large enough runs
 * off the canvas and `overflow: hidden` cuts it. Nothing here shrinks anything
 * — the size is the user's decision. What is asserted is that the situation is
 * reported when it is true, named where it can be, and gone when it stops
 * being true.
 */

const WARNING = '[role="status"][aria-live="polite"]';

type Layer = {
  name: string;
  text: string;
  templateId?: string;
  anchor?: string;
  x?: number;
  y?: number;
};

async function seed(
  page: import("@playwright/test").Page,
  layers: Layer[],
  fontSize: number,
) {
  const project = JSON.stringify({
    schemaVersion: 4,
    name: "overflow",
    canvas: { formatId: "youtube", width: 1920, height: 1080, safeZones: false },
    typography: {
      fontId: "outfit",
      fontSize,
      tracking: -0.025,
      leading: 1.1,
      weight: 700,
      align: "center",
      transform: "none",
      italic: false,
      granularity: "char",
    },
    motion: { speed: 1, stagger: 0.045, delay: 0, easing: "template", loop: false, hold: 1.1 },
    layers: layers.map((layer) => ({
      name: layer.name,
      text: layer.text,
      templateId: layer.templateId ?? "fade-up",
      glyphPool: "hex",
      delay: 0,
      position: { anchor: layer.anchor ?? "center", x: layer.x ?? 0, y: layer.y ?? 0 },
      typography: {},
      wordStyles: {},
      visible: true,
    })),
  });

  // Written from a page that does not mount the editor, so the editor's own
  // debounced save cannot land on top of the seed. See e2e/position.spec.ts.
  await page.goto("/seeding-a-project-not-a-real-route");
  await page.evaluate(
    ([key, payload]) => {
      window.localStorage.setItem(key as string, payload as string);
      window.localStorage.setItem("stw:onboarding-dismissed:v1", "true");
    },
    [SESSION_KEY, project] as const,
  );

  await gotoEditor(page);
  await waitForStage(page);
}

test.beforeEach(async ({ page }) => {
  // The warning is a statement about measured boxes, so the face has to be the
  // same one on every machine.
  await stubWebFonts(page);
  await dismissOnboarding(page);
});

test("type too large for the canvas is reported, and the layer is named", async ({ page }) => {
  await seed(page, [{ name: "Headline", text: "EXTRAORDINARILY LONG" }], 22);

  const warning = page.locator(WARNING);
  await expect(warning).toContainText("Headline");
  await expect(warning).toContainText("taller than the canvas");
  await expect(warning).toBeVisible();
});

test("a phrase that fits says nothing", async ({ page }) => {
  await seed(page, [{ name: "Headline", text: "FITS FINE" }], 5);

  // The region stays mounted so it can announce; it just has nothing to say.
  await expect(page.locator(WARNING)).toHaveText("");
});

test("the warning clears once the composition fits again", async ({ page }) => {
  await seed(page, [{ name: "Headline", text: "EXTRAORDINARILY LONG PHRASE" }], 20);
  await expect(page.locator(WARNING)).toContainText("cut off");

  // Through the editor, not through storage: the point is that it responds to
  // an edit rather than to a page load.
  await setPhrase(page, "SHORT");
  await expect(page.locator(WARNING)).toHaveText("");
});

test("a layer nudged off the canvas is reported too", async ({ page }) => {
  // The offset is a transform, and a layout box knows nothing about transforms.
  // Reading it back is what makes this case visible at all.
  await seed(page, [{ name: "Sub", text: "NUDGED OFF", x: 45 }], 5);

  const warning = page.locator(WARNING);
  await expect(warning).toContainText("Sub");
  await expect(warning).toContainText("wider than the canvas");
});

test("every overflowing layer is named", async ({ page }) => {
  await seed(
    page,
    [
      { name: "Headline", text: "PUSHED RIGHT", x: 45 },
      { name: "Sub", text: "PUSHED LEFT", x: -45 },
    ],
    5,
  );

  const warning = page.locator(WARNING);
  await expect(warning).toContainText("2 layers");
  await expect(warning).toContainText("Headline");
  await expect(warning).toContainText("Sub");
});

test("a template throwing characters outside the canvas is not overflow", async ({ page }) => {
  // `letter-close` starts over-tracked and `punch-words` overshoots, and both
  // opt out of the mask — so mid-flight there really is ink outside the canvas.
  // That is the animation, not a composition that does not fit, and measuring
  // layout rather than screen rectangles is what tells the two apart.
  await seed(
    page,
    [
      { name: "Headline", text: "COMPOSING", templateId: "letter-close" },
      { name: "Sub", text: "ITSELF", templateId: "punch-words", y: 25 },
    ],
    5,
  );

  const warning = page.locator(WARNING);
  for (const at of [0, 0.15, 0.3, 0.6, 1.0]) {
    await page.evaluate(async (time) => {
      const stage = window.__titlecard!;
      await stage.settled();
      stage.seek(time);
    }, at);
    await expect(warning, `at ${at}s`).toHaveText("");
  }

  await freezeAtRest(page);
  await expect(warning).toHaveText("");
});

test("the warning is outside the canvas, so no export can pick it up", async ({ page }) => {
  await seed(page, [{ name: "Headline", text: "EXTRAORDINARILY LONG" }], 22);
  await expect(page.locator(WARNING)).toContainText("cut off");

  // The raster exporters read the live DOM under `.stw-canvas`. Anything the
  // editor draws about a composition has to live outside that box, or it would
  // be painted into the video.
  const inside = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>(".stw-preview .stw-canvas")!;
    return {
      liveRegions: canvas.querySelectorAll('[aria-live], [role="status"]').length,
      mentionsWarning: canvas.innerHTML.includes("cut off"),
    };
  });

  expect(inside.liveRegions).toBe(0);
  expect(inside.mentionsWarning).toBe(false);
});

test("overflowing does not stop the composition being exported", async ({ page }) => {
  await seed(page, [{ name: "Headline", text: "EXTRAORDINARILY LONG" }], 22);
  await expect(page.locator(WARNING)).toContainText("cut off");

  // A warning, not a gate.
  await page
    .getByRole("navigation", { name: "Editor sections" })
    .getByRole("button", { name: "Presets", exact: true })
    .click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("changing the canvas format re-asks the question", async ({ page }) => {
  // The same type on a wider, shorter frame. Size is a percentage of the canvas
  // *width*, so 21:9 gives the phrase the same height and less room to put it
  // in — a composition can stop fitting without a typographic control moving.
  await seed(page, [{ name: "Headline", text: "A LONGER HEADLINE THAN THIS" }], 14);
  await expect(page.locator(WARNING)).toHaveText("");

  await page
    .getByRole("navigation", { name: "Editor sections" })
    .getByRole("button", { name: "Canvas", exact: true })
    .click();
  await page.getByRole("button", { name: "Cinema" }).click();

  await expect(page.locator(WARNING)).toContainText("taller than the canvas");
});

test("running the size up raises it, and back down clears it", async ({ page }) => {
  await seed(page, [{ name: "Headline", text: "SIZE ME UP UNTIL IT STOPS FITTING" }], 5);
  await expect(page.locator(WARNING)).toHaveText("");

  await page
    .getByRole("navigation", { name: "Editor sections" })
    .getByRole("button", { name: "Typography", exact: true })
    .click();

  // The slider is only reachable by name because the label is forwarded to the
  // thumb; on the root it named a group containing an unnamed slider.
  const size = page.getByRole("slider", { name: "Size" });
  await size.focus();
  await page.keyboard.press("End");
  await expect(page.locator(WARNING)).toContainText("cut off");

  await page.keyboard.press("Home");
  await expect(page.locator(WARNING)).toHaveText("");
});
