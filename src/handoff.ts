// The game and the editor are separate pages, so anything they pass each other
// goes through storage: the editor opens the world you are playing by
// regenerating it from its seed.
const SEED_KEY = "ww:world-seed";

export function rememberWorldSeed(seed: number): void {
  try {
    localStorage.setItem(SEED_KEY, String(seed));
  } catch {
    // storage unavailable (private mode / disabled) — the editor just won't see it
  }
}

export function recallWorldSeed(): number | null {
  try {
    const raw = localStorage.getItem(SEED_KEY);
    if (raw === null || raw.trim() === "") return null; // Number("") is 0, a seed we would then use
    const seed = Number(raw);
    return Number.isInteger(seed) ? seed : null;
  } catch {
    return null;
  }
}
