import { expect, test } from "@playwright/test";

import { TEMPLATES } from "../lib/templates";
import { collectErrors, dismissOnboarding, gotoEditor, probeStage, realErrors } from "./helpers";

/**
 * Every template, in one data-driven pass.
 *
 * Twenty-eight copy-pasted specs would rot together and nobody would add the
 * twenty-ninth. This drives the registry itself, so a template added tomorrow
 * is covered the moment it lands — and a template deleted stops being tested
 * without anyone having to remember to remove a file.
 *
 * The assertion is the one that matters and that unit tests cannot make: after
 * the timeline has run, is the text actually there, inside its own canvas, at
 * full opacity, with the rule clear of the ink.
 */

const PHRASE = "RÄKSMÖRGÅS gyjpq 3";

test.describe("templates", () => {
  test.beforeEach(async ({ page }) => {
    await dismissOnboarding(page);
  });

  test("every template builds, runs and comes to rest", async ({ page }) => {
    test.slow();

    const errors = collectErrors(page);
    await gotoEditor(page);

    // Seed once and drive the templates through the same handle the transport
    // uses: clicking twenty-eight gallery cards adds scroll flake and tests the
    // gallery, not the templates.
    await page.evaluate((phrase) => {
      const field = document.querySelector<HTMLTextAreaElement>("#phrase");
      if (field) field.value = phrase;
    }, PHRASE);

    const failures: string[] = [];

    for (const template of TEMPLATES) {
      await page.evaluate(
        ([templateId, phrase]) => {
          const key = "stw:session:v3";
          const raw = window.localStorage.getItem(key);
          const project = raw ? JSON.parse(raw) : {};
          project.schemaVersion = 3;
          project.layers = [
            {
              name: "Headline",
              text: phrase,
              templateId,
              glyphPool: "hex",
              delay: 0,
              position: { anchor: "center", x: 0, y: 0 },
              typography: {},
              wordStyles: {},
              visible: true,
            },
          ];
          project.motion = { ...(project.motion ?? {}), loop: false };
          window.localStorage.setItem(key, JSON.stringify(project));
        },
        [template.id, PHRASE] as const,
      );

      await page.reload();
      await page.waitForFunction(() => window.__titlecard?.timeline() != null, undefined, {
        timeout: 20_000,
      });
      await page.evaluate(() => window.__titlecard!.settled());

      // Park on the resting frame rather than waiting the timeline out: the
      // assertion is about the state it settles into, not how long it takes.
      await page.evaluate(() => {
        const stage = window.__titlecard!;
        const timeline = stage.timeline()!;
        stage.seek(timeline.duration());
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );

      const probe = await probeStage(page);
      const problems: string[] = [];
      if (probe.chars === 0) problems.push("rendered no characters");
      if (probe.duration <= 0) problems.push("built a zero-length timeline");
      if (probe.outsideCanvas > 0) problems.push(`${probe.outsideCanvas} glyphs outside the canvas`);
      if (probe.restingOpacity > 0) {
        problems.push(`${probe.restingOpacity} glyphs still transparent at rest`);
      }
      if (!probe.underlineClearsInk) problems.push("the rule sits inside the ink");

      if (problems.length) failures.push(`${template.id}: ${problems.join(", ")}`);
    }

    expect(failures, failures.join("\n")).toEqual([]);
    expect(realErrors(errors)).toEqual([]);
  });
});
