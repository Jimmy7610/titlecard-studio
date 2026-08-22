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
import { downloadFile, generate } from "@/lib/export";
import { getPalette, gradientOf } from "@/lib/palettes";
import { BUILTIN_PRESETS, applyPreset } from "@/lib/presets/builtin";
import { PresetError, parsePreset } from "@/lib/presets/schema";
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

  const handleImport = async (file: File | undefined) => {
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = parsePreset(raw);

      update(
        (previous) => ({
          ...parsed.project,
          // The imported look, wrapped around the phrases already on screen.
          layers: previous.layers.map((layer, index) => ({
            ...layer,
            templateId: parsed.project.layers[index]?.templateId ?? layer.templateId,
            glyphPool: parsed.project.layers[index]?.glyphPool ?? layer.glyphPool,
            delay: parsed.project.layers[index]?.delay ?? layer.delay,
            position: parsed.project.layers[index]?.position ?? layer.position,
            typography: parsed.project.layers[index]?.typography ?? layer.typography,
            wordStyles: parsed.project.layers[index]?.wordStyles ?? layer.wordStyles,
          })),
          activeLayerId: previous.activeLayerId,
        }),
        { tag: "import" },
      );

      const carriesText = parsed.texts.some((text) => text.trim().length > 0);
      setOfferedTexts(carriesText ? parsed.texts : null);

      toast.success(`Imported "${parsed.name}"`, {
        description: parsed.warnings.length
          ? parsed.warnings[0]
          : "Your text was kept — only the look changed.",
      });
      for (const warning of parsed.warnings.slice(1)) toast.warning(warning);
    } catch (error) {
      toast.error("Could not read that preset", {
        description:
          error instanceof PresetError ? error.message : "The file could not be opened.",
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

  const handleSave = () => {
    const label = name.trim() || `${getTemplate(activeTemplateId).name} look`;
    setSaved(savePreset(label, project));
    setName("");
    toast.success(`Saved "${label}"`, { description: "Stored in this browser." });
  };

  const applySaved = (preset: SavedPreset) => {
    try {
      const parsed = readSavedPreset(preset);
      update(
        (previous) => ({
          ...parsed.project,
          layers: previous.layers.map((layer, index) => ({
            ...layer,
            templateId: parsed.project.layers[index]?.templateId ?? layer.templateId,
            glyphPool: parsed.project.layers[index]?.glyphPool ?? layer.glyphPool,
            wordStyles: parsed.project.layers[index]?.wordStyles ?? layer.wordStyles,
          })),
          activeLayerId: previous.activeLayerId,
        }),
        { tag: `saved-${preset.id}` },
      );
      toast.success(`Applied "${preset.name}"`);
    } catch {
      toast.error("That saved preset could not be read", {
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
      <section className="space-y-2 border-t border-border pt-4">
        <SectionLabel>Files</SectionLabel>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => void handleImport(event.target.files?.[0])}
        />

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const file = generate("preset", project);
              downloadFile(file.name, file.body, file.mime);
              toast.success("Preset exported", { description: file.name });
            }}
          >
            <DownloadIcon data-icon="inline-start" />
            Export JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
          >
            <UploadIcon data-icon="inline-start" />
            Import JSON
          </Button>
        </div>

        {offeredTexts ? (
          <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-2.5">
            <p className="text-[0.7rem] leading-relaxed">
              That preset also carried text:{" "}
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
          Presets are versioned. Files written by version 1 of this app are migrated on
          import rather than rejected, and a field from a newer build is ignored instead of
          throwing.
        </InfoNote>
      </section>

    </div>
  );
}
