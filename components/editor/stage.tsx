"use client";

import * as React from "react";

import { SplitLayer } from "@/components/editor/split-layer";
import type { CharUnit, WordUnit } from "@/lib/animation/units";
import { scopeVars, SPLIT_PRIMITIVES_CSS } from "@/lib/export/css";
import type { ExportModel } from "@/lib/export/model";
import { loadFont } from "@/lib/fonts";
import { getGlyphPool } from "@/lib/glyphs";
import { gsap, useGSAP } from "@/lib/gsap";
import { projectFontIds } from "@/lib/project";
import { buildTemplate } from "@/lib/templates";

/**
 * The live preview.
 *
 * One master timeline owns playback; each layer contributes a child timeline
 * added at its own offset. Nothing here re-renders on a frame — the playhead
 * reads `timeline()` directly through the handle, so dragging the scrubber or
 * running a 20-second loop costs zero React work.
 */

export type StageHandle = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  replay: () => void;
  seek: (seconds: number) => void;
  step: (frames: number, fps?: number) => void;
  setRate: (rate: number) => void;
  timeline: () => gsap.core.Timeline | null;
  isPlaying: () => boolean;
};

export type StageProps = {
  model: ExportModel;
  /** Editor-only damping, on top of the OS preference. */
  reduceMotion: boolean;
  onReady?: (duration: number) => void;
  ref?: React.Ref<StageHandle>;
};

/** Walks a layer's markup into the word/character units templates consume. */
function collectUnits(root: HTMLElement): { units: CharUnit[]; words: WordUnit[] } {
  const units: CharUnit[] = [];

  const words = gsap.utils
    .toArray<HTMLElement>("[data-stw-char]", root)
    .reduce<Map<HTMLElement, HTMLElement[]>>((map, char) => {
      const wordEl = char.closest<HTMLElement>(".stw-word");
      if (!wordEl) return map;
      const list = map.get(wordEl);
      if (list) list.push(char);
      else map.set(wordEl, [char]);
      return map;
    }, new Map());

  const wordUnits: WordUnit[] = [...words.entries()].map(([wordEl, chars], wordIndex) => {
    const charUnits = chars
      .map((el) => {
        const glyph = el.querySelector<HTMLElement>("[data-stw-glyph]");
        const real = el.querySelector<HTMLElement>("[data-stw-real]");
        if (!glyph || !real) return null;

        const unit: CharUnit = {
          el,
          glyph,
          real,
          index: Number(el.dataset.index ?? units.length),
          wordIndex: Number(el.dataset.word ?? wordIndex),
          isGradient: el.dataset.gradient === "true",
        };
        units.push(unit);
        return unit;
      })
      .filter((unit): unit is CharUnit => unit !== null);

    return {
      el: wordEl,
      flash: wordEl.querySelector<HTMLElement>("[data-stw-flash]"),
      chars: charUnits,
      index: wordIndex,
    } satisfies WordUnit;
  });

  units.sort((a, b) => a.index - b.index);
  return { units, words: wordUnits };
}

