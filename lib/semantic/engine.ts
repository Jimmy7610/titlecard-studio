import { mulberry32 } from "@/lib/random";
import { getMood, MOODS, type MoodDefinition, type MoodId, type MoodLook } from "@/lib/semantic/lexicon";
import type { ProjectState } from "@/lib/types";

/**
 * Smart Suggest.
 *
 * The engine used to *force* a template, which meant a phrase containing the
 * word "system" could not be animated any other way. It now only ever proposes:
 * `suggest` returns something to show, and applying it is a separate, explicit
 * act. Nothing in this module mutates state.
 */

/** Lowercase and strip anything that is not a letter or a digit, Unicode-aware. */
export function normaliseWord(word: string): string {
  return word.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export type LexiconHit = {
  moodId: MoodId;
  /** The word as the user typed it. */
  word: string;
  /** What it matched — an exact token or a stem. */
  token: string;
  kind: "token" | "stem";
  wordIndex: number;
};

const EXACT_INDEX: ReadonlyMap<string, MoodId> = new Map(
  MOODS.flatMap((mood) =>
    [...mood.tokens.en, ...mood.tokens.sv].map(
      (token) => [normaliseWord(token), mood.id] as const,
    ),
  ),
);

const STEMS: readonly { stem: string; moodId: MoodId }[] = MOODS.flatMap((mood) =>
  (mood.stems ?? []).map((stem) => ({ stem: normaliseWord(stem), moodId: mood.id })),
);

/** Matches whole words first, then falls back to stems for inflected forms. */
export function matchWord(word: string): { moodId: MoodId; token: string; kind: "token" | "stem" } | null {
  const normalised = normaliseWord(word);
  if (!normalised) return null;

  const exact = EXACT_INDEX.get(normalised);
  if (exact) return { moodId: exact, token: normalised, kind: "token" };

  // Stems only apply to words long enough that a prefix means something —
  // otherwise "kod" would light up half the lexicon.
  if (normalised.length >= 5) {
    for (const { stem, moodId } of STEMS) {
      if (stem.length >= 4 && normalised.startsWith(stem)) {
        return { moodId, token: stem, kind: "stem" };
      }
    }
  }

  return null;
}

export type Suggestion = {
  mood: MoodDefinition;
  /** Ranked template candidates; index 0 is what is offered. */
  templateId: MoodLook["templates"][number];
  look: MoodLook;
  hits: LexiconHit[];
  /** Which of the mood's ranked templates this suggestion picked. */
  variant: number;
};

/**
 * Scores a phrase against the lexicon.
 *
 * Most matching words wins; ties break toward whichever matched earliest, which
 * keeps the result stable and explainable while the user is still typing.
 * Returns `null` when nothing matches — the caller then shows nothing rather
 * than inventing a reason.
 */
export function suggest(text: string, variant = 0): Suggestion | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const hits: LexiconHit[] = [];
  words.forEach((word, wordIndex) => {
    const match = matchWord(word);
    if (match) hits.push({ ...match, word, wordIndex });
  });

  if (hits.length === 0) return null;

  const tally = new Map<MoodId, { count: number; first: number }>();
  for (const hit of hits) {
    const existing = tally.get(hit.moodId);
    if (existing) existing.count += 1;
    else tally.set(hit.moodId, { count: 1, first: hit.wordIndex });
  }

  let winner: MoodId | null = null;
  let best = { count: -1, first: Number.MAX_SAFE_INTEGER };
  for (const [moodId, score] of tally) {
    if (score.count > best.count || (score.count === best.count && score.first < best.first)) {
      winner = moodId;
      best = score;
    }
  }
  if (!winner) return null;

  const mood = getMood(winner);
  const templates = mood.look.templates;
  const index = ((variant % templates.length) + templates.length) % templates.length;

  return {
    mood,
    templateId: templates[index],
    look: mood.look,
    hits: hits.filter((hit) => hit.moodId === winner),
    variant: index,
  };
}

/* ------------------------------------------------------------------ *
 * Applying a look
 * ------------------------------------------------------------------ */

export type LookScope = {
  animation: boolean;
  palette: boolean;
  typography: boolean;
  motion: boolean;
  background: boolean;
};

export const FULL_SCOPE: LookScope = {
  animation: true,
  palette: true,
  typography: true,
  motion: true,
  background: true,
};

/**
 * Folds a look into a project.
 *
 * The phrase, the canvas format and every per-word style are untouched by
 * design: a look is a *look*, and a user who typed a headline should never lose
 * it to a suggestion.
 */
