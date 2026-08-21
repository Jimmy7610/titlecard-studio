/**
 * mulberry32 — a tiny, fast, seeded PRNG.
 *
 * Everything visual in this app that "looks random" is generated from this so
 * the server and client render identical markup (no hydration mismatch) and a
 * replay produces the exact same motion every time.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}
