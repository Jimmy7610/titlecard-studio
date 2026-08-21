export type SplitCharacter = {
  key: string;
  char: string;
  indexInWord: number;
  /** Index across the whole phrase, ignoring spaces. Drives stagger order. */
  globalIndex: number;
  /**
   * Trailing digits of the final word ("Agent 3" -> "3") carry the
   * background-clip gradient treatment from the reference.
   */
  isGradient: boolean;
};

export type SplitWord = {
  key: string;
  text: string;
  index: number;
  characters: SplitCharacter[];
};

export type SplitTextResult = {
  words: SplitWord[];
  charCount: number;
  gradientCount: number;
};

const EMPTY: SplitTextResult = { words: [], charCount: 0, gradientCount: 0 };

/**
 * Splits a phrase into words and characters.
 *
 * Words become the `overflow: hidden` mask boxes and characters become the
 * transformed children, so every reveal is bounded by the word's own footprint.
 * `Array.from` is used rather than `String#split("")` so astral-plane
 * characters are not torn into surrogate halves.
 */
export function splitText(source: string): SplitTextResult {
  const normalised = source.replace(/\s+/g, " ").trim();
  if (!normalised) return EMPTY;

  const rawWords = normalised.split(" ");
  const lastIndex = rawWords.length - 1;

  // Trailing run of digits in the final word gets the gradient treatment.
  const lastChars = Array.from(rawWords[lastIndex] ?? "");
  let gradientStart = lastChars.length;
  while (gradientStart > 0 && /[0-9]/.test(lastChars[gradientStart - 1])) {
    gradientStart -= 1;
  }

  let globalIndex = 0;
  let gradientCount = 0;

  const words: SplitWord[] = rawWords.map((word, index) => {
    const characters = Array.from(word).map((char, indexInWord) => {
      const isGradient = index === lastIndex && indexInWord >= gradientStart;
      if (isGradient) gradientCount += 1;

      return {
        key: `c-${index}-${indexInWord}-${char}`,
        char,
        indexInWord,
        globalIndex: globalIndex++,
        isGradient,
      } satisfies SplitCharacter;
    });

    return {
      key: `w-${index}-${word}`,
      text: word,
      index,
      characters,
    } satisfies SplitWord;
  });

  return { words, charCount: globalIndex, gradientCount };
}
