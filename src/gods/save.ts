import { NO_ARMOR, SLOTS, type Armor, type Kit, type Slot } from "./armor";
import { WEAPON_IDS, type WeaponId } from "./weapons";
import { MAX_EACH, SNACKS, type Pantry } from "./pantry";

/** What a run keeps between visits: purse, kit, and which gods are down. */
export interface Save {
  coins: number;
  armor: Armor;
  beaten: string[];
  /** Bronze pieces bought from the blacksmith, kept while a god's kit is worn over them. */
  bronze: Slot[];
  /** The weapon in hand: the sword, or a beaten god's. */
  weapon: WeaponId;
  /** Weapons bought from a merchant. */
  bought: WeaponId[];
  /** Food and potions carried, by kind. */
  pantry: Pantry;
  /** Bought from the cartographer. */
  compass: boolean;
  map: boolean;
}

export const SAVE_KEY = "gods:save";

export function freshSave(): Save {
  return { coins: 0, armor: { ...NO_ARMOR }, beaten: [], bronze: [], weapon: "sword", bought: [], pantry: {}, compass: false, map: false };
}

const KITS: readonly Kit[] = ["none", "bronze", "ares", "poseidon", "hades", "zeus", "kronos", "artemis", "kratos", "hydra", "medusa", "minotaur"];

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
    const weapon = WEAPON_IDS.includes(d.weapon as WeaponId) ? (d.weapon as WeaponId) : "sword";
    const bought = Array.isArray(d.bought) ? WEAPON_IDS.filter((w) => (d.bought as unknown[]).includes(w)) : [];
    const pantry: Pantry = {};
    const rawPantry = (typeof d.pantry === "object" && d.pantry !== null ? d.pantry : {}) as Record<string, unknown>;
    for (const snack of SNACKS) {
      const n = rawPantry[snack];
      if (typeof n === "number" && n > 0) pantry[snack] = Math.min(MAX_EACH, Math.floor(n));
    }
    // Saves from before the pantry carried potions on their own.
    if (typeof d.potions === "number" && d.potions > 0 && !pantry.potion) pantry.potion = Math.min(MAX_EACH, Math.floor(d.potions));
    return { coins, armor, beaten, bronze, weapon, bought, pantry, compass: d.compass === true, map: d.map === true };
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
