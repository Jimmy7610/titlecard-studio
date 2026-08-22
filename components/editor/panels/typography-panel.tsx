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
  isSessionOnly,
  listCustomFonts,
  loadFont,
  removeCustomFont,
  resolveFont,
  type CustomFont,
} from "@/lib/fonts";
import { RANGES } from "@/lib/project";
import { GRANULARITIES } from "@/lib/segment";
import type { Granularity } from "@/lib/segment";
import type { TextAlign, TextTransform } from "@/lib/types";

/** Stable empty array — a fresh literal would re-render on every pass. */
const EMPTY_FONTS: CustomFont[] = [];

const CATEGORY_LABEL: Record<string, string> = {
  sans: "Sans",
  display: "Display",
  serif: "Serif",
  mono: "Mono",
};

export function TypographyPanel({ controller }: { controller: ProjectController }) {
  const { project, update } = controller;
  const typography = project.typography;
  const [custom, setCustom] = useClientState<CustomFont[]>(listCustomFonts, EMPTY_FONTS);
  const [busy, setBusy] = React.useState(false);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const font = resolveFont(typography.fontId);

  const setTypography = (patch: Partial<typeof typography>, tag: string) =>
    update({ typography: { ...typography, ...patch } }, { tag });

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const added = await addCustomFont(file);
      setCustom(listCustomFonts());
      setTypography({ fontId: added.id }, "typography.font");
      toast.success(`Loaded ${added.name}`, {
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
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const fontItems = React.useMemo(
    () => [
      ...FONTS.map((entry) => ({ value: entry.id, label: entry.name })),
      ...custom.map((entry) => ({ value: entry.id, label: entry.name })),
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
            void loadFont(id, typography.weight);
            setTypography({ fontId: id }, "typography.font");
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
              <SelectItem key={entry.id} value={entry.id}>
                <span className="flex flex-col gap-0.5 py-0.5">
                  <span className="text-sm">{entry.name}</span>
                  <span className="text-[0.7rem] text-muted-foreground">
                    Uploaded · {(entry.bytes / 1024).toFixed(0)} KB
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
          onChange={(event) => void handleUpload(event.target.files?.[0])}
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
                removeCustomFont(font.id);
                setCustom(listCustomFonts());
                setTypography({ fontId: "outfit" }, "typography.font");
              }}
            >
              <TrashIcon />
            </Button>
          ) : null}
        </div>
        {font.custom ? (
          <InfoNote>
            <strong className="font-medium text-foreground">{font.name}</strong> is embedded
            in standalone HTML exports as a data URL, so that file stands alone. The React
            export cannot install a face into your app — it ships the same{" "}
            <code className="font-mono">@font-face</code> inline instead.
          </InfoNote>
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
            void loadFont(typography.fontId, weight);
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
          onChange={(next) =>
            setTypography({ italic: next === "italic" }, "typography.italic")
          }
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
