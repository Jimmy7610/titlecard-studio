import { expect, test } from "@playwright/test";

import {
  SESSION_KEY,
  dismissOnboarding,
  freezeAtRest,
  gotoEditor,
  stubWebFonts,
  waitForStage,
} from "./helpers";

/**
 * The raster exporters, end to end.
 *
 * Everything else about position is asserted against the DOM. This runs the
 * real PNG pipeline — `captureLayout`, `paintFrame`, the ZIP writer, the
 * download — and asks where the ink actually landed in the file.
 *
 * It exists because of a bug that was invisible from the DOM. Layout geometry
 * is read through `offsetLeft`/`offsetTop`, which are deliberately blind to
 * transforms, and the layer's position offset *is* a transform: video and PNG
 * exports dropped Offset X and Y out of every frame and nothing noticed,
 * because no test had ever looked at an exported pixel.
 */

/** The layer sits a quarter of the canvas below centre. */
const OFFSET_Y = 25;

const PROJECT = {
  schemaVersion: 4,
  name: "raster",
  canvas: { formatId: "youtube", width: 1920, height: 1080, safeZones: false },
  // Transparent, so "is there ink here" is a question about alpha rather than
  // about telling type apart from a gradient. It also exercises the alpha path
  // the PNG sequence exists for.
  background: { mode: "transparent", grid: 0, noise: 0, grain: 0, vignette: 0, glow: 0 },
  typography: {
    fontId: "outfit",
    fontSize: 9,
    tracking: -0.025,
    leading: 1.1,
    weight: 700,
    align: "center",
    transform: "none",
    italic: false,
    granularity: "char",
  },
  motion: { speed: 1, stagger: 0.045, delay: 0, easing: "template", loop: false, hold: 1.1 },
  layers: [
    {
      name: "Headline",
      text: "RASTER",
      templateId: "fade-up",
      glyphPool: "hex",
      delay: 0,
      position: { anchor: "center", x: 0, y: OFFSET_Y },
      typography: {},
      wordStyles: {},
      visible: true,
    },
  ],
};

/**
 * The last entry in a stored ZIP.
 *
 * The archive is written with no compression — PNG is already deflated — so an
 * entry is its local header followed by the bytes verbatim. Worth 20 lines to
 * avoid a dependency the app itself does not have.
 */
function lastStoredEntry(zip: Buffer): Buffer {
  const entries: Buffer[] = [];
  let at = 0;

  while (at + 30 <= zip.length && zip.readUInt32LE(at) === 0x04034b50) {
    const method = zip.readUInt16LE(at + 8);
    const size = zip.readUInt32LE(at + 18);
    const nameLength = zip.readUInt16LE(at + 26);
    const extraLength = zip.readUInt16LE(at + 28);
    const body = at + 30 + nameLength + extraLength;

    expect(method, "the writer stores entries, it does not deflate them").toBe(0);
    entries.push(zip.subarray(body, body + size));
    at = body + size;
  }

  expect(entries.length, "no frames in the archive").toBeGreaterThan(1);
  return entries[entries.length - 1];
}

test("a layer's offset survives all the way into an exported PNG", async ({ page }) => {
  await stubWebFonts(page);
  await dismissOnboarding(page);

  await page.goto("/seeding-a-project-not-a-real-route");
  await page.evaluate(
    ([key, payload]) => {
      window.localStorage.setItem(key as string, payload as string);
      window.localStorage.setItem("stw:onboarding-dismissed:v1", "true");
    },
    [SESSION_KEY, JSON.stringify(PROJECT)] as const,
  );

  await gotoEditor(page);
  await waitForStage(page);
  await freezeAtRest(page);

  // Where the preview puts the type, as a fraction of the canvas.
  const preview = await page.evaluate(() => {
    const canvas = document
      .querySelector<HTMLElement>(".stw-preview .stw-canvas")!
      .getBoundingClientRect();
    const block = document.querySelector<HTMLElement>(".stw-preview .stw")!.getBoundingClientRect();
    return {
      cx: (block.left + block.width / 2 - canvas.left) / canvas.width,
      cy: (block.top + block.height / 2 - canvas.top) / canvas.height,
    };
  });

  // A quarter of the canvas below centre is where the offset asked for it.
  expect(preview.cy).toBeCloseTo(0.5 + OFFSET_Y / 100, 2);

  await page
    .getByRole("navigation", { name: "Editor sections" })
    .getByRole("button", { name: "Presets", exact: true })
    .click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("tab", { name: "Frames" }).click();

  // Small and slow: enough frames that the last one is at rest, few enough that
  // the whole pipeline runs in a couple of seconds.
  for (const [label, value] of [
    ["Width", "480"],
    ["Height", "270"],
    ["FPS", "5"],
    ["Duration", "3"],
  ] as const) {
    const field = page.getByRole("dialog").getByLabel(label, { exact: true });
    await field.fill(value);
    await field.blur();
  }

  const download = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByRole("button", { name: /Export \d+ PNGs/ }).click();
  const file = await download;

  const path = await file.path();
  const { readFileSync } = await import("node:fs");
  const png = lastStoredEntry(readFileSync(path));

  // Decoded in the browser rather than here: it already has a PNG decoder, and
  // hand-rolling one for a test would be its own source of bugs.
  const raster = await page.evaluate(async (bytes) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
    const bitmap = await createImageBitmap(blob);
    const surface = document.createElement("canvas");
    surface.width = bitmap.width;
    surface.height = bitmap.height;
    const ctx = surface.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

    let top = Infinity;
    let bottom = -Infinity;
    let left = Infinity;
    let right = -Infinity;

    for (let y = 0; y < bitmap.height; y += 1) {
      for (let x = 0; x < bitmap.width; x += 1) {
        // Anything but fully clear counts as ink; the background is transparent.
        if (data[(y * bitmap.width + x) * 4 + 3] <= 8) continue;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }

    return {
      width: bitmap.width,
      height: bitmap.height,
      hasInk: bottom >= top,
      cx: (left + right) / 2 / bitmap.width,
      cy: (top + bottom) / 2 / bitmap.height,
    };
  }, [...png]);

  expect(raster.width).toBe(480);
  expect(raster.height).toBe(270);
  expect(raster.hasInk, "the exported frame is blank").toBe(true);

  // The whole point. Painted ink sits where the preview says it does — which it
  // did not while the layer's transform was being read through a layout box.
  expect(raster.cx, "raster x matches the preview").toBeCloseTo(preview.cx, 1);
  expect(raster.cy, "raster y matches the preview").toBeCloseTo(preview.cy, 1);
});
