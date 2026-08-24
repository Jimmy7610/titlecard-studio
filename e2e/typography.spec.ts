import { expect, test } from "@playwright/test";

import {
  SESSION_KEY,
  dismissOnboarding,
  freezeAtRest,
  gotoEditor,
  waitForStage,
} from "./helpers";

/**
 * Typography geometry that only a real layout engine can answer.
 *
 * The mask, the baseline and the underline are derived from font metrics, so
 * none of this is checkable from a string. Each assertion here is a regression
 * that shipped: a rule drawn through descenders, a caret on its own line, and
 * a size-multiplied word sitting off the line it belongs to.
 */

type Scene = {
  text: string;
  templateId?: string;
  fontId?: string;
  weight?: number;
  fontSize?: number;
  leading?: number;
  tracking?: number;
  wordStyles?: Record<number, Record<string, unknown>>;
};

async function seedScene(page: import("@playwright/test").Page, scene: Scene) {
  await page.addInitScript(
    ([key, payload]) => {
      window.localStorage.setItem(key as string, payload as string);
      window.localStorage.setItem("stw:onboarding-dismissed:v1", "true");
    },
    [
      SESSION_KEY,
      JSON.stringify({
        schemaVersion: 3,
        name: "typography",
        canvas: { formatId: "youtube", width: 1920, height: 1080, safeZones: false },
        typography: {
          fontId: scene.fontId ?? "outfit",
          fontSize: scene.fontSize ?? 7,
          tracking: scene.tracking ?? -0.025,
          leading: scene.leading ?? 1.1,
          weight: scene.weight ?? 600,
          align: "center",
          transform: "none",
          italic: false,
          granularity: "char",
        },
        motion: { speed: 1, stagger: 0.045, delay: 0, easing: "template", loop: false, hold: 1.1 },
        layers: [
          {
            name: "Headline",
            text: scene.text,
            templateId: scene.templateId ?? "fade-up",
            glyphPool: "hex",
            delay: 0,
            position: { anchor: "center", x: 0, y: 0 },
            typography: {},
            wordStyles: scene.wordStyles ?? {},
            visible: true,
          },
        ],
      }),
    ] as const,
  );
}

/** Baseline of every word, derived from canvas metrics rather than from CSS. */
async function wordBaselines(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const context = document.createElement("canvas").getContext("2d")!;
    return [...document.querySelectorAll<HTMLElement>(".stw-preview .stw-word")].map((word) => {
      const style = getComputedStyle(word);
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = context.measureText("Hxg");
      const char = word.querySelector<HTMLElement>(".stw-char")!;
      const rect = char.getBoundingClientRect();
      return {
        text: word.textContent ?? "",
        size: Number.parseFloat(style.fontSize),
        baseline: rect.top + metrics.fontBoundingBoxAscent,
      };
    });
  });
}

test.beforeEach(async ({ page }) => {
  await dismissOnboarding(page);
});

test("a size-multiplied word sits on the same baseline as its neighbours", async ({ page }) => {
  await seedScene(page, { text: "one BIG two", wordStyles: { 1: { scale: 1.6 } } });
  await gotoEditor(page);
  await waitForStage(page);
  await freezeAtRest(page);

  const words = await wordBaselines(page);
  expect(words).toHaveLength(3);
  expect(words[1].size).toBeGreaterThan(words[0].size * 1.5);

  // The whole point of splitting the word from its mask. A clipping
  // inline-block takes its bottom margin edge as its baseline, so while the
  // word was itself the clipper this was most of an ascender out.
  const spread = Math.max(...words.map((w) => w.baseline)) - Math.min(...words.map((w) => w.baseline));
  expect(spread).toBeLessThan(0.5);
});

test("the baseline holds across scales, faces and leadings", async ({ page }) => {
  for (const scene of [
    { text: "small HUGE small", wordStyles: { 1: { scale: 2.4 } }, leading: 0.8 },
    { text: "tiny word here", wordStyles: { 1: { scale: 0.4 } }, leading: 2.0 },
    { text: "serif MIXED case", fontId: "playfair", weight: 500, wordStyles: { 1: { scale: 1.35 } } },
  ] satisfies Scene[]) {
    await seedScene(page, scene);
    await gotoEditor(page);
    await waitForStage(page);
    await freezeAtRest(page);

    const words = await wordBaselines(page);
    const spread =
      Math.max(...words.map((w) => w.baseline)) - Math.min(...words.map((w) => w.baseline));
    expect(spread, `${scene.text} @ leading ${scene.leading ?? 1.1}`).toBeLessThan(0.5);
  }
});

