import {
  applyTextTransform,
  graphemes,
  resolveGranularity,
  type Granularity,
  type ScriptProfile,
} from "@/lib/segment";

export type SplitCharacter = {
  key: string;
  /** One animated box's text. A grapheme, a word, or a whole line. */
  char: string;
  indexInWord: number;
  /** Index across the whole phrase, ignoring spaces. Drives stagger order. */
  globalIndex: number;
  /**
   * Trailing digits of the final word ("Agent 3" -> "3") carry the
   * background-clip gradient treatment. Optional — see `gradientDigits`.
   */
  isGradient: boolean;
};

export type SplitWord = {
  key: string;
  text: string;
  /** Index across the whole phrase, so per-word styling survives line breaks. */
  index: number;
  indexInLine: number;
  lineIndex: number;
  characters: SplitCharacter[];
};

export type SplitLine = {
  key: string;
  index: number;
  words: SplitWord[];
};

export type SplitTextResult = {
  lines: SplitLine[];
  /** Flattened, in reading order. */
  words: SplitWord[];
  charCount: number;
  gradientCount: number;
  granularity: Granularity;
  /** True when the requested granularity was too fine for the script. */
  downgraded: boolean;
  profile: ScriptProfile;
};

export type SplitOptions = {
  /** Requested unit size. Clamped upward when the script demands it. */
  granularity?: Granularity;
  /** Trailing digits of the last word take the gradient. Default true. */
  gradientDigits?: boolean;
  transform?: "none" | "uppercase" | "lowercase";
};

const EMPTY_PROFILE: ScriptProfile = {
  rtl: false,
  complex: false,
  direction: "ltr",
  safeGranularity: "char",
};

const EMPTY: SplitTextResult = {
  lines: [],
  words: [],
  charCount: 0,
  gradientCount: 0,
  granularity: "char",
  downgraded: false,
  profile: EMPTY_PROFILE,
};

/** Trailing run of ASCII digits in a word, as a grapheme index. */
function gradientStartIndex(units: string[]): number {
  let start = units.length;
  while (start > 0 && /^[0-9]$/.test(units[start - 1])) start -= 1;
  return start;
}

/**
 * Splits a phrase into lines, words and animated units.
 *
 * Words become the `overflow: hidden` mask boxes; the units inside them are the
 * transformed children, so every reveal is bounded by the word's own footprint.
 *
 * Segmentation goes through `Intl.Segmenter`, so emoji ZWJ sequences, combining
 * marks and Swedish diacritics stay whole. When the script shapes or reorders
 * across characters the unit is silently widened to the whole word — a word box
 * still gets to shape and reorder internally, so the text stays correct.
 */
export function splitText(
  source: string,
  options: SplitOptions = {},
): SplitTextResult {
  const {
    granularity: requested = "char",
    gradientDigits = true,
    transform = "none",
  } = options;

  const cased = applyTextTransform(source, transform);
  // Collapse runs of spaces/tabs but keep explicit line breaks.
  const normalised = cased
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

  if (!normalised) return EMPTY;

  const { granularity, profile, downgraded } = resolveGranularity(
    normalised,
    requested,
  );

  const rawLines = normalised.split("\n").filter((line) => line.length > 0);

  let globalIndex = 0;
  let wordIndex = 0;
  let gradientCount = 0;

  const lastLine = rawLines.length - 1;

  const lines: SplitLine[] = rawLines.map((line, lineIndex) => {
    const rawWords = granularity === "line" ? [line] : line.split(" ");
    const lastWord = rawWords.length - 1;

    const words: SplitWord[] = rawWords.map((word, indexInLine) => {
      const isFinalWord = lineIndex === lastLine && indexInLine === lastWord;

      // "char" splits into graphemes; the coarser modes keep the box whole.
      const units = granularity === "char" ? graphemes(word) : [word];
      const gradientFrom =
        gradientDigits && isFinalWord && granularity === "char"
          ? gradientStartIndex(units)
          : units.length;

      const characters = units.map((char, indexInWord) => {
        const isGradient = indexInWord >= gradientFrom;
        if (isGradient) gradientCount += 1;

        return {
          key: `c-${lineIndex}-${indexInLine}-${indexInWord}`,
          char,
          indexInWord,
          globalIndex: globalIndex++,
          isGradient,
        } satisfies SplitCharacter;
      });

      return {
        key: `w-${lineIndex}-${indexInLine}`,
        text: word,
        index: wordIndex++,
        indexInLine,
        lineIndex,
        characters,
      } satisfies SplitWord;
    });

    return { key: `l-${lineIndex}`, index: lineIndex, words } satisfies SplitLine;
  });

  return {
    lines,
    words: lines.flatMap((line) => line.words),
    charCount: globalIndex,
    gradientCount,
    granularity,
    downgraded,
    profile,
  };
}