export function applyLook(
  project: ProjectState,
  look: MoodLook,
  templateId: MoodLook["templates"][number],
  scope: LookScope = FULL_SCOPE,
): ProjectState {
  const next: ProjectState = {
    ...project,
    layers: project.layers.map((layer) =>
      scope.animation && layer.id === project.activeLayerId
        ? { ...layer, templateId }
        : layer,
    ),
  };

  if (scope.palette) {
    next.paletteId = look.paletteId;
    next.invertCanvas = look.invertCanvas;
    // A look expresses itself through the ramp, so custom overrides step aside.
    next.color = { ...project.color, mode: "palette" };
  }

  if (scope.typography) {
    next.typography = {
      ...project.typography,
      fontId: look.fontId,
      weight: look.weight,
      tracking: look.tracking,
      transform: look.transform,
    };
  }

  if (scope.motion) {
    next.motion = {
      ...project.motion,
      speed: look.speed,
      stagger: look.stagger,
      easing: look.easing,
    };
  }

  if (scope.background) {
    next.background = {
      ...project.background,
      mode: look.background.mode,
      vignette: look.background.vignette,
      grid: look.background.grid,
      glow: look.background.glow,
      grain: look.background.grain,
    };
  }

  return next;
}

/* ------------------------------------------------------------------ *
 * Style director
 * ------------------------------------------------------------------ */

export type DirectorResult = {
  look: MoodLook;
  mood: MoodDefinition;
  templateId: MoodLook["templates"][number];
  matched: string[];
  /** True when nothing matched and a neutral default was returned. */
  fallback: boolean;
};

/**
 * Turns a free-text brief into a coherent look.
 *
 * Deliberately the same lexicon as `suggest`, run over a longer string: a
 * description like "calm futuristic announcement about AI" scores every mood it
 * touches and blends the top two rather than taking only the winner, which is
 * what stops a two-word brief from producing a single-note result.
 *
 * The signature is the one a hosted model would fill later — brief in, look
 * out — so adding a provider is a swap here, not a rewrite upstream.
 */
export function direct(brief: string, variant = 0): DirectorResult {
  const words = brief.trim().split(/\s+/).filter(Boolean);
  const scores = new Map<MoodId, number>();
  const matched: string[] = [];

  words.forEach((word) => {
    const match = matchWord(word);
    if (!match) return;
    matched.push(word);
    // A stem match is weaker evidence than the exact word.
    scores.set(match.moodId, (scores.get(match.moodId) ?? 0) + (match.kind === "token" ? 1 : 0.6));
  });

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    const mood = getMood("authoritative");
    return {
      look: mood.look,
      mood,
      templateId: mood.look.templates[0],
      matched: [],
      fallback: true,
    };
  }

  const primary = getMood(ranked[0][0]);
  const secondary = ranked[1] ? getMood(ranked[1][0]) : null;
  const look = secondary ? blend(primary.look, secondary.look) : primary.look;
  const templates = look.templates;
  const index = ((variant % templates.length) + templates.length) % templates.length;

  return {
    look,
    mood: primary,
    templateId: templates[index],
    matched,
    fallback: false,
  };
}

/**
 * Blends a secondary mood into a primary one.
 *
 * Structure comes from the primary — its templates, its face, its palette —
 * and only the continuous quantities are averaged. Interpolating the
 * categorical choices instead would produce a serif terminal in a plasma
 * palette, which is not a blend of two looks but the absence of either.
 */
function blend(primary: MoodLook, secondary: MoodLook): MoodLook {
  const mix = (a: number, b: number) => a * 0.68 + b * 0.32;

  return {
    ...primary,
    speed: mix(primary.speed, secondary.speed),
    stagger: mix(primary.stagger, secondary.stagger),
    tracking: mix(primary.tracking, secondary.tracking),
    weight: Math.round(mix(primary.weight, secondary.weight) / 100) * 100,
    background: {
      ...primary.background,
      vignette: mix(primary.background.vignette, secondary.background.vignette),
      glow: mix(primary.background.glow, secondary.background.glow),
      grain: mix(primary.background.grain, secondary.background.grain),
      grid: mix(primary.background.grid, secondary.background.grid),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Surprise Me
 * ------------------------------------------------------------------ */

/**
 * A coherent variation, not noise.
 *
 * It picks a mood and then varies *within* that mood's family — the template
 * comes from that mood's own ranked list, and tempo and tracking move by a
 * bounded factor. That is the whole difference between a randomiser worth
 * pressing twice and one that produces an elastic bounce on a funeral notice.
 */
export function surprise(seed: number): DirectorResult {
  const random = mulberry32(seed);
  const mood = MOODS[Math.floor(random() * MOODS.length)];
  const templates = mood.look.templates;
  const templateId = templates[Math.floor(random() * templates.length)];

  const jitter = (value: number, spread: number) =>
    value * (1 - spread + random() * spread * 2);

  const look: MoodLook = {
    ...mood.look,
    speed: Math.round(jitter(mood.look.speed, 0.22) * 100) / 100,
    stagger: Math.round(jitter(mood.look.stagger, 0.35) * 1000) / 1000,
    tracking: Math.round((mood.look.tracking + (random() - 0.5) * 0.05) * 1000) / 1000,
    invertCanvas: random() > 0.35 ? mood.look.invertCanvas : !mood.look.invertCanvas,
  };

  return { look, mood, templateId, matched: [], fallback: false };
}
