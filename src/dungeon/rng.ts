/** Deterministic stream of numbers in [0, 1) — mulberry32. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic [0, 1) for a grid position — no state, so it's stable per cell. */
export function hash(col: number, row: number, seed: number): number {
  let h = (col * 374761393 + row * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Pick from `items` by a cell's hash. */
export function pick<T>(items: readonly T[], col: number, row: number, seed: number): T {
  return items[Math.floor(hash(col, row, seed) * items.length)]!;
}
