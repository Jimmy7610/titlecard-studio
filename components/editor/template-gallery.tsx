"use client";

import * as React from "react";
import { StarIcon } from "lucide-react";

import { SectionLabel } from "@/components/editor/controls";
import { useClientState } from "@/hooks/use-client-value";
import { Button } from "@/components/ui/button";
import type { CharUnit, WordUnit } from "@/lib/animation/units";
import { SPLIT_PRIMITIVES_CSS } from "@/lib/export/css";
import { getGlyphPool } from "@/lib/glyphs";
import { gsap } from "@/lib/gsap";
import { graphemes } from "@/lib/segment";
import { splitText } from "@/lib/split";
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  buildTemplate,
  type TemplateDefinition,
  type TemplateId,
} from "@/lib/templates";
import type { ResolvedTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * The template browser.
 *
 * Cards render *the user's own phrase*, not a fixed example — a template is a
 * style, and showing "Agent 3" in every tile was the thing that made people
 * believe the templates were tied to particular words.
 *
 * The animation is real GSAP, built on hover or focus and killed on the way
 * out. Twenty-eight always-running timelines would cost more than the editor
 * they sit next to; one is free.
 */

const FAVOURITES_KEY = "stw:template-favourites:v1";
/** Stable empty set — a fresh literal would re-render on every pass. */
const EMPTY_FAVOURITES: Set<string> = new Set();
const PREVIEW_GRAPHEMES = 14;

function readFavourites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FAVOURITES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeFavourites(ids: Set<string>): void {
  try {
    window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable */
  }
}

/** Enough of the phrase to read the motion, not enough to cost a frame. */
function previewPhrase(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "Preview";
  const units = graphemes(trimmed);
  if (units.length <= PREVIEW_GRAPHEMES) return trimmed;
  return `${units.slice(0, PREVIEW_GRAPHEMES).join("").trimEnd()}…`;
}

function collect(root: HTMLElement): { units: CharUnit[]; words: WordUnit[] } {
  const units: CharUnit[] = [];
  const words: WordUnit[] = gsap.utils
    .toArray<HTMLElement>(".stw-word", root)
    .map((wordEl, wordIndex) => {
      const chars = gsap.utils
        .toArray<HTMLElement>(".stw-char", wordEl)
        .map((el) => {
          const glyph = el.querySelector<HTMLElement>(".stw-glyph");
          const real = el.querySelector<HTMLElement>(".stw-real");
          if (!glyph || !real) return null;
          const unit: CharUnit = {
            el,
            glyph,
            real,
            index: Number(el.dataset.index ?? units.length),
            wordIndex,
            isGradient: false,
          };
          units.push(unit);
          return unit;
        })
        .filter((unit): unit is CharUnit => unit !== null);

      return {
        el: wordEl,
        flash: wordEl.querySelector<HTMLElement>(".stw-flash"),
        chars,
        index: wordIndex,
      };
    });

  return { units, words };
}

function TemplateCard({
  template,
  phrase,
  theme,
  active,
  favourite,
  onSelect,
  onToggleFavourite,
}: {
  template: TemplateDefinition;
  phrase: string;
  theme: ResolvedTheme;
  active: boolean;
  favourite: boolean;
  onSelect: () => void;
  onToggleFavourite: () => void;
}) {
  const stage = React.useRef<HTMLDivElement>(null);
  const timeline = React.useRef<gsap.core.Timeline | null>(null);

  const split = React.useMemo(
    () => splitText(phrase, { granularity: "char", gradientDigits: false }),
    [phrase],
  );

  const stop = React.useCallback(() => {
    timeline.current?.kill();
    timeline.current = null;
    const root = stage.current;
    if (!root) return;
    gsap.set(gsap.utils.toArray<HTMLElement>(".stw-char", root), { clearProps: "all" });
    for (const glyph of gsap.utils.toArray<HTMLElement>(".stw-glyph", root)) {
      glyph.textContent = "";
      gsap.set(glyph, { opacity: 0 });
    }
    gsap.set(gsap.utils.toArray<HTMLElement>(".stw-real", root), { opacity: 1, yPercent: 0 });
    gsap.set(
      gsap.utils.toArray<HTMLElement>(".stw-flash, .stw-underline, .stw-cursor", root),
      { opacity: 0 },
    );
  }, []);

  const start = React.useCallback(() => {
    const root = stage.current;
    if (!root || timeline.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const { units, words } = collect(root);
    if (!units.length) return;

    const next = gsap.timeline({ repeat: -1, repeatDelay: 0.7 });
    buildTemplate(template, next, {
      units,
      words,
      debris: [],
      underline: root.querySelector<HTMLElement>(".stw-underline"),
      cursor: root.querySelector<HTMLElement>(".stw-cursor"),
      palette: theme,
      glyphPool: getGlyphPool("hex").chars,
      speed: 1.35,
      stagger: 0.035,
      easeOverride: null,
      unitDelays: [],
    });

    timeline.current = next;
  }, [template, theme]);

  React.useEffect(() => stop, [stop]);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border transition-colors",
        active
          ? "border-primary/60 bg-primary/5"
          : "border-border bg-card/40 hover:border-border/80 hover:bg-card/70",
      )}
      onPointerEnter={start}
      onPointerLeave={stop}
    >
      <button
        type="button"
        onClick={onSelect}
        onFocus={start}
        onBlur={stop}
        aria-pressed={active}
        className="block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div
          ref={stage}
          className="stw-scope relative grid h-20 place-items-center overflow-hidden px-3"
          style={
            {
              "--stw-hot": theme.hot,
              "--stw-warm": theme.warm,
              "--stw-sun": theme.sun,
              "--stw-gradient": theme.gradient,
              "--stage-ink": theme.ink,
              background: theme.transparent ? "transparent" : theme.canvas,
              color: theme.ink,
            } as React.CSSProperties
          }
        >
          <span
            className="stw"
            data-stw-ready="true"
            data-overflow={template.unmasked ? "visible" : undefined}
            style={
              {
                "--stw-size": "0.95rem",
                "--stw-weight": "600",
                "--stw-tracking": "-0.01em",
                "--stw-leading": "1.1",
                "--stw-align": "center",
              } as React.CSSProperties
            }
          >
            <span className="stw-visual">
              {split.lines.map((line) => (
                <span className="stw-line" key={line.key}>
                  {line.words.map((word, wordIndex) => (
                    <React.Fragment key={word.key}>
                      <span className="stw-word">
                        <span className="stw-mask">
                          <span className="stw-flash" />
                          {word.characters.map((character) => (
                            <span
                              key={character.key}
                              className="stw-char"
                              data-index={character.globalIndex}
                            >
                              <span className="stw-glyph" />
                              <span className="stw-real">{character.char}</span>
                            </span>
                          ))}
                        </span>
                      </span>
                      {wordIndex < line.words.length - 1 ? (
                        <span className="stw-space"> </span>
                      ) : null}
                    </React.Fragment>
                  ))}
                </span>
              ))}
              {template.showCursor ? <span className="stw-cursor" /> : null}
              <span className="stw-underline" />
            </span>
          </span>
        </div>

        <div className="space-y-0.5 px-2.5 py-2">
          <p className="truncate text-xs font-medium">{template.name}</p>
          <p className="truncate text-[0.65rem] text-muted-foreground">{template.tagline}</p>
        </div>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={favourite ? `Unfavourite ${template.name}` : `Favourite ${template.name}`}
        aria-pressed={favourite}
        onClick={onToggleFavourite}
        className={cn(
          "absolute top-1.5 right-1.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100",
          favourite && "opacity-100",
        )}
      >
        <StarIcon className={cn(favourite && "fill-primary text-primary")} />
      </Button>
    </div>
  );
}

