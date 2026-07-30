// The game and the editor are separate pages, so anything they pass each other
// goes through storage: the editor opens the world you are playing by
// regenerating it from its seed, and the game plays the map you just drew.
const SEED_KEY = "ww:world-seed";
const MAP_KEY = "ww:map";

// The stashed map is played on request rather than whenever one is lying around,
// so the game only opens it when you arrive from the editor's Play button. It is
// left in storage afterwards, so reloading keeps you on the same map.
const MAP_PARAM = "map";
const MAP_PARAM_VALUE = "local";

export const PLAY_STASHED_MAP_URL = `index.html?${MAP_PARAM}=${MAP_PARAM_VALUE}`;

export const wantsStashedMap = (search: string): boolean =>
  new URLSearchParams(search).get(MAP_PARAM) === MAP_PARAM_VALUE;

/** Hands a map to the game. False means storage refused it and nothing was passed. */
export function stashMap(text: string): boolean {
  try {
    localStorage.setItem(MAP_KEY, text);
    return true;
  } catch {
    return false;
  }
}

export function recallMap(): string | null {
  try {
    return localStorage.getItem(MAP_KEY);
  } catch {
    return null;
  }
}

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
