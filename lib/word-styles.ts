import { splitText } from "@/lib/split";
import type { Granularity } from "@/lib/segment";
import type { WordStyle } from "@/lib/types";

/**
 * Keeping per-word styling on the word it was applied to.
 *
 * Styles are stored against a word *index*, which is the only stable handle a
 * split phrase offers — but an index means something different the moment the
 * phrase is edited. Styling IMPOSSIBLE in
 *
 *   BUILD SOMETHING IMPOSSIBLE
 *
 * and then typing REALLY in front of it left the style on index 2, which is now
 * REALLY. The wrong word lit up and the right one went plain, with nothing on
 * screen to explain it.
 *
 * The fix is a diff. Words that survive an edit carry their styling with them;
 * words that cannot be matched confidently lose it. Dropping a style is a
 * visible, undoable nothing — moving one to a word the user never chose is a
 * mystery.
 */

export type SplitOptionsForStyles = {
  granularity: Granularity;
  transform: "none" | "uppercase" | "lowercase";
  gradientDigits: boolean;
};

/** The words a phrase splits into, in the order their indices run. */
function wordsOf(text: string, options: SplitOptionsForStyles): string[] {
  return splitText(text, {
    granularity: options.granularity,
    gradientDigits: options.gradientDigits,
    transform: options.transform,
  }).words.map((word) => word.text);
}

/**
 * Case- and punctuation-insensitive, so "impossible." still matches
 * "IMPOSSIBLE" — an edit that only changes punctuation should not cost the
 * styling.
 */
const normalise = (word: string) =>
  word
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Longest common subsequence over the normalised words.
 *
 * Chosen over a positional or nearest-match heuristic because it is the only
 * cheap approach that gets insertion, deletion and reordering right at the same
 * time — and because it never invents a pairing: every match it reports is a
 * word that is genuinely present in both phrases, in order.
 */
function lcsPairs(before: string[], after: string[]): Map<number, number> {
  const rows = before.length;
  const columns = after.length;

  // A phrase long enough to make this matrix expensive is longer than anything
  // the editor accepts, but the guard keeps a pathological paste cheap.
  if (rows === 0 || columns === 0 || rows * columns > 40_000) return new Map();

  const table: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(columns + 1).fill(0),
  );

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      table[row][column] =
        before[row] === after[column]
          ? table[row + 1][column + 1] + 1
          : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }

  const pairs = new Map<number, number>();
  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (before[row] === after[column]) {
      pairs.set(row, column);
      row += 1;
      column += 1;
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      row += 1;
    } else {
      column += 1;
    }
  }

  return pairs;
}

export type RemapResult = {
  wordStyles: Record<number, WordStyle>;
  /** Styles that had no confident home in the new phrase. */
  dropped: number;
};

/**
 * Moves word styling from one phrasing to the next.
 *
 * An empty new phrase keeps nothing — but the caller decides whether that is a
 * deletion or a half-typed word, which is why `remapWordStyles` is only reached
 * from a committed edit.
 */
export function remapWordStyles(
  before: string,
  after: string,
  wordStyles: Record<number, WordStyle>,
  options: SplitOptionsForStyles,
): RemapResult {
  const styled = Object.keys(wordStyles);
  if (styled.length === 0) return { wordStyles, dropped: 0 };
  if (before === after) return { wordStyles, dropped: 0 };

  const beforeWords = wordsOf(before, options).map(normalise);
  const afterWords = wordsOf(after, options).map(normalise);

  const pairs = lcsPairs(beforeWords, afterWords);

  const next: Record<number, WordStyle> = {};
  let dropped = 0;

  for (const key of styled) {
    const from = Number(key);
    const to = pairs.get(from);
    if (to === undefined) {
      dropped += 1;
      continue;
    }
    next[to] = wordStyles[from];
  }

  return { wordStyles: next, dropped };
}
