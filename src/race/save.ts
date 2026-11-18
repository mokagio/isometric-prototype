import { CARS, carsUnlocked } from "./ladder";

/** How far up the ladder a run has climbed, which kart is picked, and the best time on each rung. */
export interface Save {
  won: number;
  car: number;
  /** Best finishing time per rung, in seconds; missing or 0 means never finished first. */
  best: number[];
}

export const SAVE_KEY = "race:save";

export function freshSave(): Save {
  return { won: 0, car: 0, best: [] };
}

/** Anything unreadable starts over rather than half-loading. */
export function decodeSave(raw: string | null): Save {
  if (!raw) return freshSave();
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (typeof d !== "object" || d === null) return freshSave();
    const won = whole(d.won);
    const car = Math.min(whole(d.car), carsUnlocked(won) - 1, CARS.length - 1);
    const best = Array.isArray(d.best) ? d.best.map((b) => (typeof b === "number" && Number.isFinite(b) && b > 0 ? b : 0)) : [];
    return { won, car, best };
  } catch {
    return freshSave();
  }
}

function whole(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

/** Records a race: a win on the highest open rung climbs the ladder, and a faster win sets a best. */
export function recordWin(save: Save, rung: number, time: number): { climbed: boolean; best: boolean } {
  const climbed = rung === save.won;
  if (climbed) save.won++;
  const prev = save.best[rung] ?? 0;
  const best = prev === 0 || time < prev;
  if (best) {
    while (save.best.length <= rung) save.best.push(0);
    save.best[rung] = time;
  }
  return { climbed, best };
}

export function loadSave(): Save {
  try {
    return decodeSave(localStorage.getItem(SAVE_KEY));
  } catch {
    return freshSave();
  }
}

export function storeSave(save: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // storage unavailable — the ladder just won't be remembered
  }
}
