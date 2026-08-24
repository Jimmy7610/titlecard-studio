import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests.
 *
 * Titlecard is a visual, stateful, animation-driven editor. Unit tests cover
 * the pure halves — segmentation, schema, codegen — but nothing about "the
 * glyph is inside its mask" or "the transport agrees with the timeline" is
 * reachable without a browser. These fill that gap and are deliberately few:
 * one data-driven pass over every template beats twenty-eight hand-written
 * copies that all rot together.
 *
 * Determinism is the whole game for the screenshot suite. Every visual test
 * parks the timeline at a fixed time, disables CSS animation, and renders
 * against a locally served font, so a run does not depend on the network,
 * the frame the CI machine happened to be on, or how fast fonts.googleapis.com
 * answered.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3210);

export default defineConfig({
  testDir: "./e2e",
  // The editor writes to localStorage on a debounce and reads it back on load,
  // so two workers sharing an origin would fight over one project. Each file
  // gets its own context, but serial keeps the shared dev server honest too.
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // Font rasterisation differs by a hair between platforms even with the
      // same face. This tolerates that without tolerating a layout change.
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    video: "off",
    screenshot: "only-on-failure",
    // A fixed viewport keeps `cqw`-derived type at a fixed pixel size.
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: undefined,
        // After the device spread, not before: `devices` carries its own
        // viewport, and a project-level `use` wins over the top-level one. A
        // silently different width changes which columns the editor shows and
        // resizes every `cqw`-derived glyph in the screenshots.
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    // Production build: `next dev` injects an overlay and recompiles on first
    // hit, which is exactly the sort of timing variance a visual suite cannot
    // afford. Reusing an already-running server locally keeps the loop fast.
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
