import { NO_ARMOR, SLOTS, type Armor, type Kit, type Slot } from "./armor";

/** What a run keeps between visits: purse, kit, and which gods are down. */
export interface Save {
  coins: number;
  armor: Armor;
  beaten: string[];
  /** Bronze pieces bought from the blacksmith, kept while a god's kit is worn over them. */
  bronze: Slot[];
}

export const SAVE_KEY = "gods:save";

export function freshSave(): Save {
  return { coins: 0, armor: { ...NO_ARMOR }, beaten: [], bronze: [] };
}

const KITS: readonly Kit[] = ["none", "bronze", "ares", "poseidon", "hades", "zeus"];

/** Anything unreadable starts the run over rather than half-loading it. */
export function decodeSave(raw: string | null): Save {
  if (!raw) return freshSave();
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return freshSave();
    const d = data as Record<string, unknown>;
    const coins = typeof d.coins === "number" && Number.isFinite(d.coins) && d.coins >= 0 ? Math.floor(d.coins) : 0;
    const armor = { ...NO_ARMOR };
    const rawArmor = (typeof d.armor === "object" && d.armor !== null ? d.armor : {}) as Record<string, unknown>;
    for (const slot of SLOTS) {
      const kit = rawArmor[slot];
      if (typeof kit === "string" && (KITS as readonly string[]).includes(kit)) armor[slot] = kit as Kit;
    }
    const beaten = Array.isArray(d.beaten) ? d.beaten.filter((g): g is string => typeof g === "string") : [];
    // Saves from before the wardrobe only know the bronze being worn.
    const bronze = Array.isArray(d.bronze)
      ? SLOTS.filter((s) => (d.bronze as unknown[]).includes(s))
      : SLOTS.filter((s) => armor[s] === "bronze");
    return { coins, armor, beaten, bronze };
  } catch {
    return freshSave();
  }
}

export function encodeSave(save: Save): string {
  return JSON.stringify(save);
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
    localStorage.setItem(SAVE_KEY, encodeSave(save));
  } catch {
    // storage unavailable — the run just won't be remembered
  }
}
