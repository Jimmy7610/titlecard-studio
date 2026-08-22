/**
 * Writes real export artifacts to disk so they can be opened and run.
 *
 * `check-exports.ts` proves the generated source parses; this produces files a
 * human (or a browser) can actually load, which is the only way to catch a
 * document that parses fine and renders nothing.
 *
 *   npx tsx scripts/emit-samples.ts <outDir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildExportModel, reactComponent, standaloneHtml, timelineSource } from "../lib/export";
import { presetJson } from "../lib/presets/schema";
import { DEFAULT_PROJECT } from "../lib/project";
import type { ProjectState } from "../lib/types";

const outDir = process.argv[2] ?? "public/__samples";
mkdirSync(outDir, { recursive: true });

const SAMPLES: { name: string; project: ProjectState }[] = [
  {
    name: "agent",
    project: {
      ...DEFAULT_PROJECT,
      layers: [{ ...DEFAULT_PROJECT.layers[0], text: "Agent 3", templateId: "agent-reveal" }],
    },
  },
  {
    name: "swedish",
    project: {
      ...DEFAULT_PROJECT,
      paletteId: "ice",
      invertCanvas: true,
      typography: { ...DEFAULT_PROJECT.typography, transform: "uppercase", tracking: 0.06 },
      layers: [
        { ...DEFAULT_PROJECT.layers[0], text: "RÄKSMÖRGÅS ✨", templateId: "film-title" },
      ],
    },
  },
  {
    name: "decode",
    project: {
      ...DEFAULT_PROJECT,
      paletteId: "terminal",
      invertCanvas: true,
      layers: [
        { ...DEFAULT_PROJECT.layers[0], text: "SYSTEM BOOT", templateId: "glyph-decode" },
      ],
    },
  },
  {
    name: "layers",
    project: {
      ...DEFAULT_PROJECT,
      layers: [
        { ...DEFAULT_PROJECT.layers[0], id: "a", text: "WHAT IF", templateId: "fade-up",
          position: { anchor: "center", x: 0, y: -14 } },
        { ...DEFAULT_PROJECT.layers[0], id: "b", text: "AI COULD BUILD", templateId: "punch-words",
          delay: 1.1, position: { anchor: "center", x: 0, y: 6 },
          wordStyles: { 1: { gradient: true, scale: 1.2 } } },
      ],
      activeLayerId: "a",
    },
  },
  {
    // The case the underline rule exists for: descenders on the last line, a
    // face whose metrics differ from the reference one, and tight leading.
    name: "descenders",
    project: {
      ...DEFAULT_PROJECT,
      typography: {
        ...DEFAULT_PROJECT.typography,
        fontId: "playfair",
        weight: 500,
        leading: 1.4,
        tracking: 0.04,
        fontSize: 8,
      },
      layers: [
        {
          ...DEFAULT_PROJECT.layers[0],
          text: `Elegant
typography gyjpq`,
          templateId: "editorial-reveal",
        },
      ],
    },
  },
  {
    // The caret has to sit at the end of the phrase, on the same baseline.
    name: "terminal",
    project: {
      ...DEFAULT_PROJECT,
      paletteId: "terminal",
      invertCanvas: true,
      layers: [{ ...DEFAULT_PROJECT.layers[0], text: "Boot gyjpq", templateId: "terminal-type" }],
    },
  },
  {
    name: "wordstyles",
    project: {
      ...DEFAULT_PROJECT,
      color: { ...DEFAULT_PROJECT.color, glow: 0.12, glowColor: "#f2560a" },
      layers: [
        {
          ...DEFAULT_PROJECT.layers[0],
          text: "BUILD SOMETHING IMPOSSIBLE",
          templateId: "editorial-reveal",
          wordStyles: { 2: { gradient: true, scale: 1.15, delay: 0.3, emphasis: "pop" } },
        },
      ],
    },
  },
];

const index: string[] = [];

for (const sample of SAMPLES) {
  const model = buildExportModel(sample.project);
  writeFileSync(join(outDir, `${sample.name}.html`), standaloneHtml(model), "utf8");
  writeFileSync(join(outDir, `${sample.name}.tsx`), reactComponent(model), "utf8");
  writeFileSync(join(outDir, `${sample.name}.timeline.js`), timelineSource(model), "utf8");
  writeFileSync(join(outDir, `${sample.name}.preset.json`), presetJson(sample.project), "utf8");
  index.push(sample.name);
}

writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Samples</title>
<body style="font:14px system-ui;padding:2rem;background:#111;color:#eee">
<h1>Export samples</h1>
<ul>${index.map((name) => `<li><a style="color:#f90" href="./${name}.html">${name}.html</a></li>`).join("")}</ul>
</body>`,
  "utf8",
);

console.log(`Wrote ${index.length} sample sets to ${outDir}`);