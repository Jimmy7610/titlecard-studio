import { mulberry32 } from "@/lib/random";

export type GlyphPoolId = "blocks" | "ascii" | "katakana" | "binary" | "hex";

export type GlyphPool = {
  id: GlyphPoolId;
  name: string;
  chars: string;
};

export const GLYPH_POOLS: readonly GlyphPool[] = [
  { id: "blocks", name: "Blocks", chars: "█▓▒░▄▀▌▐■□▪▫▬▲▼◆◇" },
  { id: "ascii", name: "ASCII", chars: "!<>-_\\/[]{}=+*^?#%&@$~;:.," },
  {
    id: "katakana",
    name: "Katakana",
    chars: "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ",
  },
  { id: "binary", name: "Binary", chars: "01" },
  { id: "hex", name: "Hex", chars: "0123456789ABCDEF" },
] as const;

const POOL_INDEX = new Map(GLYPH_POOLS.map((pool) => [pool.id, pool]));

/** Falls back to the first pool; see the note on getPalette. */
export function getGlyphPool(id: GlyphPoolId): GlyphPool {
  return POOL_INDEX.get(id) ?? GLYPH_POOLS[0];
}

/**
 * Pre-rolls the glyph sequence a single character cycles through.
 *
 * Generating the whole sequence up front — rather than picking inside the
 * tween's onUpdate — keeps the scramble identical on every replay and makes the
 * rendered glyph a pure function of timeline progress.
 */
export function glyphSequence(
  pool: string,
  length: number,
  seed: number,
): string[] {
  const chars = Array.from(pool);
  const rand = mulberry32(seed * 2246822519 + 17);
  let previous = -1;

  return Array.from({ length }, () => {
    let pick = Math.floor(rand() * chars.length);
    // Never repeat a glyph twice in a row; a stalled character reads as a
    // rendering bug rather than a decode.
    if (pick === previous) pick = (pick + 1) % chars.length;
    previous = pick;
    return chars[pick];
  });
}
