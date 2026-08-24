import { expect, test } from "@playwright/test";

import {
  PRIOR_SESSION_KEY,
  SESSION_KEY,
  dismissOnboarding,
  freezeAtRest,
  gotoEditor,
  stubWebFonts,
  waitForStage,
} from "./helpers";

/**
 * Layer position: the nine-point anchor, and the offset on top of it.
 *
 * The offset used to be a `translate()` percentage on the text block, which CSS
 * resolves against that block. The same number therefore meant a different
 * distance for every phrase — an offset of 40 moved a one-line subtitle by
 * about 5% of the canvas — and no value the slider allowed could move a short
 * line far enough to clear another layer. It is displacement of the layer now,
 * and the layer is the canvas box.
 */

type Layer = {
  text: string;
  anchor?: string;
  x?: number;
  y?: number;
  scale?: number;
  fontSize?: number;
};

/**
 * Loads the editor with one project. Safe to call more than once per test.
 *
 * Neither obvious way of doing this survives being called twice.
 * `addInitScript` accumulates for the life of the page, so the second seed
 * would be running behind the first and which one won would depend on
 * registration order. Writing storage from the editor and reloading races the
 * editor's own debounced save, which can put the previous project back between
 * the write and the reload.
 *
 * So the write happens on a same-origin page that does not mount the editor.
 * Nothing is running there to save over it, and the editor reads it fresh on
 * the next load.
 */
async function seed(page: import("@playwright/test").Page, layers: Layer[], fontSize = 6) {
  const project = JSON.stringify({
    schemaVersion: 4,
    name: "position",
    canvas: { formatId: "youtube", width: 1920, height: 1080, safeZones: false },
    typography: {
      fontId: "outfit",
      fontSize,
      tracking: -0.025,
      leading: 1.1,
      weight: 600,
      align: "center",
      transform: "none",
      italic: false,
      granularity: "char",
    },
    motion: { speed: 1, stagger: 0.045, delay: 0, easing: "template", loop: false, hold: 1.1 },
    layers: layers.map((layer, index) => ({
      name: `L${index}`,
      text: layer.text,
      templateId: "fade-up",
      glyphPool: "hex",
      delay: 0,
      position: { anchor: layer.anchor ?? "center", x: layer.x ?? 0, y: layer.y ?? 0 },
      typography: layer.scale ? { scale: layer.scale } : {},
      wordStyles: {},
      visible: true,
    })),
  });

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
  await freezeAtRest(page);
}

/** Where each layer's type sits, as a fraction of the canvas box. */
async function placements(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const canvasEl = document.querySelector<HTMLElement>(".stw-preview .stw-canvas")!;
    const canvas = canvasEl.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>(".stw-preview .stw")].map((scope) => {
      const rect = scope.getBoundingClientRect();
      return {
        cx: ((rect.left + rect.right) / 2 - canvas.left) / canvas.width,
        cy: ((rect.top + rect.bottom) / 2 - canvas.top) / canvas.height,
        left: (rect.left - canvas.left) / canvas.width,
        right: (rect.right - canvas.left) / canvas.width,
        top: (rect.top - canvas.top) / canvas.height,
        bottom: (rect.bottom - canvas.top) / canvas.height,
        widthFraction: rect.width / canvas.width,
      };
    });
  });
}

/**
 * The layer's inset, as a fraction of the canvas on each axis.
 *
 * An anchored block sits against the *padded* edge rather than the canvas edge,
 * and the padding is set in percentages — which CSS resolves against the width
 * on both axes — so the vertical inset is not the number in the stylesheet.
 * Read rather than assumed, so the test keeps meaning what it says if the
 * padding is ever retuned.
 */
async function inset(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const canvas = document
      .querySelector<HTMLElement>(".stw-preview .stw-canvas")!
      .getBoundingClientRect();
    const style = getComputedStyle(document.querySelector<HTMLElement>(".stw-preview .stw-layer")!);
    return {
      x: parseFloat(style.paddingLeft) / canvas.width,
      y: parseFloat(style.paddingTop) / canvas.height,
    };
  });
}

test.beforeEach(async ({ page }) => {
  // Positions are measured against the text block's own edges, so the face has
  // to be the same one every run — otherwise a headline is a different width
  // here than on the machine next to it.
  await stubWebFonts(page);
  await dismissOnboarding(page);
});

test("an offset displaces by a share of the canvas, not of the phrase", async ({ page }) => {
  // Two layers whose text blocks are wildly different widths. The same offset
  // has to move both by the same distance.
  await seed(page, [
    { text: "A", y: -30 },
    { text: "A MUCH LONGER HEADLINE HERE", y: 30 },
  ]);

  const [short, long] = await placements(page);
  expect(long.widthFraction).toBeGreaterThan(short.widthFraction * 3);

  expect(short.cy).toBeCloseTo(0.5 - 0.3, 2);
  expect(long.cy).toBeCloseTo(0.5 + 0.3, 2);
});

test("the same offset moves a small and a huge layer identically", async ({ page }) => {
  await seed(page, [
    { text: "TINY", scale: 0.4, x: 25 },
    { text: "HUGE", scale: 2.0, x: 25 },
  ]);

  const [small, large] = await placements(page);
  expect(small.cx).toBeCloseTo(0.5 + 0.25, 2);
  expect(large.cx).toBeCloseTo(0.5 + 0.25, 2);
});

/**
 * The nine anchors, with the fraction of the canvas each should pin the block
 * to on each axis. 0 is the near edge, 1 the far one, 0.5 the middle.
 */
