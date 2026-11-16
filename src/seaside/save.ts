import { bare, CROPS, RIPE, type CropId, type Plot } from "./garden";
import { ITEMS, startingPack, type Pack } from "./market";

/** What a day by the sea keeps: the pack, and how the garden is growing. */
export interface Save {
  pack: Pack;
  plots: Plot[];
}

export const SAVE_KEY = "seaside:save";

export const freshSave = (plots: number): Save => ({ pack: startingPack(), plots: Array.from({ length: plots }, bare) });

const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Anything unreadable starts the day over rather than half-loading it. */
export function decodeSave(raw: string | null, plots: number): Save {
  const fresh = freshSave(plots);
  if (!raw) return fresh;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    const p = (d.pack ?? {}) as Record<string, unknown>;
    const rawItems = (p.items ?? {}) as Record<string, unknown>;
    const rawSeeds = (p.seeds ?? {}) as Record<string, unknown>;
    const pack: Pack = { coins: count(p.coins), items: {}, seeds: {} };
    for (const i of ITEMS) if (count(rawItems[i])) pack.items[i] = count(rawItems[i]);
    for (const c of CROPS) if (count(rawSeeds[c])) pack.seeds[c] = count(rawSeeds[c]);
    const list = Array.isArray(d.plots) ? d.plots : [];
    const garden = fresh.plots.map((plot, i) => {
      const r = list[i] as Record<string, unknown> | undefined;
      if (!r || typeof r !== "object") return plot;
      const crop = CROPS.includes(r.crop as CropId) ? (r.crop as CropId) : null;
      return {
        dug: r.dug === true,
        crop,
        stage: crop ? Math.min(RIPE, count(r.stage)) : 0,
        watered: crop !== null && r.watered === true,
        grown: crop ? Math.max(0, Number(r.grown) || 0) : 0,
      };
    });
    return { pack, plots: garden };
  } catch {
    return fresh;
  }
}

export const encodeSave = (save: Save): string => JSON.stringify(save);

export function loadSave(plots: number): Save {
  try {
    return decodeSave(localStorage.getItem(SAVE_KEY), plots);
  } catch {
    return freshSave(plots);
  }
}

export function storeSave(save: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, encodeSave(save));
  } catch {
    // storage unavailable — the day just won't be remembered
  }
}
