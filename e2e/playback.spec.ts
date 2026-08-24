import { expect, test } from "@playwright/test";

import { collectErrors, dismissOnboarding, gotoEditor, realErrors, waitForStage } from "./helpers";

/**
 * The transport and the GSAP timeline it drives.
 *
 * The bug class this covers is desynchronisation: a bar that tracks its own
 * button presses instead of the animation ends up claiming the opposite of what
 * is on screen the moment anything else moves the playhead.
 */

const state = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const timeline = window.__titlecard?.timeline();
    if (!timeline) return null;
    return {
      time: timeline.time(),
      duration: timeline.duration(),
      paused: timeline.paused(),
      progress: timeline.progress(),
      timeScale: timeline.timeScale(),
      repeat: timeline.repeat(),
    };
  });

test.beforeEach(async ({ page }) => {
  await dismissOnboarding(page);
  await gotoEditor(page);
  await waitForStage(page);
});

test("play, pause and replay agree with the timeline", async ({ page }) => {
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  await expect(pause).toBeVisible();

  await pause.click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  expect((await state(page))!.paused).toBe(true);

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  expect((await state(page))!.paused).toBe(false);

  await page.getByRole("button", { name: "Replay", exact: true }).click();
  const after = (await state(page))!;
  expect(after.progress).toBeLessThan(0.5);
  expect(after.paused).toBe(false);
});

test("the button follows the timeline when it ends on its own", async ({ page }) => {
  // Loop off, run to the end, and the bar has to notice. "Finished" is not
  // "paused", which is why tracking `paused()` alone claimed it was playing.
  await page.getByRole("button", { name: "Loop playback" }).click();
  await expect
    .poll(async () => (await state(page))?.repeat)
    .toBe(0);

  await page.evaluate(() => {
    const stage = window.__titlecard!;
    stage.seek(stage.timeline()!.duration());
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();

  // Pressing play on a finished timeline used to do nothing at all.
  await expect
    .poll(async () => (await state(page))!.progress)
    .toBeLessThan(1);
});

test("scrubbing and frame stepping move the playhead", async ({ page }) => {
  const track = page.getByRole("slider", { name: "Timeline position" });
  const box = (await track.boundingBox())!;

  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  const scrubbed = (await state(page))!;
  expect(scrubbed.progress).toBeGreaterThan(0.5);
  expect(scrubbed.paused, "scrubbing pauses").toBe(true);
  // The slider has to describe where it is, not just look like it.
  await expect(track).toHaveAttribute("aria-valuenow", /\d+/);

  const before = (await state(page))!.time;
  await page.getByRole("button", { name: "Step back one frame" }).click();
  expect((await state(page))!.time).toBeLessThan(before);

  await page.getByRole("button", { name: "Step forward one frame" }).click();
  expect((await state(page))!.time).toBeCloseTo(before, 2);
});

test("playback speed survives a timeline rebuild", async ({ page }) => {
  await page.getByRole("button", { name: "2×" }).click();
  await expect.poll(async () => (await state(page))!.timeScale).toBe(2);

  // A rebuilt timeline starts at 1x. The control kept claiming 2x over an
  // animation that had quietly gone back to normal speed.
  await page.getByRole("navigation", { name: "Editor sections" }).getByRole("button", { name: "Text" }).click();
  await page.locator("#phrase").fill("REBUILD ME");
  await expect(page.locator(".stw-preview .stw-sr").first()).toHaveText("REBUILD ME");
  await waitForStage(page);

  await expect(page.getByRole("button", { name: "2×" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await state(page))!.timeScale).toBe(2);
});

test("looping is a real repeat on the timeline", async ({ page }) => {
  const loop = page.getByRole("button", { name: "Loop playback" });
  await expect(loop).toHaveAttribute("aria-pressed", "true");
  expect((await state(page))!.repeat).toBe(-1);

  await loop.click();
  await expect(loop).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await state(page))!.repeat).toBe(0);
});

test("replaying repeatedly leaks nothing", async ({ page }) => {
  const errors = collectErrors(page);
  const nodes = () => page.evaluate(() => document.querySelectorAll(".stw-preview *").length);

  const before = await nodes();
  for (let index = 0; index < 15; index += 1) {
    await page.getByRole("button", { name: "Replay", exact: true }).click();
  }
  await page.waitForTimeout(500);

  expect(await nodes()).toBe(before);
  expect(realErrors(errors)).toEqual([]);
});
