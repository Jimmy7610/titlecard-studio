"use client";

import * as React from "react";

import { SplitText } from "@/components/split-text";
import { DEBRIS } from "@/lib/debris";
import { getGlyphPool, type GlyphPoolId } from "@/lib/glyphs";
import { gsap, useGSAP } from "@/lib/gsap";
import { getPalette, paletteVars, type PaletteId } from "@/lib/palettes";
import {
  getTemplate,
  type CharUnit,
  type TemplateId,
  type WordUnit,
} from "@/lib/templates";

export type AnimationStageHandle = {
  replay: () => void;
};

export type AnimationStageProps = {
  text: string;
  templateId: TemplateId;
  paletteId: PaletteId;
  glyphPool: GlyphPoolId;
  speed: number;
  stagger: number;
  /** Display size in `cqw`, clamped against the stage container. */
  fontSize: number;
  tracking: number;
  leading: number;
  weight: number;
  invertCanvas: boolean;
  loop: boolean;
  /** Reports the built timeline's length so the UI can show it. */
  onDuration?: (seconds: number) => void;
  ref?: React.Ref<AnimationStageHandle>;
};

/** Walks the rendered markup into the word/character units templates consume. */
function collectUnits(root: HTMLElement): { units: CharUnit[]; words: WordUnit[] } {
  const units: CharUnit[] = [];

  const words = gsap.utils
    .toArray<HTMLElement>("[data-stw-word]", root)
    .map((wordEl, wordIndex) => {
      const chars = gsap.utils
        .toArray<HTMLElement>("[data-stw-char]", wordEl)
        .map((el) => {
          const glyph = el.querySelector<HTMLElement>("[data-stw-glyph]");
          const real = el.querySelector<HTMLElement>("[data-stw-real]");
          if (!glyph || !real) return null;

          const unit: CharUnit = {
            el,
            glyph,
            real,
            index: Number(el.dataset.index ?? units.length),
            wordIndex,
            isGradient: el.dataset.gradient === "true",
          };
          units.push(unit);
          return unit;
        })
        .filter((unit): unit is CharUnit => unit !== null);

      return {
        el: wordEl,
        flash: wordEl.querySelector<HTMLElement>("[data-stw-flash]"),
        chars,
        index: wordIndex,
      } satisfies WordUnit;
    });

  return { units, words };
}

export function AnimationStage({
  ref,
  text,
  templateId,
  paletteId,
  glyphPool,
  speed,
  stagger,
  fontSize,
  tracking,
  leading,
  weight,
  invertCanvas,
  loop,
  onDuration,
}: AnimationStageProps) {
  const scope = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<gsap.core.Timeline | null>(null);
  const template = getTemplate(templateId);

  React.useImperativeHandle(
    ref,
    () => ({
      replay: () => {
        timelineRef.current?.restart();
      },
    }),
    [],
  );

  const stageVars = React.useMemo(
    () => paletteVars(getPalette(paletteId), invertCanvas),
    [paletteId, invertCanvas],
  );

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const { units, words } = collectUnits(root);
      if (units.length === 0) return;

      const debris = gsap.utils.toArray<HTMLElement>("[data-stw-debris]", root);
      const underline = root.querySelector<HTMLElement>("[data-stw-underline]");
      const cursor = root.querySelector<HTMLElement>("[data-stw-cursor]");
      const surface = root.querySelector<HTMLElement>("[data-stw-surface]");

      // Colour tweens resolve to concrete values, so they are read back off the
      // live canvas — that is what lets a palette or canvas swap retint them.
      const styles = getComputedStyle(root);
      const read = (name: string, fallback: string) =>
        styles.getPropertyValue(name).trim() || fallback;

      // Scramble templates write into the glyph overlays. Nothing else clears
      // them, so hand every slot back empty before the next build.
      const clearGlyphs = () => {
        for (const unit of units) unit.glyph.textContent = "";
      };
      clearGlyphs();

      // Respect the OS motion preference: commit the resting state and skip
      // building a timeline entirely rather than animating a shorter version.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(
          units.map((unit) => unit.el),
          {
            yPercent: 0,
            rotate: 0,
            x: 0,
            scale: 1,
            opacity: 1,
            filter: "none",
            clipPath: "none",
          },
        );
        gsap.set(
          units.map((unit) => unit.real),
          { opacity: 1, yPercent: 0 },
        );
        gsap.set([...debris, ...(underline ? [underline] : []), ...(cursor ? [cursor] : [])], {
          opacity: 0,
        });
        onDuration?.(0);
        if (surface) surface.dataset.stwReady = "true";
        return () => {
          if (surface) delete surface.dataset.stwReady;
        };
      }

      const timeline = gsap.timeline({
        paused: true,
        repeat: loop ? -1 : 0,
        repeatDelay: loop ? 1.1 : 0,
      });

      template.build(timeline, {
        units,
        words,
        debris,
        underline,
        cursor,
        palette: {
          ink: read("--stage-ink", "#04152f"),
          canvas: read("--stage-bg", "#e7e7e7"),
          hot: read("--stw-hot", "#f2560a"),
          warm: read("--stw-warm", "#f69625"),
          sun: read("--stw-sun", "#ffc53d"),
        },
        glyphPool: getGlyphPool(glyphPool).chars,
        speed,
        stagger,
      });

      timelineRef.current = timeline;
      onDuration?.(timeline.duration());

      // The markup renders with the finished text in the DOM. Unhiding is
      // deferred until the timeline's initial state is committed, which happens
      // in this layout effect — before the browser paints, so the resting text
      // is never flashed on load.
      if (surface) surface.dataset.stwReady = "true";
      timeline.play(0);

      return () => {
        timelineRef.current = null;
        clearGlyphs();
        if (surface) delete surface.dataset.stwReady;
      };
    },
    {
      scope,
      // `revertOnUpdate` restores the original inline styles before each
      // rebuild, so switching templates cannot leave a stale filter, clip-path
      // or glyph overlay behind on a character.
      revertOnUpdate: true,
      dependencies: [
        text,
        templateId,
        paletteId,
        glyphPool,
        speed,
        stagger,
        loop,
        invertCanvas,
      ],
    },
  );

  return (
    <div
      ref={scope}
      className="stw-stage absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ ...stageVars, containerType: "inline-size" } as React.CSSProperties}
    >
      <div className="stw-stage-grid pointer-events-none absolute inset-0" />

      <div
        data-stw-surface
        className="stw-surface relative z-10 w-full px-[7%] text-center"
        style={
          {
            fontSize: `clamp(1.75rem, ${fontSize}cqw, 13rem)`,
            "--stw-tracking": `${tracking}em`,
            "--stw-leading": `${leading}`,
            "--stw-weight": `${weight}`,
          } as React.CSSProperties
        }
      >
        <span className="relative inline-block">
          <SplitText
            text={text}
            showCursor={template.showCursor}
            className="stw-display"
          />

          <span data-stw-underline className="stw-underline" aria-hidden="true" />

          <span className="pointer-events-none absolute inset-0" aria-hidden="true">
            {DEBRIS.map((particle) => (
              <span
                key={particle.key}
                data-stw-debris
                data-tone={particle.tone}
                className="stw-debris"
                style={{
                  left: `${particle.left}%`,
                  top: `${particle.top}%`,
                  width: `${particle.size}em`,
                  height: `${particle.size}em`,
                }}
              />
            ))}
          </span>
        </span>
      </div>
    </div>
  );
}
