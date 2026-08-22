/**
 * Unicode-aware text segmentation.
 *
 * The animation primitives wrap every animated unit in its own `inline-block`.
 * That is safe for a Latin character, and *destructive* for a script whose
 * glyphs shape or reorder across boundaries: an atomic inline box cannot be
 * bidi-reordered and cannot participate in a shaping run. So the unit a phrase
 * is split into is not a free choice — it is derived from the script.
 */

/** What a single animated box holds. */
export type Granularity = "char" | "word" | "line";

export const GRANULARITIES: readonly {
  id: Granularity;
  name: string;
  hint: string;
}[] = [
  { id: "char", name: "Per character", hint: "Finest control. Latin, Cyrillic, Greek." },
  { id: "word", name: "Per word", hint: "Required for shaping and bidi scripts." },
  { id: "line", name: "Per line", hint: "One box for the whole phrase." },
] as const;

/* ------------------------------------------------------------------ *
 * Grapheme segmentation
 * ------------------------------------------------------------------ */

let segmenter: Intl.Segmenter | null | undefined;

function graphemeSegmenter(): Intl.Segmenter | null {
  if (segmenter !== undefined) return segmenter;
  try {
    segmenter =
      typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
        ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
        : null;
  } catch {
    segmenter = null;
  }
  return segmenter;
}

/**
 * Regional indicator pairs, keycaps, ZWJ sequences, variation selectors and
 * combining marks — the cases `Array.from` tears apart. Used only when
 * `Intl.Segmenter` is missing; it is deliberately conservative rather than a
 * reimplementation of UAX #29.
 */
const ZWJ = 0x200d;
const VARIATION_SELECTOR = /[\uFE00-\uFE0F]/u;
const COMBINING = /[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u20D0-\u20F0\uFE20-\uFE2F]/u;
const KEYCAP = /[\u20E3]/u;
const REGIONAL = /[\u{1F1E6}-\u{1F1FF}]/u;

function fallbackGraphemes(source: string): string[] {
  const points = Array.from(source);
  const out: string[] = [];

  for (let i = 0; i < points.length; i += 1) {
    let cluster = points[i];

    // Absorb everything that cannot stand on its own.
    while (i + 1 < points.length) {
      const next = points[i + 1];

      if (next.codePointAt(0) === ZWJ) {
        // ZWJ binds this cluster to whatever follows it.
        cluster += next + (points[i + 2] ?? "");
        i += 2;
        continue;
      }
      if (
        VARIATION_SELECTOR.test(next) ||
        COMBINING.test(next) ||
        KEYCAP.test(next)
      ) {
        cluster += next;
        i += 1;
        continue;
      }
      if (REGIONAL.test(cluster) && REGIONAL.test(next) && Array.from(cluster).length === 1) {
        cluster += next;
        i += 1;
        continue;
      }
      break;
    }

    out.push(cluster);
  }

  return out;
}

/**
 * Splits a string into user-perceived characters.
 *
 * `Intl.Segmenter` is the correct answer and is used whenever it exists;
 * everything else falls back to a hand-rolled cluster walk rather than to
 * `Array.from`, which tears emoji ZWJ sequences and combining marks.
 */
export function graphemes(source: string): string[] {
  if (!source) return [];
  const seg = graphemeSegmenter();
  if (!seg) return fallbackGraphemes(source);
  const out: string[] = [];
  for (const { segment } of seg.segment(source)) out.push(segment);
  return out;
}

/** Grapheme count — what a human means by "how many characters". */
export function graphemeCount(source: string): number {
  return graphemes(source).length;
}

/* ------------------------------------------------------------------ *
 * Script analysis
 * ------------------------------------------------------------------ */

/** Right-to-left scripts: Hebrew, Arabic, Syriac, Thaana, N'Ko, Adlam. */
const RTL_RANGES =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0780-\u07BF\u07C0-\u07FF\u0800-\u085F\u08A0-\u08FF\uFB1D-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF]|[\u{10800}-\u{10FFF}]|[\u{1E800}-\u{1EFFF}]/u;

/**
 * Scripts whose rendering depends on cluster context — cursive joining,
 * reordering vowel signs, or no visible word boundaries. Splitting any of
 * these per character produces visually wrong text, not merely ugly text.
 */
const COMPLEX_RANGES =
  /[\u0900-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u0F00-\u0FFF\u1000-\u109F\u1780-\u17FF\u1800-\u18AF\uA980-\uA9DF\uAA80-\uAADF]/u;

export type ScriptProfile = {
  /** The phrase contains right-to-left characters. */
  rtl: boolean;
  /** The phrase contains a script that shapes or reorders across characters. */
  complex: boolean;
  /** `"rtl"` when the phrase should be laid out right-to-left. */
  direction: "ltr" | "rtl";
  /** Finest granularity that renders this phrase correctly. */
  safeGranularity: Granularity;
};

export function analyseScript(source: string): ScriptProfile {
  const rtl = RTL_RANGES.test(source);
  const complex = COMPLEX_RANGES.test(source);

  return {
    rtl,
    complex,
    direction: rtl ? "rtl" : "ltr",
    // Word boxes keep the shaping run and the bidi run intact: the browser is
    // still free to reorder and join *inside* a single inline-block.
    safeGranularity: rtl || complex ? "word" : "char",
  };
}

/**
 * Clamps a requested granularity to one the script can actually survive.
 * Never returns something finer than the script allows — a silently corrupted
 * phrase is worse than a coarser animation.
 */
export function resolveGranularity(
  source: string,
  requested: Granularity,
): { granularity: Granularity; profile: ScriptProfile; downgraded: boolean } {
  const profile = analyseScript(source);
  const order: Granularity[] = ["char", "word", "line"];

  const requestedRank = order.indexOf(requested);
  const safeRank = order.indexOf(profile.safeGranularity);
  const granularity = requestedRank < safeRank ? profile.safeGranularity : requested;

  return { granularity, profile, downgraded: granularity !== requested };
}

/** Locale-aware casing applied to the source, so the DOM holds the real text. */
export function applyTextTransform(
  source: string,
  transform: "none" | "uppercase" | "lowercase",
): string {
  if (transform === "uppercase") return source.toLocaleUpperCase();
  if (transform === "lowercase") return source.toLocaleLowerCase();
  return source;
}
