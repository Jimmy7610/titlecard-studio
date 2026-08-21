/**
 * Codegen smoke test.
 *
 * The output of lib/export.ts is the product, and nothing in the type system
 * checks it — the generated files are strings. This asserts that every
 * template x every export kind actually holds together.
 *
 * The bug this exists to prevent: the React export once omitted the runtime
 * prelude entirely, so every generated component referenced ~17 undefined
 * identifiers and could not run. It type-checked and shipped, because a string
 * containing broken JavaScript is still a valid string.
 *
 *   npx --yes tsx scripts/check-exports.ts
 */
import { readFileSync } from "node:fs";

import {
  GSAP_CDN_VERSION,
  presetJson,
  reactComponent,
  standaloneHtml,
  timelineSource,
} from "../lib/export";
import { DEFAULT_SETTINGS } from "../lib/settings";
import { TEMPLATES, type TemplateId } from "../lib/templates";

const failures: string[] = [];
const check = (label: string, condition: boolean, detail = "") => {
  if (!condition) failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

/** Identifiers the prelude declares that every timeline body relies on. */
const PRELUDE_BINDINGS = [
  "const SPEED =",
  "const STAGGER =",
  "const INK =",
  "const HOT =",
  "const WARM =",
  "const CANVAS =",
  "const POOL =",
  "const units =",
  "const chars =",
  "const glyphs =",
  "const reals =",
  "const plain =",
  "const gradient =",
  "const words =",
  "const underline =",
  "const cursor =",
  "const debris =",
  "function rng(",
  "function glyphSequence(",
  "const tl = gsap.timeline(",
];

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
check(
  "GSAP CDN version drift",
  pkg.dependencies.gsap.replace(/^[^\d]*/, "") === GSAP_CDN_VERSION,
  `package.json ${pkg.dependencies.gsap} vs export ${GSAP_CDN_VERSION}`,
);

for (const template of TEMPLATES) {
  const templateId: TemplateId = template.id;

  // A phrase with no trailing digits: the gradient branch must not be the only
  // thing holding a template together.
  for (const phrase of ["Agent 3", "Ship faster"]) {
    const resolved = { settings: { ...DEFAULT_SETTINGS, text: phrase }, templateId, phrase };

    const artifacts = {
      timeline: timelineSource(resolved),
      html: standaloneHtml(resolved),
      react: reactComponent(resolved),
    };

    for (const [kind, source] of Object.entries(artifacts)) {
      const tag = `${templateId}/${kind}/"${phrase}"`;

      for (const binding of PRELUDE_BINDINGS) {
        check(`${tag}: missing prelude binding`, source.includes(binding), binding);
      }

      check(`${tag}: missing epilogue`, source.includes("stwReady"));
      check(
        `${tag}: leaks Tailwind-only .sr-only`,
        !/["' ]sr-only["' ]/.test(source),
        "exports must ship .stw-sr",
      );
      check(`${tag}: sizes against vw instead of the container`, !source.includes("vw,"));
      check(`${tag}: component root must not force full-page layout`,
        kind !== "react" || !source.includes('className="stw-scope stw-stage"'));
    }

    // The runnable bodies must parse. `new Function` catches syntax errors that
    // string concatenation introduces at the seams.
    const script = artifacts.html.match(/<script>([\s\S]*?)<\/script>/g)?.pop() ?? "";
    const body = script.replace(/<\/?script>/g, "");
    try {
      new Function("gsap", "CustomEase", "document", "window", body);
    } catch (error) {
      check(`${templateId}/html: generated JS does not parse`, false, String(error));
    }

    JSON.parse(presetJson(resolved));
  }
}

if (failures.length) {
  console.error(`\n${failures.length} export check(s) failed:\n`);
  for (const failure of [...new Set(failures)]) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`All export checks passed (${TEMPLATES.length} templates x 3 kinds x 2 phrases).`);
