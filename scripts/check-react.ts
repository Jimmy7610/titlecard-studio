/**
 * Type-checks the generated React component.
 *
 * The React export is a `.tsx` file that lands in someone else's strict
 * TypeScript project, and "it is a valid string" is not the bar — it has to
 * compile. This writes real components into the project tree, runs the
 * project's own `tsc` over them, and cleans up.
 *
 * The bug this exists to prevent: the emitted runtime prelude is JavaScript,
 * so every `function rng(seed)` in it was an implicit-any error the moment it
 * was pasted into a strict project. It ran fine and would not build.
 *
 *   npm run check:react
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { buildExportModel, reactComponent } from "../lib/export";
import { DEFAULT_PROJECT } from "../lib/project";
import { TEMPLATES } from "../lib/templates";
import type { ProjectState, WordStyle } from "../lib/types";

const DIR = ".react-check";

/** The pinned `tsc` entry point, so the check cannot drift with the registry. */
const TSC = createRequire(import.meta.url).resolve("typescript/bin/tsc");

/**
 * Word styling on every third template: it is the branch that emits baked
 * offset arrays and inline style objects, so it needs type-checking too.
 */
function styledWord(index: number): Record<number, WordStyle> {
  return index % 3 === 0 ? { 0: { gradient: true, delay: 0.2, scale: 1.2 } } : {};
}

const projects: ProjectState[] = TEMPLATES.map((template, index) => ({
  ...DEFAULT_PROJECT,
  layers: [
    {
      ...DEFAULT_PROJECT.layers[0],
      text: index % 2 === 0 ? "Agent 3" : "RÄKSMÖRGÅS ✨",
      templateId: template.id,
      // Exercise the per-word branch on a few of them: word styling emits
      // baked offset arrays and inline styles the type checker has to accept.
      wordStyles: styledWord(index),
    },
  ],
}));

// A multi-layer project emits more than one builder function in one file.
projects.push({
  ...DEFAULT_PROJECT,
  layers: [
    { ...DEFAULT_PROJECT.layers[0], id: "a", text: "WHAT IF", templateId: "fade-up" },
    {
      ...DEFAULT_PROJECT.layers[0],
      id: "b",
      text: "AI COULD BUILD",
      templateId: "glyph-decode",
      delay: 1.1,
    },
  ],
});

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

try {
  projects.forEach((project, index) => {
    const source = reactComponent(buildExportModel(project));
    writeFileSync(join(DIR, `Generated${index}.tsx`), source, "utf8");
  });

  // The project's own pinned compiler, resolved from node_modules rather than
  // whatever `npx` would fetch. `npm ci` has to be enough to run every check.
  execFileSync(process.execPath, [TSC, "--noEmit"], { stdio: "pipe" });
  console.log(`All ${projects.length} generated React components type-check.`);
} catch (error) {
  const output = error instanceof Error && "stdout" in error ? String((error as { stdout: Buffer }).stdout) : String(error);
  console.error("\nGenerated React components failed to type-check:\n");
  console.error(output);
  process.exitCode = 1;
} finally {
  rmSync(DIR, { recursive: true, force: true });
}
