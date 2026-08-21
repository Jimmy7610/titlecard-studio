import type { TemplateId } from "@/lib/templates";

export type SemanticRule = {
  templateId: TemplateId;
  /** Human readable grouping shown in the control panel. */
  label: string;
  tokens: readonly string[];
};

/**
 * Lightweight lexicon. Tokens are matched against normalised words (lowercased,
 * stripped of surrounding punctuation) — never against substrings, so "technique"
 * does not trigger the "tech" rule.
 */
export const SEMANTIC_LEXICON: readonly SemanticRule[] = [
  {
    templateId: "agent-reveal",
    label: "Authoritative",
    tokens: [
      "agent",
      "corporate",
      "premium",
      "enterprise",
      "studio",
      "launch",
      "flagship",
      "3",
    ],
  },
  {
    templateId: "weightless-blur",
    label: "Atmospheric",
    tokens: [
      "calm",
      "smooth",
      "breathe",
      "soft",
      "slow",
      "quiet",
      "drift",
      "gentle",
      "flow",
    ],
  },
  {
    templateId: "glitch-mask",
    label: "Machinic",
    tokens: [
      "tech",
      "build",
      "glitch",
      "hack",
      "code",
      "system",
      "protocol",
      "render",
      "compile",
    ],
  },
  {
    templateId: "glyph-decode",
    label: "Terminal",
    tokens: [
      "terminal",
      "decode",
      "boot",
      "init",
      "scan",
      "cipher",
      "signal",
      "loading",
      "shell",
    ],
  },
  {
    templateId: "odometer-roll",
    label: "Numeric",
    tokens: [
      "counter",
      "ticker",
      "count",
      "score",
      "stats",
      "metrics",
      "index",
      "total",
    ],
  },
  {
    templateId: "ribbon-wipe",
    label: "Editorial",
    tokens: [
      "headline",
      "feature",
      "highlight",
      "brand",
      "bold",
      "editorial",
      "reveal",
    ],
  },
] as const;

export type SemanticMatch = {
  templateId: TemplateId;
  /** The lexicon token that won. */
  token: string;
  /** The word as the user typed it. */
  word: string;
  wordIndex: number;
  /** How many words in the input matched the winning template. */
  hits: number;
};

const TOKEN_INDEX: ReadonlyMap<string, TemplateId> = new Map(
  SEMANTIC_LEXICON.flatMap((rule) =>
    rule.tokens.map((token) => [token, rule.templateId] as const),
  ),
);

/** Lowercase and strip anything that is not a letter or digit. */
export function normaliseWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolves the template a phrase "wants" to be animated with.
 *
 * Scoring is deliberately simple and explainable: the template with the most
 * matching words wins, ties break toward whichever matched earliest in the
 * phrase. Returns `null` when nothing in the lexicon matches, which lets the
 * caller fall back to the manually selected template.
 */
export function resolveSemanticTemplate(text: string): SemanticMatch | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const tally = new Map<TemplateId, { hits: number; first: SemanticMatch }>();

  words.forEach((word, wordIndex) => {
    const token = normaliseWord(word);
    if (!token) return;

    const templateId = TOKEN_INDEX.get(token);
    if (!templateId) return;

    const existing = tally.get(templateId);
    if (existing) {
      existing.hits += 1;
      return;
    }

    tally.set(templateId, {
      hits: 1,
      first: { templateId, token, word, wordIndex, hits: 1 },
    });
  });

  if (tally.size === 0) return null;

  let winner: { hits: number; first: SemanticMatch } | null = null;
  for (const entry of tally.values()) {
    if (
      !winner ||
      entry.hits > winner.hits ||
      (entry.hits === winner.hits &&
        entry.first.wordIndex < winner.first.wordIndex)
    ) {
      winner = entry;
    }
  }

  if (!winner) return null;
  return { ...winner.first, hits: winner.hits };
}