const ANCHORS = [
  ["top-left", 0, 0],
  ["top", 0.5, 0],
  ["top-right", 1, 0],
  ["left", 0, 0.5],
  ["center", 0.5, 0.5],
  ["right", 1, 0.5],
  ["bottom-left", 0, 1],
  ["bottom", 0.5, 1],
  ["bottom-right", 1, 1],
] as const;

for (const [anchor, wantX, wantY] of ANCHORS) {
  // One test per anchor rather than one loop over all nine: each is two page
  // loads, and nine of those in a single test is slow enough to be reported as
  // a timeout instead of as whichever anchor actually broke.
  test(`the ${anchor} anchor holds, and composes with an offset`, async ({ page }) => {
    await seed(page, [{ text: "ANCHOR", anchor }], 4);
    const pad = await inset(page);
    const [plain] = await placements(page);

    // Two claims: the block lands against the edge the anchor names, and the
    // offset adds the same canvas-relative displacement on top of it. Edges
    // rather than centres, so the assertion does not quietly depend on how wide
    // the word happens to render.
    const expectEdge = (want: number, axis: "x" | "y") => {
      const [near, far, gap] =
        axis === "x" ? [plain.left, plain.right, pad.x] : [plain.top, plain.bottom, pad.y];
      if (want === 0) expect(near, `${anchor} ${axis} near edge`).toBeCloseTo(gap, 2);
      else if (want === 1) expect(far, `${anchor} ${axis} far edge`).toBeCloseTo(1 - gap, 2);
      else expect((near + far) / 2, `${anchor} ${axis} centred`).toBeCloseTo(0.5, 2);
    };

    expectEdge(wantX, "x");
    expectEdge(wantY, "y");

    await seed(page, [{ text: "ANCHOR", anchor, x: 10, y: 10 }], 4);
    const [nudged] = await placements(page);

    expect(nudged.cx - plain.cx, `${anchor} +x`).toBeCloseTo(0.1, 2);
    expect(nudged.cy - plain.cy, `${anchor} +y`).toBeCloseTo(0.1, 2);
  });
}

test("the offset reaches the raster exporter, not just the preview", async ({ page }) => {
  await seed(page, [{ text: "RASTER", y: 30 }]);

  // `captureLayout` reads `offsetTop`, which is deliberately blind to
  // transforms — and the offset is a transform. Video and PNG exports dropped
  // it entirely until the layer's translate was captured separately.
  const report = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>(".stw-preview .stw-canvas")!;
    const layer = document.querySelector<HTMLElement>(".stw-preview .stw-layer")!;
    const char = document.querySelector<HTMLElement>(".stw-preview .stw-char")!;

    const staticTop = (el: HTMLElement) => {
      let y = 0;
      let node: HTMLElement | null = el;
      while (node && node !== canvas) {
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return y;
    };

    const matrix = new DOMMatrixReadOnly(getComputedStyle(layer).transform);
    const canvasRect = canvas.getBoundingClientRect();

    return {
      capturedOffsetY: matrix.f,
      expectedOffsetY: canvasRect.height * 0.3,
      // The offset resolves against the layer box, so that box has to *be* the
      // canvas box — which is the whole of what "canvas-relative" means here.
      layerBoxMatchesCanvas:
        Math.abs(layer.getBoundingClientRect().height - canvasRect.height) < 0.01,
      staticPlusOffset: staticTop(char) + matrix.f,
      liveTop: char.getBoundingClientRect().top - canvasRect.top,
    };
  });

  expect(report.layerBoxMatchesCanvas).toBe(true);

  // The captured translate is the displacement the exporter has to add…
  expect(report.capturedOffsetY).toBeCloseTo(report.expectedOffsetY, 1);
  // …and adding it to the layout position reproduces what is on screen. Within
  // a pixel: `offsetTop` is an integer, so summing the chain rounds once per
  // step. That rounding is `captureLayout`'s all along and is well under the
  // scale factor between this preview and an exported frame.
  expect(Math.abs(report.staticPlusOffset - report.liveTop)).toBeLessThan(1);
});

test("a project written before the change still opens, and says so", async ({ page }) => {
  await page.addInitScript(
    ([key]) => {
      window.localStorage.setItem(
        key as string,
        JSON.stringify({
          $schema: "titlecard/project@3",
          schemaVersion: 3,
          name: "From v3",
          layers: [
            {
              name: "Headline",
              text: "OLD OFFSETS",
              templateId: "fade-up",
              visible: true,
              position: { anchor: "center", x: 0, y: 18 },
            },
          ],
        }),
      );
      window.localStorage.setItem("stw:onboarding-dismissed:v1", "true");
    },
    [PRIOR_SESSION_KEY] as const,
  );

  await gotoEditor(page);
  await waitForStage(page);

  await expect(page.locator(".stw-preview .stw-sr").first()).toHaveText("OLD OFFSETS");

  // Written forward under the current key, with the value carried across.
  await expect
    .poll(async () =>
      page.evaluate((key) => {
        const raw = window.localStorage.getItem(key as string);
        return raw ? (JSON.parse(raw) as { schemaVersion: number }).schemaVersion : null;
      }, SESSION_KEY),
    )
    .toBe(4);

  const stored = await page.evaluate(
    ([current, prior]) => ({
      layers: (
        JSON.parse(window.localStorage.getItem(current as string)!) as {
          layers: { position: { y: number } }[];
        }
      ).layers,
      priorStillThere: window.localStorage.getItem(prior as string) !== null,
    }),
    [SESSION_KEY, PRIOR_SESSION_KEY] as const,
  );

  // Carried across untouched — there is no honest factor to convert it by.
  expect(stored.layers[0].position.y).toBe(18);
  // And the old copy is only dropped once the new one is safely written.
  expect(stored.priorStillThere).toBe(false);
});
