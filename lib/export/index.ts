import { presetJson } from "@/lib/presets/schema";
import { slugify } from "@/lib/project";
import { standaloneHtml, reactComponent } from "@/lib/export/documents";
import { buildExportModel, type ExportModel } from "@/lib/export/model";
import { timelineSource } from "@/lib/export/timeline";
import type { ProjectState } from "@/lib/types";

export type { ExportModel, LayerModel } from "@/lib/export/model";
export { buildExportModel, estimatedDuration } from "@/lib/export/model";
export { GSAP_CDN_VERSION } from "@/lib/export/runtime";
export { SPLIT_PRIMITIVES_CSS, scopeVars, layerVars } from "@/lib/export/css";
export { standaloneHtml, reactComponent } from "@/lib/export/documents";
export { timelineSource, layerTimelineSource } from "@/lib/export/timeline";
export { presetJson, parsePreset, PresetError } from "@/lib/presets/schema";
export { slugify } from "@/lib/project";

/** The code exports, keyed the way the export panel groups them. */
export type CodeExportKind = "html" | "react" | "preset" | "timeline";

export type GeneratedFile = {
  name: string;
  mime: string;
  body: string;
  label: string;
};

export function generate(
  kind: CodeExportKind,
  project: ProjectState,
  model: ExportModel = buildExportModel(project),
): GeneratedFile {
  const stem = slugify(model.layers[0]?.layer.text || project.name);

  switch (kind) {
    case "html":
      return {
        name: `${stem}.html`,
        mime: "text/html",
        body: standaloneHtml(model),
        label: "Standalone page",
      };
    case "react":
      return {
        name: `${stem}.tsx`,
        mime: "text/plain",
        body: reactComponent(model),
        label: "React component",
      };
    case "preset":
      return {
        name: `${stem}.preset.json`,
        mime: "application/json",
        body: presetJson(project),
        label: "Preset",
      };
    case "timeline":
      return {
        name: `${stem}.timeline.js`,
        mime: "text/javascript",
        body: timelineSource(model),
        label: "GSAP timeline",
      };
  }
}

export function downloadFile(filename: string, content: string | Blob, mime?: string): void {
  const blob =
    content instanceof Blob
      ? content
      : new Blob([content], { type: `${mime ?? "text/plain"};charset=utf-8` });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
