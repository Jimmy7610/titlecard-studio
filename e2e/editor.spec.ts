import { expect, test } from "@playwright/test";

import {
  collectErrors,
  dismissOnboarding,
  gotoEditor,
  openPanel,
  phraseField,
  probeStage,
  realErrors,
  setPhrase,
  waitForStage,
} from "./helpers";

/**
 * The editor's own surface: does it boot, do the controls move the project, and
 * does the transport agree with the timeline it is driving.
 */

test.beforeEach(async ({ page }) => {
  await dismissOnboarding(page);
});

test("boots with a rendered default project and no console errors", async ({ page }) => {
  const errors = collectErrors(page);
  await gotoEditor(page);
  await waitForStage(page);

  await expect(page.locator(".stw-preview .stw-canvas")).toBeVisible();
  await expect(page.locator(".stw-preview .stw-sr").first()).toHaveText("MOTION STUDIO");

  const probe = await probeStage(page);
  expect(probe.chars).toBeGreaterThan(0);
  expect(probe.duration).toBeGreaterThan(0);
  expect(probe.outsideCanvas, "no glyph starts outside the canvas").toBe(0);

  expect(realErrors(errors)).toEqual([]);
});

test("the phrase drives the preview and the screen-reader text", async ({ page }) => {
  await gotoEditor(page);
  await setPhrase(page, "RÄKSMÖRGÅS ÄR GOTT");

  // The split spans are hidden from assistive tech; one unbroken phrase is
  // exposed instead, so a screen reader does not read out eighteen letters.
  await expect(page.locator(".stw-preview .stw-sr").first()).toHaveText("RÄKSMÖRGÅS ÄR GOTT");
  const chars = await page.locator(".stw-preview .stw-char").count();
  expect(chars).toBe(16);
});

test("switching typeface reaches the rendered type", async ({ page }) => {
  await gotoEditor(page);
  await openPanel(page, "Typography");

  await page.locator("#font").click();
  await page.getByRole("option", { name: /Playfair Display/ }).click();

  await expect
    .poll(() =>
      page.evaluate(
        () => getComputedStyle(document.querySelector(".stw-preview .stw")!).fontFamily,
      ),
    )
    .toContain("Playfair Display");

  // The weight picker must only offer weights the face actually ships.
  await page.locator("#weight").click();
  const weights = await page.getByRole("option").allInnerTexts();
  await page.keyboard.press("Escape");
  expect(weights.every((weight) => /^\d00$/.test(weight.trim()))).toBe(true);
});

test("a single-weight face cannot leave the project asking for a weight it lacks", async ({
  page,
}) => {
  await gotoEditor(page);
  await openPanel(page, "Typography");

  await page.locator("#font").click();
  await page.getByRole("option", { name: /^Anton/ }).click();

  // Anton ships one weight. The control used to keep displaying 600 over a list
  // whose only entry was 400, and the preview rendered a synthesised bold.
  await expect(page.locator("#weight")).toContainText("400");
  await page.locator("#weight").click();
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Escape");
});

test("canvas formats resize the stage and keep the type inside it", async ({ page }) => {
  await gotoEditor(page);
  await openPanel(page, "Canvas");

  for (const [label, ratio] of [
    ["TikTok", 1080 / 1920],
    ["Instagram Square", 1],
    ["Cinema", 2560 / 1080],
    ["YouTube", 16 / 9],
  ] as const) {
    await page.getByRole("button", { name: new RegExp(label) }).first().click();
    await waitForStage(page);

    const box = await page.locator(".stw-preview .stw-canvas").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width / box!.height).toBeCloseTo(ratio, 1);

    expect((await probeStage(page)).outsideCanvas, `${label} pushed type out`).toBe(0);
  }
});

test("layers can be added, duplicated and deleted without colliding", async ({ page }) => {
  const errors = collectErrors(page);
  await gotoEditor(page);
  await openPanel(page, "Layers");

  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator(".stw-preview [data-stw-layer]")).toHaveCount(2);

  await page.getByRole("button", { name: /^Duplicate/ }).first().click();
  await expect(page.locator(".stw-preview [data-stw-layer]")).toHaveCount(3);

  // A duplicate that reused the original's id made React warn about the key and
  // made editing or deleting one hit both.
  expect(realErrors(errors).filter((error) => /same key/i.test(error))).toEqual([]);

  await page.getByRole("button", { name: /^Delete/ }).nth(1).click();
  await expect(page.locator(".stw-preview [data-stw-layer]")).toHaveCount(2);

  expect(realErrors(errors)).toEqual([]);
});

test("undo and redo walk the history exactly", async ({ page }) => {
  await gotoEditor(page);
  await setPhrase(page, "STEP ONE");

  const undo = page.getByRole("button", { name: "Undo" });
  const redo = page.getByRole("button", { name: "Redo" });
  const sr = page.locator(".stw-preview .stw-sr").first();

  // Edits sharing a tag inside the coalesce window collapse into one history
  // entry — that is what stops a slider drag filling the stack. Waiting past it
  // is what makes these two separate steps.
  await page.waitForTimeout(700);
  await setPhrase(page, "STEP TWO");
  await expect(sr).toHaveText("STEP TWO");

  await undo.click();
  await expect(sr).toHaveText("STEP ONE");
  await redo.click();
  await expect(sr).toHaveText("STEP TWO");

  // Undo must not itself become an undoable entry.
  await undo.click();
  await undo.click();
  await expect(sr).not.toHaveText("STEP ONE");
});

test("word styling follows its word when the phrase is edited", async ({ page }) => {
  await gotoEditor(page);
  await setPhrase(page, "BUILD SOMETHING IMPOSSIBLE");

  const context = page.getByRole("complementary").last();
  await context.getByRole("button", { name: "IMPOSSIBLE", exact: true }).click();
  // The switch is reachable by its accessible name, which is the same thing a
  // screen-reader user has to be able to do.
  await context.getByRole("switch", { name: "Gradient fill" }).click();

  const gradientWords = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".stw-preview .stw-word")]
        .filter((word) => word.querySelector('[data-gradient="true"]'))
        .map((word) => word.textContent),
    );

  expect(await gradientWords()).toEqual(["IMPOSSIBLE"]);

  // Inserting a word before it used to move the styling onto REALLY, because
  // styles are keyed by index and the index now means a different word.
  await setPhrase(page, "BUILD SOMETHING REALLY IMPOSSIBLE");
  expect(await gradientWords()).toEqual(["IMPOSSIBLE"]);
});

test("bare-key shortcuts do not steal keys from focused controls", async ({ page }) => {
  await gotoEditor(page);
  await openPanel(page, "Text");

  // Typing must reach the field, not the transport.
  const field = phraseField(page);
  await field.fill("");
  await field.type("r l ");
  await expect(field).toHaveValue("r l ");

  // Space on a focused button belongs to the button.
  const replay = page.getByRole("button", { name: "Replay" });
  await replay.focus();
  const prevented = await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>('button[aria-label="Replay"]')!;
    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented, "Space was taken from the button").toBe(false);

  // With nothing focused it is the play/pause shortcut again.
  const onBody = await page.evaluate(() => {
    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(onBody).toBe(true);
});
