// The game and the editor are separate pages, so anything they pass each other
// goes through storage: the editor opens the world you are playing by
// regenerating it from its seed, and the game plays the map you just drew.
const SEED_KEY = "ww:world-seed";
const MAP_KEY = "ww:map";
const ISLAND_KEY = "ww:island";
const OUTLINE_KEY = "ww:outline";

// The stashed map is played on request rather than whenever one is lying around,
// so the game only opens it when you arrive from the editor's Play button. It is
// left in storage afterwards, so reloading keeps you on the same map.
const MAP_PARAM = "map";
const MAP_PARAM_VALUE = "local";

export const PLAY_STASHED_MAP_QUERY = `?${MAP_PARAM}=${MAP_PARAM_VALUE}`;
export const PLAY_STASHED_MAP_URL = `game.html${PLAY_STASHED_MAP_QUERY}`;
/** The same stash, handed the other way: the editor opens the map being played. */
export const EDIT_STASHED_MAP_URL = `editor.html${PLAY_STASHED_MAP_QUERY}`;

// Whispering Woods has its own pair, and its own stash: an island is a different
// shape of thing from a Peaceful Plains map, and playing one should never hand
// the other game a file it cannot read.
export const PLAY_STASHED_ISLAND_URL = `woods.html${PLAY_STASHED_MAP_QUERY}`;
export const EDIT_STASHED_ISLAND_URL = `woodsEditor.html${PLAY_STASHED_MAP_QUERY}`;

// The outline is a different thing again: the island's shape rather than what is
// on it, so it has its own stash and neither can be handed over as the other.
// Unlike a map it is not asked for by query — the game wears the last one drawn.
export const OUTLINE_URL = "outline.html";
export const PLAY_DRAWN_OUTLINE_URL = "woods.html";

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

/** Hands an island to Whispering Woods. False means storage refused it. */
export function stashIsland(text: string): boolean {
  try {
    localStorage.setItem(ISLAND_KEY, text);
    return true;
  } catch {
    return false;
  }
}

export function recallIsland(): string | null {
  try {
    return localStorage.getItem(ISLAND_KEY);
  } catch {
    return null;
  }
}

/** Hands a drawn outline to the game. False means storage refused it. */
export function stashOutline(text: string): boolean {
  try {
    localStorage.setItem(OUTLINE_KEY, text);
    return true;
  } catch {
    return false;
  }
}

export function recallOutline(): string | null {
  try {
    return localStorage.getItem(OUTLINE_KEY);
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
