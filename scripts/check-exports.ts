/**
 * Codegen smoke test.
 *
 * The output of the export module is the product, and nothing in the type
 * system checks it — the generated files are strings. This asserts that every
 * template x every export kind actually holds together.
 *
 * The bug this exists to prevent: the React export once omitted the runtime
 * prelude entirely, so every generated component referenced ~17 undefined
 * identifiers and could not run. It type-checked and shipped, because a string
 * containing broken JavaScript is still a valid string.
 *
 *   npm run check:exports
 */
import { readFileSync } from "node:fs";

import {
  GSAP_CDN_VERSION,
  buildExportModel,
  reactComponent,
  standaloneHtml,
  timelineSource,
} from "../lib/export";
import {
  parseProjectFile,
  parseStylePreset,
  projectFileJson,
  stylePresetFromProject,
  stylePresetJson,
} from "../lib/persistence";
import { DEFAULT_PROJECT } from "../lib/project";
import { TEMPLATES } from "../lib/templates";
import type { ProjectState } from "../lib/types";

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
  "const SUN =",
  "const CANVAS =",
  "const GRADIENT =",
  "const POOL =",
  "const units =",
  "const chars =",
  "const glyphs =",
  "const reals =",
  "const plain =",
  "const gradient =",
  "const words =",
  "const wordEls =",
  "const flashes =",
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

function projectWith(templateId: string, text: string): ProjectState {
  return {
    ...DEFAULT_PROJECT,
    layers: [
      {
        ...DEFAULT_PROJECT.layers[0],
        text,
        templateId: templateId as ProjectState["layers"][number]["templateId"],
      },
    ],
  };
}

/**
 * Phrases chosen to exercise the branches that only exist for some input:
 * trailing digits (the gradient tail), no digits at all, and a grapheme that
 * `Array.from` would tear in half.
 */
const PHRASES = ["Agent 3", "Ship faster", "RÄKSMÖRGÅS ✨"];

