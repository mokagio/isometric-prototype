import type { Dungeon } from "./dungeon";

// The builder page hands its map to the game through local storage: one "0"/"1"
// character per cell, one string per row.
const KEY = "ad:build";

export interface Build {
  cols: number;
  rows: number;
  floors: string[];
}

export function encodeBuild(floors: boolean[][]): Build {
  return {
    cols: floors[0]?.length ?? 0,
    rows: floors.length,
    floors: floors.map((row) => row.map((on) => (on ? "1" : "0")).join("")),
  };
}

export function buildToDungeon(build: Build): Dungeon {
  return {
    cols: build.cols,
    rows: build.rows,
    seed: 0,
    rooms: [],
    isFloor: (col, row) => build.floors[row]?.[col] === "1",
  };
}

export function saveBuild(floors: boolean[][]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(encodeBuild(floors)));
  } catch {
    // storage unavailable — the build just won't carry over to the game
  }
}

export function clearBuild(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to do; a stale build is harmless
  }
}

/** The saved build as a playable dungeon, or null when there is none. */
export function loadBuild(): Dungeon | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const build = JSON.parse(raw) as Build;
    if (!build.floors?.some((row) => row.includes("1"))) return null;
    return buildToDungeon(build);
  } catch {
    return null;
  }
}
