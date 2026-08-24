"use client";

import * as React from "react";
import {
  CopyIcon,
  DownloadIcon,
  PencilIcon,
  SaveIcon,
  TrashIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { InfoNote, SectionLabel } from "@/components/editor/controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientState } from "@/hooks/use-client-value";
import type { ProjectController } from "@/hooks/use-project";
import { downloadFile } from "@/lib/export";
import { getPalette, gradientOf } from "@/lib/palettes";
import { BUILTIN_PRESETS, applyPreset } from "@/lib/presets/builtin";
import {
  PersistenceError,
  applyStylePreset,
  looksLikeProject,
  parseProjectFile,
  parseStylePreset,
  projectFileJson,
  projectFileName,
  stylePresetFromProject,
  stylePresetJson,
  STYLE_PRESET_EXTENSION,
} from "@/lib/persistence";
import {
  deletePreset,
  duplicatePreset,
  listSavedPresets,
  readSavedPreset,
  renamePreset,
  savePreset,
  type SavedPreset,
} from "@/lib/storage";
import { getTemplate } from "@/lib/templates";

/**
 * Presets.
 *
 * The rule that shapes every path in here: applying a preset changes the look
 * and never the words. A file that carries a phrase says so and offers it as a
 * separate, explicit action.
 */
/** Stable empty array — a fresh literal would re-render on every pass. */
const EMPTY_SAVED: SavedPreset[] = [];

export function PresetsPanel({ controller }: { controller: ProjectController }) {
  const { project, update } = controller;
  const [saved, setSaved] = useClientState<SavedPreset[]>(listSavedPresets, EMPTY_SAVED);
  const [name, setName] = React.useState("");
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [offeredTexts, setOfferedTexts] = React.useState<string[] | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const activeTemplateId = controller.layer.templateId;

  /**
   * Opens a project file: the whole document, replacing what was on screen.
   *
   * The confirmation is the difference between the two formats made visible. A
   * look is additive and needs no permission; a project is a replacement and
   * does.
   */
  const openProject = async (file: File) => {
    const raw = await file.text();
    const parsed = parseProjectFile(raw);

    const layerCount = parsed.project.layers.length;
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        `Open "${parsed.project.name}"? It has ${layerCount} layer${layerCount === 1 ? "" : "s"} and will replace what is on the canvas.`,
      );
    if (!confirmed) return;

    update(() => parsed.project, { tag: "open-project" });
    setOfferedTexts(null);
    toast.success(`Opened "${parsed.project.name}"`, {
      description: parsed.warnings[0] ?? "The whole project was restored.",
    });
    for (const warning of parsed.warnings.slice(1)) toast.warning(warning);
  };

  /** Applies a look, leaving every word and the canvas exactly where they are. */
  const importLook = async (file: File) => {
    const raw = await file.text();
    const parsed = parseStylePreset(raw);

    update((previous) => applyStylePreset(previous, parsed.preset), { tag: "import" });

    const carriesText = parsed.texts.some((text) => text.trim().length > 0);
    setOfferedTexts(carriesText ? parsed.texts : null);

    toast.success(`Applied "${parsed.preset.name}"`, {
      description: parsed.warnings[0] ?? "Your text and canvas were kept.",
    });
    for (const warning of parsed.warnings.slice(1)) toast.warning(warning);
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;

    try {
      const raw = await file.text();
      // One file input, two formats. The file says which it is; guessing from
      // the extension would misread a renamed download.
      const parsed: unknown = JSON.parse(raw);
      const isProject =
        typeof parsed === "object" && parsed !== null && looksLikeProject(parsed as never);

      if (isProject) await openProject(file);
      else await importLook(file);
    } catch (error) {
      toast.error("Could not read that file", {
        description:
          error instanceof PersistenceError ? error.message : "The file could not be opened.",
      });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const acceptOfferedText = () => {
    if (!offeredTexts) return;
    update(
      (previous) => ({
        ...previous,
        layers: previous.layers.map((layer, index) =>
          offeredTexts[index] !== undefined ? { ...layer, text: offeredTexts[index] } : layer,
        ),
      }),
      { tag: "import-text" },
    );
    setOfferedTexts(null);
  };

  // The offer lives in the Files section; a saved preset can raise it too.
  const offerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (offeredTexts) offerRef.current?.scrollIntoView({ block: "nearest" });
  }, [offeredTexts]);

  const handleSave = () => {
    const label = name.trim() || `${getTemplate(activeTemplateId).name} look`;
    setSaved(savePreset(label, stylePresetFromProject(project, label)));
    setName("");
    toast.success(`Saved "${label}"`, {
      description: "The look only — your words stay where they are.",
    });
  };

  const applySaved = (preset: SavedPreset) => {
    try {
      const parsed = readSavedPreset(preset);
      update((previous) => applyStylePreset(previous, parsed.preset), {
        tag: `saved-${preset.id}`,
      });
      // A look saved in an older build may still carry the phrase it was saved
      // with. It is offered, never applied.
      const carriesText = parsed.texts.some((text) => text.trim().length > 0);
      setOfferedTexts(carriesText ? parsed.texts : null);

      toast.success(`Applied "${preset.name}"`, {
        description: carriesText ? "Its text is offered below." : "Your words were kept.",
      });
    } catch {
      toast.error("That saved look could not be read", {
        description: "It may have been written by an incompatible build.",
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------ Built in */}
      <section className="space-y-2">
        <div className="space-y-0.5">
          <SectionLabel>Looks</SectionLabel>
          <p className="text-[0.7rem] text-muted-foreground/70">
            Motion, palette, face, tempo and background. Your text stays.
          </p>
        </div>

        <div className="grid gap-1.5">
          {BUILTIN_PRESETS.map((preset) => {
            const palette = getPalette(preset.paletteId);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  update((previous) => applyPreset(previous, preset), {
                    tag: `preset-${preset.id}`,
                  });
                  toast.success(`Applied ${preset.name}`);
                }}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-card/40 px-2.5 py-2 text-left transition-colors outline-none hover:bg-card/70 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className="size-7 shrink-0 rounded-md ring-1 ring-white/10"
                  style={{
                    backgroundImage: gradientOf(palette),
                    outline: `2px solid ${preset.invertCanvas ? palette.dark.bg : palette.light.bg}`,
                    outlineOffset: -2,
                  }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{preset.name}</span>
                  <span className="block truncate text-[0.65rem] text-muted-foreground">
                    {preset.note}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* -------------------------------------------------------- Saved */}
      <section className="space-y-2 border-t border-border pt-4">
        <SectionLabel>Your presets</SectionLabel>

        <div className="flex gap-1.5">
          <Input
            value={name}
            placeholder="Name this look"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSave();
            }}
            className="h-8 text-xs"
          />
          <Button type="button" size="sm" onClick={handleSave}>
            <SaveIcon data-icon="inline-start" />
            Save
          </Button>
        </div>

        {saved.length === 0 ? (
          <InfoNote>
            Nothing saved yet. A saved preset keeps the palette, typography, motion,
            background and canvas — and the phrase, so you can reopen a finished piece.
          </InfoNote>
        ) : (
          <ul className="space-y-1">
            {saved.map((preset) => (
              <li
                key={preset.id}
                className="flex items-center gap-1 rounded-lg border border-border bg-card/40 px-2 py-1.5"
              >
                {renaming === preset.id ? (
                  <Input
                    autoFocus
                    value={renameDraft}
                    // Renaming usually means replacing, not appending.
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onBlur={() => {
                      setSaved(renamePreset(preset.id, renameDraft));
                      setRenaming(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") setRenaming(null);
                    }}
                    className="h-6 flex-1 text-xs"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => applySaved(preset)}
                    className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-xs outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {preset.name}
                  </button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Rename ${preset.name}`}
                  onClick={() => {
                    setRenaming(preset.id);
                    setRenameDraft(preset.name);
                  }}
                >
                  <PencilIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Duplicate ${preset.name}`}
                  onClick={() => setSaved(duplicatePreset(preset.id))}
                >
                  <CopyIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete ${preset.name}`}
                  onClick={() => {
                    setSaved(deletePreset(preset.id));
                    toast.success(`Deleted "${preset.name}"`);
                  }}
                >
                  <TrashIcon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------- Files */}
      <section className="space-y-3 border-t border-border pt-4">
        <div className="space-y-0.5">
          <SectionLabel>Files</SectionLabel>
          <p className="text-[0.7rem] text-muted-foreground/70">
            A project is the whole document. A look is only the style.
          </p>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => void handleImport(event.target.files?.[0])}
        />

        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                downloadFile(
                  projectFileName(project),
                  projectFileJson(project),
                  "application/json",
                );
                toast.success("Project saved", { description: projectFileName(project) });
              }}
            >
              <DownloadIcon data-icon="inline-start" />
              Save project
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInput.current?.click()}
            >
              <UploadIcon data-icon="inline-start" />
              Open file
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              const label = project.name || "Untitled";
              downloadFile(
                `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "look"}${STYLE_PRESET_EXTENSION}`,
                stylePresetJson(stylePresetFromProject(project, label)),
                "application/json",
              );
              toast.success("Look exported", { description: "Style only, no text." });
            }}
          >
            <DownloadIcon data-icon="inline-start" />
            Export this look
          </Button>
        </div>

        {offeredTexts ? (
          <div
            ref={offerRef}
            className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-2.5"
          >
            <p className="text-[0.7rem] leading-relaxed">
              That look also carried text:{" "}
              <span className="font-medium text-foreground">
                {offeredTexts.filter(Boolean).join(" / ")}
              </span>
            </p>
            <div className="flex gap-1.5">
              <Button type="button" size="xs" onClick={acceptOfferedText}>
                Use its text too
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => setOfferedTexts(null)}
              >
                Keep mine
              </Button>
            </div>
          </div>
        ) : null}

        <InfoNote>
          <strong className="font-medium text-foreground">Save project</strong> writes every
          layer, phrase, position and word style as{" "}
          <code className="font-mono">.titlecard.json</code>. Opening one replaces the canvas.{" "}
          <strong className="font-medium text-foreground">Export this look</strong> writes the
          palette, type, motion and background only — applying it to someone else&apos;s work
          cannot take their words away. Both formats read files written by versions 1 and 2.
        </InfoNote>
      </section>

    </div>
  );
}