for (const template of TEMPLATES) {
  for (const phrase of PHRASES) {
    const project = projectWith(template.id, phrase);
    const model = buildExportModel(project);

    const artifacts = {
      timeline: timelineSource(model),
      html: standaloneHtml(model),
      react: reactComponent(model),
    };

    for (const [kind, source] of Object.entries(artifacts)) {
      const tag = `${template.id}/${kind}/"${phrase}"`;

      for (const binding of PRELUDE_BINDINGS) {
        check(`${tag}: missing prelude binding`, source.includes(binding), binding);
      }

      check(`${tag}: missing epilogue`, source.includes("stwReady"));
      check(`${tag}: no layer builder`, source.includes("function buildLayer0("));
      check(`${tag}: no master timeline`, source.includes("const master = gsap.timeline("));
      check(
        `${tag}: leaks Tailwind-only .sr-only`,
        !/["' ]sr-only["' ]/.test(source),
        "exports must ship .stw-sr",
      );
      check(`${tag}: sizes against the viewport instead of the container`, !source.includes("vw,"));
      check(
        `${tag}: component root must not force full-page layout`,
        kind !== "react" || !source.includes('className="stw-scope stw-stage"'),
      );
      check(
        `${tag}: the phrase never reached the markup`,
        kind === "timeline" || source.includes(phrase.split(" ")[0].slice(0, 4)),
      );
    }

    // The runnable body must parse. `new Function` catches the syntax errors
    // that string concatenation introduces at the seams.
    const script = artifacts.html.match(/<script>([\s\S]*?)<\/script>/g)?.pop() ?? "";
    const body = script.replace(/<\/?script>/g, "");
    try {
      new Function("gsap", "CustomEase", "document", "window", body);
    } catch (error) {
      check(`${template.id}/html: generated JS does not parse`, false, String(error));
    }

    // Round-trip: a project file must survive being written and read back.
    const reopened = parseProjectFile(projectFileJson(project)).project;
    check(
      `${template.id}/project: template lost in round-trip`,
      reopened.layers[0].templateId === template.id,
      `${reopened.layers[0].templateId}`,
    );
    check(
      `${template.id}/project: phrase lost in round-trip`,
      reopened.layers[0].text === phrase,
      `${reopened.layers[0].text}`,
    );

    // A look must carry the style and none of the words.
    const look = stylePresetJson(stylePresetFromProject(project, "look"));
    check(
      `${template.id}/look: template lost in round-trip`,
      parseStylePreset(look).preset.templateId === template.id,
    );
    check(
      `${template.id}/look: leaked the phrase`,
      !look.includes(phrase.split(" ")[0]),
      "a style preset must not carry text",
    );
  }
}

/* ------------------------------------------------------------------ *
 * Preset migration and robustness
 * ------------------------------------------------------------------ */

const V1_PRESET = JSON.stringify({
  $schema: "semantic-text-animator/preset@1",
  phrase: "Agent 3",
  template: "agent-reveal",
  palette: "terminal",
  glyphPool: "binary",
  motion: { speed: 1.4, stagger: 0.02, loop: false },
  type: { fontSize: 9, tracking: 0.1, leading: 1.4, weight: 700 },
  canvas: "dark",
});

const migrated = parseProjectFile(V1_PRESET);
check("v1 migration: template", migrated.project.layers[0].templateId === "agent-reveal");
check("v1 migration: palette", migrated.project.paletteId === "terminal");
check("v1 migration: dark canvas", migrated.project.invertCanvas === true);
check("v1 migration: speed", migrated.project.motion.speed === 1.4);
check("v1 migration: weight", migrated.project.typography.weight === 700);
check("v1 migration: phrase kept", migrated.project.layers[0].text === "Agent 3");
check("v1 migration: reports the upgrade", migrated.warnings.length > 0);
check("v1 look: phrase offered separately", parseStylePreset(V1_PRESET).texts[0] === "Agent 3");

for (const [label, raw] of [
  ["unknown template", '{"schemaVersion":3,"layers":[{"templateId":"nope","text":"hi"}]}'],
  ["missing sections", '{"schemaVersion":3}'],
  ["future schema", '{"schemaVersion":99,"layers":[{"text":"hi"}]}'],
  ["v2 shape", '{"schemaVersion":2,"text":{"layers":[{"text":"hi"}]},"layers":[{"text":"hi"}]}'],
  ["hostile colour", '{"schemaVersion":3,"color":{"mode":"custom","text":"red;} body{display:none"}}'],
] as const) {
  try {
    const parsed = parseProjectFile(raw);
    check(`malformed project (${label}) still yields a project`, parsed.project.layers.length > 0);
  } catch (error) {
    check(`malformed project (${label}) must not throw`, false, String(error));
  }
}

check(
  "hostile colour is rejected rather than sanitised",
  !parseProjectFile(
    '{"schemaVersion":3,"color":{"mode":"custom","text":"red;} body{display:none"}}',
  ).project.color.text.includes("}"),
);

for (const raw of ["not json at all", "[1,2,3]"]) {
  for (const [label, parse] of [
    ["project", parseProjectFile],
    ["look", parseStylePreset],
  ] as const) {
    let threw = false;
    try {
      parse(raw);
    } catch {
      threw = true;
    }
    check(`invalid ${label} input "${raw}" must be reported`, threw);
  }
}

/* ------------------------------------------------------------------ *
 * Multi-layer
 * ------------------------------------------------------------------ */

const multi: ProjectState = {
  ...DEFAULT_PROJECT,
  layers: [
    { ...DEFAULT_PROJECT.layers[0], id: "a", text: "WHAT IF", templateId: "fade-up" },
    {
      ...DEFAULT_PROJECT.layers[0],
      id: "b",
      text: "AI COULD BUILD",
      templateId: "glyph-decode",
      delay: 1.2,
      position: { anchor: "bottom", x: 0, y: -10 },
    },
  ],
};

const multiModel = buildExportModel(multi);
const multiHtml = standaloneHtml(multiModel);
check("multi-layer: both builders emitted", multiHtml.includes("function buildLayer1("));
check("multi-layer: second layer is offset", multiHtml.includes("), 1.200)"));
check("multi-layer: both markup blocks emitted", multiHtml.includes('data-stw-layer="1"'));

const multiScript = multiHtml.match(/<script>([\s\S]*?)<\/script>/g)?.pop() ?? "";
try {
  new Function("gsap", "CustomEase", "document", "window", multiScript.replace(/<\/?script>/g, ""));
} catch (error) {
  check("multi-layer: generated JS does not parse", false, String(error));
}

if (failures.length) {
  console.error(`\n${failures.length} export check(s) failed:\n`);
  for (const failure of [...new Set(failures)]) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `All export checks passed (${TEMPLATES.length} templates x 3 kinds x ${PHRASES.length} phrases, plus preset migration and multi-layer).`,
);
