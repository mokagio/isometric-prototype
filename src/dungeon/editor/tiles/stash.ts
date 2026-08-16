import { FLOOR_CHAR } from "./around";
import type { Corrections } from "./corrections";

// Where the work sits between reloads, so a stray refresh does not throw an
// afternoon away. The file is still the thing that leaves; this is only the
// editor remembering where it had got to.
//
// The floor is kept beside the corrections and not left to be generated again.
// A correction is a ruling about a cell's surroundings, so putting one back over
// a dungeon it was never made against turns every cell stale at once — which is
// exactly what it did before the floor was kept.

const KEY = "ad:tiles";
const VERSION = 1;

export interface Stash {
  floor: string[];
  corrections: Corrections;
}

export function stashWork(floor: string[], corrections: Corrections): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, floor, corrections }));
  } catch {
    // storage unavailable (private mode / disabled) — saving the file still works
  }
}

/** What was left behind last time, or null to start from a fresh dungeon. */
export function recallWork(cols: number, rows: number): Stash | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const held = JSON.parse(raw) as Partial<Stash> & { version?: number };
    if (held.version !== VERSION) return null;
    // A dungeon of another size would put every ruling on the wrong cell.
    if (!Array.isArray(held.floor) || held.floor.length !== rows) return null;
    if (held.floor.some((line) => typeof line !== "string" || line.length !== cols)) return null;
    return { floor: held.floor, corrections: held.corrections ?? {} };
  } catch {
    return null;
  }
}

export function forgetWork(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // as above
  }
}

/** The stashed rows as the grid `Board` is built from. */
export const floorGrid = (floor: string[]): boolean[][] =>
  floor.map((line) => [...line].map((cell) => cell === FLOOR_CHAR));
