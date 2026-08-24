import { expect, test } from "@playwright/test";

import { dismissOnboarding, gotoEditor, openPanel } from "./helpers";

/**
 * Accessibility invariants that a refactor can quietly break.
 *
 * Not a WCAG audit — a set of properties that have already regressed once
 * each. Every one of these was true, stopped being true because of a change
 * somewhere else, and was only noticed by accident.
 */

const PANELS = [
  "Templates",
  "Text",
  "Typography",
  "Style",
  "Motion",
  "Background",
  "Canvas",
  "Layers",
  "Presets",
] as const;

test.beforeEach(async ({ page }) => {
  await dismissOnboarding(page);
  await gotoEditor(page);
});

test("every operable control has an accessible name", async ({ page }) => {
  const unnamed: string[] = [];

  for (const panel of PANELS) {
    await openPanel(page, panel);

    // A wrapper that puts the `id` on a hidden input leaves the button the user
    // actually presses with no name at all — which is what happened to every
    // switch in the editor.
    const found = await page.evaluate(() => {
      const selector = 'button, [role="switch"], [role="slider"], [role="tab"], a[href]';
      const problems: string[] = [];

      for (const node of document.querySelectorAll<HTMLElement>(selector)) {
        if (node.getAttribute("aria-hidden") === "true") continue;
        if (node.offsetParent === null) continue;

        const labelledBy = node.getAttribute("aria-labelledby");
        const named =
          (node.getAttribute("aria-label") ?? "").trim().length > 0 ||
          (node.textContent ?? "").trim().length > 0 ||
          (labelledBy
            ? (document.getElementById(labelledBy)?.textContent ?? "").trim().length > 0
            : false) ||
          (node.getAttribute("title") ?? "").trim().length > 0;

        if (!named) {
          problems.push(`${node.tagName.toLowerCase()}.${node.className.slice(0, 40)}`);
        }
      }
      return problems;
    });

    unnamed.push(...found.map((entry) => `${panel}: ${entry}`));
  }

  expect(unnamed, unnamed.join("\n")).toEqual([]);
});

test("the export dialog traps focus and closes on Escape", async ({ page }) => {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Focus has to be inside the dialog, not left behind on the page under it.
  const insideAfterTabs = await page.evaluate(async () => {
    const dialogEl = document.querySelector('[role="dialog"]')!;
    for (let index = 0; index < 12; index += 1) {
      const active = document.activeElement;
      if (active && !dialogEl.contains(active)) return false;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return true;
  });
  expect(insideAfterTabs).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("the timeline slider is operable from the keyboard", async ({ page }) => {
  const track = page.getByRole("slider", { name: "Timeline position" });
  await track.focus();
  await expect(track).toBeFocused();

  const before = await page.evaluate(() => window.__titlecard!.timeline()!.time());
  await page.keyboard.press("ArrowRight");
  const after = await page.evaluate(() => window.__titlecard!.timeline()!.time());
  expect(after).not.toBe(before);

  await expect(track).toHaveAttribute("aria-valuemin", "0");
  await expect(track).toHaveAttribute("aria-valuemax", "100");
  await expect(track).toHaveAttribute("aria-valuenow", /\d+/);
});

test("the split spans are hidden from assistive tech", async ({ page }) => {
  // A screen reader has to hear the phrase, not thirteen disconnected letters.
  const visual = page.locator(".stw-preview .stw-visual").first();
  await expect(visual).toHaveAttribute("aria-hidden", "true");

  const announced = await page
    .getByText("MOTION STUDIO", { exact: true })
    .first()
    .textContent();
  expect(announced).toBe("MOTION STUDIO");
});

test("reduced motion commits the resting frame instead of animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator(".stw-preview .stw-canvas")).toBeVisible();

  // No timeline at all, and the text is fully rendered rather than mid-reveal.
  await expect
    .poll(() => page.evaluate(() => window.__titlecard?.timeline() ?? null))
    .toBeNull();

  const opacity = await page.evaluate(() => {
    const chars = [...document.querySelectorAll<HTMLElement>(".stw-preview .stw-char")];
    return chars.map((char) => Number.parseFloat(getComputedStyle(char).opacity));
  });
  expect(opacity.length).toBeGreaterThan(0);
  expect(opacity.every((value) => value > 0.99)).toBe(true);
});
