"use client";

import * as React from "react";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ItalicIcon,
  TrashIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Field,
  InfoNote,
  SectionLabel,
  SegmentedControl,
  SliderField,
} from "@/components/editor/controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientState } from "@/hooks/use-client-value";
import type { ProjectController } from "@/hooks/use-project";
import {
  FONTS,
  FontLoadError,
  SUPPORTED_FONT_EXTENSIONS,
  addCustomFont,
  guessVariantFromFilename,
  hasCustomVariant,
  isSessionOnly,
  listCustomFamilies,
  loadFontRequest,
  nearestWeight,
  removeCustomFamily,
  removeCustomVariant,
  resolveFont,
  type CustomFontFamily,
} from "@/lib/fonts";
import { RANGES } from "@/lib/project";
import { GRANULARITIES } from "@/lib/segment";
import type { Granularity } from "@/lib/segment";
import type { TextAlign, TextTransform } from "@/lib/types";

/** Stable empty array — a fresh literal would re-render on every pass. */
const EMPTY_FONTS: CustomFontFamily[] = [];

const UPLOAD_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

const variantLabel = (weight: number, italic: boolean) =>
  `${weight}${italic ? " italic" : ""}`;

const CATEGORY_LABEL: Record<string, string> = {
  sans: "Sans",
  display: "Display",
  serif: "Serif",
  mono: "Mono",
};