export function TemplateGallery({
  phrase,
  theme,
  activeId,
  onSelect,
}: {
  phrase: string;
  theme: ResolvedTheme;
  activeId: TemplateId;
  onSelect: (id: TemplateId) => void;
}) {
  const [favourites, setFavourites] = useClientState(readFavourites, EMPTY_FAVOURITES);

  const toggleFavourite = (id: string) => {
    const next = new Set(favourites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeFavourites(next);
    setFavourites(next);
  };

  const preview = previewPhrase(phrase);
  const favouriteTemplates = TEMPLATES.filter((template) => favourites.has(template.id));

  const renderGrid = (templates: readonly TemplateDefinition[]) => (
    <div className="grid grid-cols-2 gap-2">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          phrase={preview}
          theme={theme}
          active={template.id === activeId}
          favourite={favourites.has(template.id)}
          onSelect={() => onSelect(template.id)}
          onToggleFavourite={() => toggleFavourite(template.id)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <style>{SPLIT_PRIMITIVES_CSS}</style>

      {favouriteTemplates.length > 0 ? (
        <section className="space-y-2">
          <SectionLabel>Favourites</SectionLabel>
          {renderGrid(favouriteTemplates)}
        </section>
      ) : null}

      {TEMPLATE_CATEGORIES.map((category) => {
        const templates = TEMPLATES.filter((template) => template.category === category.id);
        if (!templates.length) return null;

        return (
          <section key={category.id} className="space-y-2">
            <div className="space-y-0.5">
              <SectionLabel>{category.name}</SectionLabel>
              <p className="text-[0.7rem] text-muted-foreground/70">{category.note}</p>
            </div>
            {renderGrid(templates)}
          </section>
        );
      })}
    </div>
  );
}
