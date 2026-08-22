import assert from "node:assert/strict";
import { test } from "node:test";

import { SPLIT_PRIMITIVES_CSS } from "../lib/export/css";
import { buildExportModel } from "../lib/export/model";
import { standaloneHtml } from "../lib/export/documents";
import { layerData, layerMarkup } from "../lib/export/markup";
import { DEFAULT_PROJECT } from "../lib/project";
import type { ProjectState } from "../lib/types";

/**
 * The editor and the standalone page render the same markup against the same
 * stylesheet, so anything that can make one lay out differently from the other
 * is a parity bug — and every case below is one that actually shipped.
 */

function projectWith(over: Partial<ProjectState>): ProjectState {
  return { ...DEFAULT_PROJECT, ...over };
}

const htmlFor = (project: ProjectState) => standaloneHtml(buildExportModel(project));

/** One declaration block out of the primitives, selector included. */
function ruleFor(selector: string): string {
  const start = SPLIT_PRIMITIVES_CSS.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} must exist in the primitives`);
  const end = SPLIT_PRIMITIVES_CSS.indexOf("}", start);
  return SPLIT_PRIMITIVES_CSS.slice(start, end + 1);
}

test("the layer style attribute survives a quoted font stack", () => {
  const html = htmlFor(DEFAULT_PROJECT);

  // `--stw-font: "Outfit", …` written raw closes the attribute on its own
  // first quote, which silently dropped the font, size, weight, tracking,
  // leading and alignment from every export.
  assert.ok(
    html.includes("--stw-font:&quot;"),
    "the font stack must be escaped inside the style attribute",
  );
  assert.ok(!/style="[^"]*--stw-font:"/.test(html), "an unescaped quote reopens the attribute");

  for (const variable of [
    "--stw-size:",
    "--stw-weight:",
    "--stw-tracking:",
    "--stw-leading:",
    "--stw-align:",
  ]) {
    assert.ok(html.includes(variable), `${variable} must reach the markup`);
  }

  // Every style attribute has to close where it opened.
  const attributes = html.match(/ style="[^"]*"/g) ?? [];
  assert.ok(attributes.length > 0);
  for (const attribute of attributes) {
    assert.ok(!attribute.slice(8, -1).includes('"'), `stray quote in ${attribute}`);
  }
});

test("no collapsible whitespace between the split spans", () => {
  const html = htmlFor(
    projectWith({
      layers: [{ ...DEFAULT_PROJECT.layers[0], text: "TWO WORDS\nSECOND LINE" }],
    }),
  );

  // A newline between two inline-blocks renders as a space. The printed markup
  // used to set every character a space apart and every word three, while the
  // editor's JSX set them flush.
  assert.ok(
    !/<\/span>\s+<span class="stw-char"/.test(html),
    "characters must be joined without rendering whitespace",
  );
  assert.ok(
    !/<\/span>\s+<span class="stw-word"/.test(html),
    "words must be joined without rendering whitespace",
  );
  assert.ok(
    !/<\/span>\s+<span class="stw-space"/.test(html),
    "the word gap must come from the space span alone",
  );
  assert.ok(html.includes("<!--"), "the seams are comments, so the file stays readable");
});

test("the caret is emitted inside the last line", () => {
  const model = buildExportModel(
    projectWith({
      layers: [
        { ...DEFAULT_PROJECT.layers[0], text: "Boot up\nsecond", templateId: "terminal-type" },
      ],
    }),
  );
  const markup = layerMarkup(model.layers[0], "");

  // As a sibling of the line blocks the caret opened a line box of its own,
  // parking it under the phrase and stretching the block past its descent.
  const lines = markup.match(/<span class="stw-line">[\s\S]*?<\/span>(?=<|\s*$)/g) ?? [];
  assert.ok(markup.includes('<span class="stw-cursor">'));
  assert.ok(
    !/<\/span>\s*<span class="stw-cursor">\s*<\/span>\s*<span class="stw-underline">/.test(markup),
    "the caret must not sit between the lines and the underline",
  );
  assert.equal(lines.length > 0, true);

  const caretIndex = markup.indexOf('<span class="stw-cursor">');
  const lastLineOpen = markup.lastIndexOf('<span class="stw-line">');
  const underlineIndex = markup.indexOf('<span class="stw-underline">');
  assert.ok(caretIndex > lastLineOpen, "the caret belongs to the last line");
  assert.ok(caretIndex < underlineIndex);
});

test("word styles reach React as React style keys", () => {
  const model = buildExportModel(
    projectWith({
      layers: [
        {
          ...DEFAULT_PROJECT.layers[0],
          text: "BUILD SOMETHING IMPOSSIBLE",
          wordStyles: { 2: { scale: 1.4, glow: 0.3, weight: 800 } },
        },
      ],
    }),
  );

  // React logs "Unsupported style property font-size" for every hyphenated
  // key — in the editor, and inside the component this app generates.
  const data = layerData(model.layers[0]);
  const keys = data.lines.flat().flatMap((word) => Object.keys(word.style));
  assert.ok(keys.length > 0, "the styled word must carry declarations");
  for (const key of keys) {
    assert.ok(!key.includes("-"), `${key} must be camelCase for React`);
  }

  // The HTML exporter still prints CSS.
  assert.ok(layerMarkup(model.layers[0], "").includes("font-size:"));
});

test("underline geometry is derived from font metrics, not a fixed offset", () => {
  const rule = ruleFor(".stw-underline");

  // The original rule pinned `bottom: 0.17em` against a block whose own bottom
  // edge sits above the last line's descent, so the rule cut through every
  // descender. Whatever replaces it has to read the leading and the lh unit.
  assert.ok(!/\bbottom:\s*[\d.]+em/.test(rule), "no fixed offset from the bottom edge");
  assert.ok(rule.includes("--stw-leading"), "the leading correction must be accounted for");
  assert.ok(rule.includes("1lh"), "the mask height must come from the font's own metrics");
});

test("leading is corrected symmetrically, so the block is centred on its glyphs", () => {
  const rule = ruleFor(".stw-word");

  // Half above and half below. Put it all below and the block ends above its
  // own descenders, which is what put the underline inside the text.
  assert.ok(rule.includes("margin-top:"), "half the correction goes above the mask");
  assert.ok(rule.includes("margin-bottom:"), "half the correction goes below the mask");
  assert.ok(rule.includes("/ 2"), "the correction is split, not applied twice");
});
