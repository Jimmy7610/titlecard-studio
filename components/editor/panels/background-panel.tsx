"use client";

import * as React from "react";
import { ImageIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";

import {
  ColorField,
  Field,
  InfoNote,
  SectionLabel,
  SegmentedControl,
  SliderField,
  ToggleRow,
} from "@/components/editor/controls";
import { Button } from "@/components/ui/button";
import type { ProjectController } from "@/hooks/use-project";
import { RANGES } from "@/lib/project";
import type { BackgroundConfig, BackgroundMode } from "@/lib/types";

/** Anything larger than this is a video frame, not a background. */
const MAX_IMAGE_BYTES = 4_000_000;

export function BackgroundPanel({ controller }: { controller: ProjectController }) {
  const { project, update } = controller;
  const background = project.background;
  const fileInput = React.useRef<HTMLInputElement>(null);

  const setBackground = (patch: Partial<BackgroundConfig>, tag: string) =>
    update({ background: { ...background, ...patch } }, { tag });

  const handleImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That file is not an image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image is over 4 MB", {
        description: "It would be embedded in every export as a data URL.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setBackground({ imageUrl: String(reader.result), mode: "image" }, "background.image");
      toast.success("Background image set", {
        description: "Embedded as a data URL, so exports carry it with them.",
      });
    };
    reader.onerror = () => toast.error("Could not read that image.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <SegmentedControl<BackgroundMode>
        label="Background"
        value={background.mode}
        onChange={(next) => setBackground({ mode: next }, "background.mode")}
        columns={2}
        options={[
          { value: "solid", label: "Solid" },
          { value: "gradient", label: "Gradient" },
          { value: "transparent", label: "Transparent" },
          { value: "image", label: "Image" },
        ]}
      />

      {background.mode === "solid" ? (
        <ColorField
          id="bg-colour"
          label="Colour"
          value={background.color}
          onChange={(next) => setBackground({ color: next }, "background.color")}
        />
      ) : null}

      {background.mode === "gradient" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ColorField
              id="bg-from"
              label="From"
              value={background.gradientStart}
              onChange={(next) => setBackground({ gradientStart: next }, "background.from")}
            />
            <ColorField
              id="bg-to"
              label="To"
              value={background.gradientEnd}
              onChange={(next) => setBackground({ gradientEnd: next }, "background.to")}
            />
          </div>
          <SliderField
            id="bg-angle"
            label="Angle"
            value={background.gradientAngle}
            display={`${Math.round(background.gradientAngle)}°`}
            range={RANGES.angle}
            onValueChange={(next) => setBackground({ gradientAngle: next }, "background.angle")}
          />
          <ToggleRow
            id="bg-animated"
            label="Animate the gradient"
            hint="A slow 18s drift. Costs one extra compositor layer, so it is opt-in."
            checked={background.animated}
            onCheckedChange={(next) => setBackground({ animated: next }, "background.animated")}
          />
        </div>
      ) : null}

      {background.mode === "transparent" ? (
        <InfoNote>
          The editor shows a checkerboard so you can see through the canvas; it is a guide and
          is never exported. Standalone HTML keeps the transparency — the page itself paints
          nothing, so it composites against whatever it is embedded in. Video export needs a
          format that carries alpha; the export panel says which ones do.
        </InfoNote>
      ) : null}

      {background.mode === "image" ? (
        <div className="space-y-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => handleImage(event.target.files?.[0])}
          />
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => fileInput.current?.click()}
            >
              <ImageIcon data-icon="inline-start" />
              {background.imageUrl ? "Replace image" : "Choose image"}
            </Button>
            {background.imageUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove background image"
                onClick={() => setBackground({ imageUrl: "" }, "background.image")}
              >
                <TrashIcon />
              </Button>
            ) : null}
          </div>

          {background.imageUrl ? (
            <SegmentedControl<"cover" | "contain">
              label="Fit"
              value={background.imageFit}
              onChange={(next) => setBackground({ imageFit: next }, "background.fit")}
              options={[
                { value: "cover", label: "Cover" },
                { value: "contain", label: "Contain" },
              ]}
            />
          ) : (
            <InfoNote>No image chosen — the canvas falls back to the palette tone.</InfoNote>
          )}
        </div>
      ) : null}

      <div className="space-y-4 border-t border-border pt-4">
        <div className="space-y-0.5">
          <SectionLabel>Layers</SectionLabel>
          <p className="text-[0.7rem] text-muted-foreground/70">
            Each is skipped entirely at zero rather than composited invisible.
          </p>
        </div>

        <SliderField
          id="bg-grid"
          label="Grid"
          value={background.grid}
          display={background.grid === 0 ? "off" : background.grid.toFixed(2)}
          range={RANGES.effect}
          onValueChange={(next) => setBackground({ grid: next }, "background.grid")}
        />
        <SliderField
          id="bg-vignette"
          label="Vignette"
          value={background.vignette}
          display={background.vignette === 0 ? "off" : background.vignette.toFixed(2)}
          range={RANGES.effect}
          onValueChange={(next) => setBackground({ vignette: next }, "background.vignette")}
        />
        <SliderField
          id="bg-glow"
          label="Accent glow"
          value={background.glow}
          display={background.glow === 0 ? "off" : background.glow.toFixed(2)}
          range={RANGES.effect}
          onValueChange={(next) => setBackground({ glow: next }, "background.glow")}
        />
        <SliderField
          id="bg-noise"
          label="Colour cloud"
          value={background.noise}
          display={background.noise === 0 ? "off" : background.noise.toFixed(2)}
          range={RANGES.effect}
          onValueChange={(next) => setBackground({ noise: next }, "background.noise")}
        />
        <SliderField
          id="bg-grain"
          label="Film grain"
          value={background.grain}
          display={background.grain === 0 ? "off" : background.grain.toFixed(2)}
          range={RANGES.effect}
          onValueChange={(next) => setBackground({ grain: next }, "background.grain")}
        />
      </div>

      <Field label="Reset">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            setBackground(
              { grid: 0, vignette: 0, glow: 0, noise: 0, grain: 0, animated: false },
              "background.clear",
            )
          }
        >
          Clear every layer
        </Button>
      </Field>
    </div>
  );
}