test("the mask still clips, and never clips a descender at rest", async ({ page }) => {
  await seedScene(page, { text: "Typography gyjpq", leading: 0.8, wordStyles: { 1: { scale: 1.4 } } });
  await gotoEditor(page);
  await waitForStage(page);
  await freezeAtRest(page);

  const report = await page.evaluate(() => {
    const chars = [...document.querySelectorAll<HTMLElement>(".stw-preview .stw-char")];
    let clipped = 0;
    let masks = 0;
    for (const char of chars) {
      const mask = char.closest<HTMLElement>(".stw-mask");
      if (!mask) continue;
      masks += 1;
      if (getComputedStyle(mask).overflow !== "hidden") continue;
      const charRect = char.getBoundingClientRect();
      const maskRect = mask.getBoundingClientRect();
      // At rest the glyph box must sit inside its own mask, or a descender is
      // being cut off before anything has even animated.
      if (charRect.bottom > maskRect.bottom + 1 || charRect.top < maskRect.top - 1) clipped += 1;
    }
    return { chars: chars.length, masks, clipped };
  });

  expect(report.chars).toBeGreaterThan(0);
  expect(report.masks).toBe(report.chars);
  expect(report.clipped).toBe(0);
});

test("the word is the layout box and the mask is the clip box", async ({ page }) => {
  await seedScene(page, { text: "one BIG two", wordStyles: { 1: { scale: 1.6 } } });
  await gotoEditor(page);
  await waitForStage(page);
  await freezeAtRest(page);

  const roles = await page.evaluate(() => {
    const word = document.querySelector<HTMLElement>(".stw-preview .stw-word")!;
    const mask = word.querySelector<HTMLElement>(".stw-mask")!;
    const wordStyle = getComputedStyle(word);
    const maskStyle = getComputedStyle(mask);
    return {
      wordOverflow: wordStyle.overflow,
      wordVerticalAlign: wordStyle.verticalAlign,
      maskOverflow: maskStyle.overflow,
      maskVerticalAlign: maskStyle.verticalAlign,
      // The split must not change what the line box measures.
      sameHeight:
        Math.abs(word.getBoundingClientRect().height - mask.getBoundingClientRect().height) < 0.5,
    };
  });

  expect(roles.wordOverflow).toBe("visible");
  expect(roles.wordVerticalAlign).toBe("baseline");
  expect(roles.maskOverflow).toBe("hidden");
  expect(roles.maskVerticalAlign).toBe("top");
  expect(roles.sameHeight).toBe(true);
});

test("an unmasked template opts the mask out, not the word", async ({ page }) => {
  // Punch Words scales whole words past their own box; the mask would amputate
  // it rather than bound it.
  await seedScene(page, { text: "PUNCH IT", templateId: "punch-words" });
  await gotoEditor(page);
  await waitForStage(page);

  const overflow = await page.evaluate(() => {
    const mask = document.querySelector<HTMLElement>(".stw-preview .stw-mask")!;
    return getComputedStyle(mask).overflow;
  });
  expect(overflow).toBe("visible");
});

test("the rule clears the ink at every size the slider allows", async ({ page }) => {
  for (const fontSize of [3, 7, 14, 22]) {
    await seedScene(page, {
      text: "Typography gyjpq",
      templateId: "line-mask",
      fontSize,
    });
    await gotoEditor(page);
    await waitForStage(page);
    // Line Mask lands its characters at 1.05s and holds the rule at full width
    // until 1.29s, so this is the one frame where both are fully on screen.
    await page.evaluate(() => window.__titlecard!.seek(1.1));
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );

    const clears = await page.evaluate(() => {
      const context = document.createElement("canvas").getContext("2d")!;
      const underline = document.querySelector<HTMLElement>(".stw-preview .stw-underline")!;
      const top = underline.getBoundingClientRect().top;

      let lowestInk = -Infinity;
      for (const char of document.querySelectorAll<HTMLElement>(".stw-preview .stw-char")) {
        const style = getComputedStyle(char);
        context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const metrics = context.measureText(char.textContent ?? "");
        const rect = char.getBoundingClientRect();
        lowestInk = Math.max(
          lowestInk,
          rect.top + metrics.fontBoundingBoxAscent + (metrics.actualBoundingBoxDescent || 0),
        );
      }
      return top - lowestInk;
    });

    // Sub-pixel tolerance: at the smallest sizes the rasteriser quantises the
    // reported descent to a whole pixel, which is not a real collision.
    expect(clears, `font size ${fontSize}`).toBeGreaterThan(-1);
  }
});