export function TypographyPanel({ controller }: { controller: ProjectController }) {
  const { project, update } = controller;
  const typography = project.typography;
  const [custom, setCustom] = useClientState<CustomFontFamily[]>(listCustomFamilies, EMPTY_FONTS);
  const [busy, setBusy] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);
  /**
   * What the next upload will be filed as.
   *
   * A font file does not say which weight it holds without parsing the binary,
   * and a parser is a large dependency to carry for a guess. The filename is
   * read for a default and the user confirms it, which is honest and costs one
   * small form.
   */
  const [pending, setPending] = React.useState<{
    file: File;
    name: string;
    weight: number;
    italic: boolean;
  } | null>(null);

  const font = resolveFont(typography.fontId);

  const setTypography = (patch: Partial<typeof typography>, tag: string) =>
    update({ typography: { ...typography, ...patch } }, { tag });

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setPending({ file, ...guessVariantFromFilename(file.name) });
    if (fileInput.current) fileInput.current.value = "";
  };

  const confirmUpload = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const added = await addCustomFont(pending.file, {
        name: pending.name,
        weight: pending.weight,
        italic: pending.italic,
      });
      const families = listCustomFamilies();
      setCustom(families);
      setPending(null);
      setTypography(
        {
          fontId: added.familyId,
          weight: added.weight,
          italic: added.italic,
        },
        "typography.font",
      );
      toast.success(`Loaded ${added.name} ${variantLabel(added.weight, added.italic)}`, {
        description: isSessionOnly(added)
          ? "Too large to keep between sessions — it will need re-uploading."
          : "Embedded in standalone HTML exports.",
      });
    } catch (error) {
      toast.error("Could not load that font", {
        description:
          error instanceof FontLoadError ? error.message : "The file could not be read.",
      });
    } finally {
      setBusy(false);
    }
  };

  const fontItems = React.useMemo(
    () => [
      ...FONTS.map((entry) => ({ value: entry.id, label: entry.name })),
      ...custom.map((entry) => ({ value: entry.familyId, label: entry.name })),
    ],
    [custom],
  );

  const weights = font.weights;

  return (
    <div className="space-y-5">
      <Field label="Typeface" htmlFor="font">
        <Select
          items={fontItems}
          value={typography.fontId}
          onValueChange={(value) => {
            const id = String(value);
            const next = resolveFont(id);
            const weight = nearestWeight(next.weights, typography.weight);
            // A face with no italic must not leave the project asking for one.
            const italic = typography.italic && next.italic;
            void loadFontRequest({ fontId: id, weight, italic });
            setTypography({ fontId: id, weight, italic }, "typography.font");
          }}
        >
          <SelectTrigger id="font" className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONTS.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                <span className="flex flex-col gap-0.5 py-0.5">
                  <span className="text-sm">{entry.name}</span>
                  <span className="text-[0.7rem] text-muted-foreground">
                    {CATEGORY_LABEL[entry.category]} · {entry.note}
                  </span>
                </span>
              </SelectItem>
            ))}
            {custom.map((entry) => (
              <SelectItem key={entry.familyId} value={entry.familyId}>
                <span className="flex flex-col gap-0.5 py-0.5">
                  <span className="text-sm">{entry.name}</span>
                  <span className="text-[0.7rem] text-muted-foreground">
                    Uploaded ·{" "}
                    {entry.variants
                      .map((variant) => variantLabel(variant.weight, variant.italic))
                      .join(", ")}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="space-y-2">
        <input
          ref={fileInput}
          type="file"
          accept={SUPPORTED_FONT_EXTENSIONS.join(",")}
          className="sr-only"
          onChange={(event) => pickFile(event.target.files?.[0])}
        />
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="flex-1"
          >
            <UploadIcon data-icon="inline-start" />
            {busy ? "Loading…" : "Upload a font"}
          </Button>
          {font.custom ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${font.name}`}
              onClick={() => {
                removeCustomFamily(font.id);
                setCustom(listCustomFamilies());
                setTypography(
                  {
                    fontId: "outfit",
                    weight: nearestWeight(resolveFont("outfit").weights, typography.weight),
                    italic: false,
                  },
                  "typography.font",
                );
              }}
            >
              <TrashIcon />
            </Button>
          ) : null}
        </div>

        {pending ? (
          <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
            <SectionLabel className="text-foreground">
              What is in {pending.file.name}?
            </SectionLabel>
            <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
              A font file does not say which weight it holds, and reading it out of the binary
              would mean shipping a font parser. This is the guess from the filename — correct
              it if it is wrong, and upload the other weights as separate files.
            </p>

            <Field label="Family" htmlFor="custom-font-name">
              <Input
                id="custom-font-name"
                value={pending.name}
                spellCheck={false}
                onChange={(event) =>
                  setPending((previous) =>
                    previous ? { ...previous, name: event.target.value } : previous,
                  )
                }
                className="h-8 text-xs"
              />
            </Field>

            <Field label="Weight" htmlFor="custom-font-weight">
              <Select
                items={UPLOAD_WEIGHTS.map((weight) => ({
                  value: String(weight),
                  label: String(weight),
                }))}
                value={String(pending.weight)}
                onValueChange={(value) =>
                  setPending((previous) =>
                    previous ? { ...previous, weight: Number(value) } : previous,
                  )
                }
              >
                <SelectTrigger id="custom-font-weight" className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UPLOAD_WEIGHTS.map((weight) => (
                    <SelectItem key={weight} value={String(weight)}>
                      {weight}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <SegmentedControl<"normal" | "italic">
              label="Style"
              value={pending.italic ? "italic" : "normal"}
              onChange={(next) =>
                setPending((previous) =>
                  previous ? { ...previous, italic: next === "italic" } : previous,
                )
              }
              options={[
                { value: "normal", label: "Roman" },
                { value: "italic", label: "Italic" },
              ]}
            />

            {hasCustomVariant(pending.name, pending.weight, pending.italic) ? (
              <InfoNote>
                {pending.name} already has a {variantLabel(pending.weight, pending.italic)}{" "}
                face. Uploading replaces it.
              </InfoNote>
            ) : null}

            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                disabled={busy || !pending.name.trim()}
                onClick={() => void confirmUpload()}
                className="flex-1"
              >
                {busy ? "Loading…" : "Add this face"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {font.custom ? (
          <div className="space-y-2 rounded-xl border border-border bg-card/40 p-3">
            <SectionLabel>{font.name} faces</SectionLabel>
            <ul className="space-y-1">
              {font.variants.map((variant) => (
                <li
                  key={variant.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2 py-1"
                >
                  <span className="tabular flex-1 truncate text-[0.7rem]">
                    {variantLabel(variant.weight, variant.italic)}
                    <span className="ml-1.5 text-muted-foreground">
                      {(variant.bytes / 1024).toFixed(0)} KB
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${font.name} ${variantLabel(variant.weight, variant.italic)}`}
                    onClick={() => {
                      removeCustomVariant(variant.id);
                      const families = listCustomFamilies();
                      setCustom(families);
                      const remaining = families.find((family) => family.familyId === font.id);
                      if (!remaining) {
                        setTypography(
                          { fontId: "outfit", weight: typography.weight, italic: false },
                          "typography.font",
                        );
                      } else {
                        setTypography(
                          {
                            weight: nearestWeight(
                              remaining.variants.map((entry) => entry.weight),
                              typography.weight,
                            ),
                          },
                          "typography.font",
                        );
                      }
                    }}
                  >
                    <TrashIcon />
                  </Button>
                </li>
              ))}
            </ul>
            <InfoNote>
              Only the faces listed here render exactly. A weight that was never uploaded is
              synthesised by the browser and cannot be reproduced by the video exporter.
              Standalone HTML embeds each of these as its own{" "}
              <code className="font-mono">@font-face</code>, so that file stands alone.
            </InfoNote>
          </div>
        ) : null}
      </div>

      <SliderField
        id="size"
        label="Size"
        value={typography.fontSize}
        display={`${typography.fontSize.toFixed(2)} cqw`}
        range={RANGES.fontSize}
        hint="Relative to the canvas width, so it holds across every format."
        onValueChange={(next) => setTypography({ fontSize: next }, "typography.size")}
      />

      <Field label="Weight" htmlFor="weight">
        <Select
          items={weights.map((weight) => ({ value: String(weight), label: String(weight) }))}
          value={String(typography.weight)}
          onValueChange={(value) => {
            const weight = Number(value);
            void loadFontRequest({
              fontId: typography.fontId,
              weight,
              italic: typography.italic,
            });
            setTypography({ weight }, "typography.weight");
          }}
        >
          <SelectTrigger id="weight" className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {weights.map((weight) => (
              <SelectItem key={weight} value={String(weight)}>
                {weight}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <SliderField
        id="tracking"
        label="Tracking"
        value={typography.tracking}
        display={`${typography.tracking > 0 ? "+" : ""}${typography.tracking.toFixed(3)} em`}
        range={RANGES.tracking}
        onValueChange={(next) => setTypography({ tracking: next }, "typography.tracking")}
      />

      <SliderField
        id="leading"
        label="Leading"
        value={typography.leading}
        display={typography.leading.toFixed(2)}
        range={RANGES.leading}
        hint="Pulls lines together without shrinking the mask, so descenders survive at 0.75."
        onValueChange={(next) => setTypography({ leading: next }, "typography.leading")}
      />

      <SegmentedControl<TextAlign>
        label="Alignment"
        value={typography.align}
        onChange={(next) => setTypography({ align: next }, "typography.align")}
        options={[
          { value: "left", label: <AlignLeftIcon className="size-3.5" />, title: "Left" },
          { value: "center", label: <AlignCenterIcon className="size-3.5" />, title: "Centre" },
          { value: "right", label: <AlignRightIcon className="size-3.5" />, title: "Right" },
        ]}
      />

      <SegmentedControl<TextTransform>
        label="Case"
        value={typography.transform}
        onChange={(next) => setTypography({ transform: next }, "typography.transform")}
        options={[
          { value: "none", label: "As typed" },
          { value: "uppercase", label: "ABC" },
          { value: "lowercase", label: "abc" },
        ]}
      />

      {font.italic ? (
        <SegmentedControl<"normal" | "italic">
          label="Style"
          value={typography.italic ? "italic" : "normal"}
          onChange={(next) => {
            const italic = next === "italic";
            void loadFontRequest({
              fontId: typography.fontId,
              weight: typography.weight,
              italic,
            });
            setTypography({ italic }, "typography.italic");
          }}
          options={[
            { value: "normal", label: "Roman" },
            {
              value: "italic",
              label: (
                <span className="flex items-center gap-1">
                  <ItalicIcon className="size-3" />
                  Italic
                </span>
              ),
            },
          ]}
        />
      ) : (
        <InfoNote>{font.name} ships no italic — the control is hidden rather than faked.</InfoNote>
      )}

      <div className="space-y-2 border-t border-border pt-4">
        <SectionLabel>Animated unit</SectionLabel>
        <SegmentedControl<Granularity>
          label="Split by"
          value={typography.granularity}
          onChange={(next) => setTypography({ granularity: next }, "typography.granularity")}
          options={GRANULARITIES.map((entry) => ({
            value: entry.id,
            label: entry.name.replace("Per ", ""),
            title: entry.hint,
          }))}
        />
        <InfoNote>
          Splitting uses <code className="font-mono">Intl.Segmenter</code>, so emoji and
          accents stay whole. Scripts that shape or reorder across characters — Arabic,
          Hebrew, Devanagari, Thai — are widened to whole words automatically, because an
          atomic inline box cannot be reordered or joined.
        </InfoNote>
      </div>
    </div>
  );
}