export function Stage({ model, reduceMotion, onReady, ref }: StageProps) {
  const scope = React.useRef<HTMLDivElement>(null);
  const master = React.useRef<gsap.core.Timeline | null>(null);
  /** The font key whose faces are known to be measurable. */
  const [loadedFonts, setLoadedFonts] = React.useState("");

  const { project, theme, layers } = model;

  // Every mask height is derived from font metrics, so the timeline must not be
  // built against a fallback face and then measured against the real one.
  const fontKey = projectFontIds(project).join("|");
  const weight = project.typography.weight;
  React.useEffect(() => {
    let cancelled = false;

    // Resolving asynchronously rather than flipping a flag to false first: the
    // previous face is still the right thing to render until the new one is
    // actually measurable.
    void Promise.all(fontKey.split("|").map((id) => loadFont(id, weight)))
      .then(async () => {
        if (document.fonts) await document.fonts.ready;
      })
      .catch(() => undefined)
      .then(
        () =>
          // `document.fonts.ready` resolves when the face is downloaded, which
          // is earlier than when the injected stylesheet has been applied to
          // these elements. Building on that promise measures the OUTGOING
          // font's box and bakes it in: GSAP resolves yPercent to px at build
          // time, so a stale box height parks every glyph outside its own mask
          // and the line renders blank. Two frames guarantees a style recalc
          // and a paint with the new face before anything is measured.
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      )
      .then(() => {
        if (!cancelled) setLoadedFonts(fontKey);
      });

    return () => {
      cancelled = true;
    };
  }, [fontKey, weight]);

  React.useImperativeHandle(
    ref,
    () => ({
      play: () => master.current?.play(),
      pause: () => master.current?.pause(),
      toggle: () => {
        const timeline = master.current;
        if (!timeline) return;
        if (!timeline.paused() && timeline.isActive()) {
          timeline.pause();
          return;
        }
        // Playing from the very end is a no-op in GSAP, so a finished
        // non-looping timeline would simply ignore the play button.
        if (timeline.progress() >= 1) timeline.restart();
        else timeline.play();
      },
      replay: () => master.current?.restart(),
      seek: (seconds) => {
        const timeline = master.current;
        if (!timeline) return;
        timeline.pause();
        timeline.seek(Math.max(0, Math.min(timeline.duration(), seconds)));
      },
      step: (frames, fps = 30) => {
        const timeline = master.current;
        if (!timeline) return;
        timeline.pause();
        timeline.seek(
          Math.max(0, Math.min(timeline.duration(), timeline.time() + frames / fps)),
        );
      },
      setRate: (rate) => master.current?.timeScale(rate),
      timeline: () => master.current,
      isPlaying: () => {
        const timeline = master.current;
        return timeline !== null && !timeline.paused();
      },
    }),
    [],
  );

  // Rebuild whenever anything the timeline reads changes. The dependency list
  // is a serialised digest rather than the objects themselves: the model is
  // rebuilt on every render, so identity would rebuild on every keystroke.
  const digest = React.useMemo(
    () =>
      JSON.stringify({
        layers: layers.map((layer) => ({
          text: layer.layer.text,
          template: layer.template.id,
          pool: layer.layer.glyphPool,
          at: layer.at,
          delays: layer.wordDelays,
          granularity: layer.split.granularity,
          // Per-layer overrides and word styles change glyph metrics, and
          // therefore the pixel values GSAP bakes in. They belong here.
          typography: layer.layer.typography,
          wordStyles: layer.layer.wordStyles,
        })),
        // Size, tracking, weight, case and italic all resize the boxes the
        // timeline measures. Tracking only the font id was not enough.
        typography: project.typography,
        motion: project.motion,
        theme: [theme.ink, theme.canvas, theme.hot, theme.warm, theme.sun, theme.gradient],
        ease: model.easeOverride,
        reduceMotion,
        fonts: loadedFonts,
      }),
    [
      layers,
      project.typography,
      project.motion,
      theme,
      model.easeOverride,
      reduceMotion,
      loadedFonts,
    ],
  );

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const roots = gsap.utils.toArray<HTMLElement>("[data-stw-layer]", root);
      if (!roots.length) return;

      const collected = roots.map((layerRoot) => collectUnits(layerRoot));

      // Scramble templates write into the glyph overlays. `revert` restores
      // inline styles but not textContent, so hand every slot back empty.
      const clearGlyphs = () => {
        for (const entry of collected) {
          for (const unit of entry.units) unit.glyph.textContent = "";
        }
      };
      clearGlyphs();

      const reveal = () => {
        for (const node of gsap.utils.toArray<HTMLElement>("[data-stw-scope]", root)) {
          node.dataset.stwReady = "true";
        }
      };
      const hide = () => {
        for (const node of gsap.utils.toArray<HTMLElement>("[data-stw-scope]", root)) {
          delete node.dataset.stwReady;
        }
      };

      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReduced || reduceMotion) {
        // Commit the resting frame and skip building a timeline entirely,
        // rather than animating a shortened version of it.
        const allUnits = collected.flatMap((entry) => entry.units);
        gsap.set(
          allUnits.map((unit) => unit.el),
          {
            clearProps: "all",
          },
        );
        gsap.set(
          allUnits.map((unit) => unit.real),
          { opacity: 1, yPercent: 0 },
        );
        gsap.set(
          allUnits.map((unit) => unit.glyph),
          { opacity: 0 },
        );
        gsap.set(
          gsap.utils.toArray<HTMLElement>(
            "[data-stw-debris], [data-stw-underline], [data-stw-cursor]",
            root,
          ),
          { opacity: 0 },
        );
        master.current = null;
        onReady?.(0);
        reveal();
        return () => {
          hide();
        };
      }

      const timeline = gsap.timeline({
        paused: true,
        repeat: project.motion.loop ? -1 : 0,
        repeatDelay: project.motion.loop ? project.motion.hold : 0,
      });

      layers.forEach((layerModel, index) => {
        const entry = collected[index];
        if (!entry || entry.units.length === 0) return;

        const child = gsap.timeline();
        const unitDelays = entry.units.map(
          (unit) => layerModel.wordDelays[unit.wordIndex] ?? 0,
        );

        buildTemplate(layerModel.template, child, {
          units: entry.units,
          words: entry.words,
          debris: gsap.utils.toArray<HTMLElement>("[data-stw-debris]", roots[index]),
          underline: roots[index].querySelector<HTMLElement>("[data-stw-underline]"),
          cursor: roots[index].querySelector<HTMLElement>("[data-stw-cursor]"),
          palette: {
            ink: theme.ink,
            canvas: theme.canvas,
            hot: theme.hot,
            warm: theme.warm,
            sun: theme.sun,
            gradient: theme.gradient,
          },
          glyphPool: getGlyphPool(layerModel.layer.glyphPool).chars,
          speed: project.motion.speed,
          stagger: project.motion.stagger,
          easeOverride: model.easeOverride,
          unitDelays,
        });

        timeline.add(child, layerModel.at);
      });

      master.current = timeline;
      onReady?.(timeline.duration());

      // The markup renders with the finished text in the DOM. Unhiding is
      // deferred until the timeline's initial state is committed, which happens
      // inside this layout effect — before the browser paints, so the resting
      // text is never flashed.
      timeline.pause(0);
      reveal();
      timeline.play();

      return () => {
        master.current = null;
        clearGlyphs();
        hide();
      };
    },
    {
      scope,
      // Restores the original inline styles before each rebuild, so switching
      // templates cannot leave a stale filter, clip-path or overlay behind.
      revertOnUpdate: true,
      dependencies: [digest],
    },
  );

  return (
    <div
      ref={scope}
      className="stw-scope stw-preview"
      style={scopeVars(model) as React.CSSProperties}
    >
      {/* The one copy of the primitives. Exports inline this same string. */}
      <style>{SPLIT_PRIMITIVES_CSS}</style>

      <div
        className="stw-canvas"
        data-animated={project.background.animated ? "true" : undefined}
        data-transparent={theme.transparent ? "true" : undefined}
      >
        {theme.grain > 0 ? <span className="stw-grain" /> : null}
        {layers.map((layerModel) => (
          <SplitLayer key={layerModel.layer.id} model={layerModel} />
        ))}
      </div>
    </div>
  );
}
