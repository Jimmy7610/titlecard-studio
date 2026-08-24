import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared browser-test scaffolding.
 *
 * Three things every spec needs and none of them should re-invent: a project
 * seeded into storage before the app boots, a font environment that does not
 * depend on the network, and a way to park the timeline on an exact frame.
 */

export const SESSION_KEY = "stw:session:v3";
export const LEGACY_SESSION_KEY = "stw:session:v2";
export const PRESETS_KEY = "stw:presets:v3";
export const ONBOARDING_KEY = "stw:onboarding-dismissed:v1";

const fontFile = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/fonts/${name}`, import.meta.url)));

/**
 * Serves one vendored face for every family the app asks Google Fonts for.
 *
 * Determinism, not offline support: the app is allowed to want Playfair and get
 * Outfit here, because what the visual suite is asserting is layout and mask
 * geometry, and those only stay comparable across machines if the face is the
 * same one every time. Specs that care which family loaded assert on the CSS
 * value rather than on the pixels.
 */
export async function stubWebFonts(page: Page): Promise<void> {
  await page.route("https://fonts.googleapis.com/**", async (route) => {
    const url = new URL(route.request().url());
    const families = url.searchParams.getAll("family").map((value) => value.split(":")[0].replace(/\+/g, " "));

    const css = families
      .map(
        (family) => `@font-face {
  font-family: "${family}";
  font-style: normal;
  font-weight: 100 900;
  font-display: block;
  src: url("/__e2e_font_latin.woff2") format("woff2");
}
@font-face {
  font-family: "${family}";
  font-style: italic;
  font-weight: 100 900;
  font-display: block;
  src: url("/__e2e_font_latin.woff2") format("woff2");
}`,
      )
      .join("\n");

    await route.fulfill({ status: 200, contentType: "text/css", body: css });
  });

  // Anything the app still reaches for on the font CDN resolves to the fixture.
  await page.route("https://fonts.gstatic.com/**", (route) =>
    route.fulfill({ contentType: "font/woff2", body: fontFile("outfit-latin.woff2") }),
  );

  for (const [path, file] of [
    ["/__e2e_font_latin.woff2", "outfit-latin.woff2"],
    ["/__e2e_font_latin_ext.woff2", "outfit-latin-ext.woff2"],
  ] as const) {
    await page.route(`**${path}`, (route) =>
      route.fulfill({ contentType: "font/woff2", body: fontFile(file) }),
    );
  }
}

/** Collects console errors and page exceptions for a spec to assert on. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/**
 * Errors that say nothing about the application.
 *
 * Kept to an explicit list rather than a loose regex so a real failure cannot
 * hide behind it.
 */
const IGNORED_ERRORS = [
  /Failed to load resource.*fonts\.g/i,
  /net::ERR_(ABORTED|FAILED|INTERNET_DISCONNECTED)/i,
  /favicon\.ico/i,
];

export const realErrors = (errors: string[]) =>
  errors.filter((error) => !IGNORED_ERRORS.some((pattern) => pattern.test(error)));

/** Writes a session and dismisses onboarding before the first script runs. */
export async function seedSession(page: Page, session: unknown, key = SESSION_KEY): Promise<void> {
  await page.addInitScript(
    ([storageKey, onboardingKey, payload]) => {
      window.localStorage.setItem(storageKey as string, payload as string);
      window.localStorage.setItem(onboardingKey as string, "true");
    },
    [key, ONBOARDING_KEY, JSON.stringify(session)] as const,
  );
}

/** Dismisses onboarding without touching the project. */
export async function dismissOnboarding(page: Page): Promise<void> {
  await page.addInitScript(
    (key) => window.localStorage.setItem(key as string, "true"),
    ONBOARDING_KEY,
  );
}

export async function gotoEditor(page: Page): Promise<void> {
  await stubWebFonts(page);
  await page.goto("/");
  await expect(page.locator(".stw-preview .stw-canvas")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** The left rail. Panels are addressed by their visible label. */
export async function openPanel(page: Page, label: string): Promise<void> {
  await page.getByRole("navigation", { name: "Editor sections" }).getByRole("button", { name: label, exact: true }).click();
  await expect(page.getByRole("heading", { name: label })).toBeVisible();
}

export const phraseField = (page: Page): Locator => page.locator("#phrase");

/** Sets the phrase and waits for the preview to reflect it. */
export async function setPhrase(page: Page, text: string): Promise<void> {
  await openPanel(page, "Text");
  await phraseField(page).fill(text);
  await expect(page.locator(".stw-preview .stw-sr").first()).toHaveText(text, { timeout: 10_000 });
}

/**
 * Parks the timeline on an exact frame and holds it there.
 *
 * Everything visual depends on this. `page.clock` cannot help — GSAP drives off
 * requestAnimationFrame and the editor's own transport — so the handle the app
 * already exposes for the transport bar is used instead, and the resting frame
 * is committed with a paint before the screenshot is taken.
 */
export async function freezeAt(page: Page, seconds: number): Promise<void> {
  await page.evaluate(async (time) => {
    const stage = window.__titlecard;
    if (!stage) throw new Error("the stage handle is not exposed");
    await stage.settled();
    stage.seek(time);
  }, seconds);

  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-play-state: paused !important;
      transition: none !important;
    }`,
  });
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

/** Waits for the timeline to exist and for its fonts to be measurable. */
export async function waitForStage(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__titlecard?.timeline() != null, undefined, {
    timeout: 15_000,
  });
  await page.evaluate(() => window.__titlecard!.settled());
}

export type StageProbe = {
  chars: number;
  duration: number;
  outsideCanvas: number;
  restingOpacity: number;
  underlineClearsInk: boolean;
};

/**
 * Reads the resting state of the stage.
 *
 * `underlineClearsInk` re-derives the check the typography work rests on:
 * the rule has to sit below the lowest ink on the last row, measured through
 * canvas text metrics rather than trusted from CSS.
 */
export async function probeStage(page: Page): Promise<StageProbe> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>(".stw-preview .stw-canvas");
    const scope = document.querySelector<HTMLElement>(".stw-preview .stw");
    const chars = [...document.querySelectorAll<HTMLElement>(".stw-preview .stw-char")];
    if (!canvas || !scope) throw new Error("no stage");

    const canvasRect = canvas.getBoundingClientRect();
    const context = document.createElement("canvas").getContext("2d")!;

    let outside = 0;
    let dim = 0;
    let lowestInk = -Infinity;

    for (const char of chars) {
      const rect = char.getBoundingClientRect();
      const style = getComputedStyle(char);
      if (Number.parseFloat(style.opacity) < 0.995) dim += 1;
      if (
        rect.right < canvasRect.left - 1 ||
        rect.left > canvasRect.right + 1 ||
        rect.bottom < canvasRect.top - 1 ||
        rect.top > canvasRect.bottom + 1
      ) {
        outside += 1;
      }

      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = context.measureText(char.textContent ?? "");
      lowestInk = Math.max(
        lowestInk,
        rect.top + metrics.fontBoundingBoxAscent + (metrics.actualBoundingBoxDescent || 0),
      );
    }

    const underline = document.querySelector<HTMLElement>(".stw-preview .stw-underline");
    const underlineTop = underline?.getBoundingClientRect().top ?? Infinity;

    return {
      chars: chars.length,
      duration: window.__titlecard?.timeline()?.duration() ?? 0,
      outsideCanvas: outside,
      restingOpacity: dim,
      underlineClearsInk: chars.length === 0 || underlineTop >= lowestInk,
    };
  });
}
