import { inArc } from "./bearing";

export type Slot = "helmet" | "chest" | "arms" | "legs";
export const SLOTS: readonly Slot[] = ["helmet", "chest", "arms", "legs"];

/**
 * What a slot is wearing. Bronze is what the blacksmith sells; a god's kit is
 * only ever won, a whole set at once, by beating that god.
 */
export type Kit = "none" | "bronze" | "ares" | "poseidon" | "hades" | "zeus" | "kronos";
export type Armor = Record<Slot, Kit>;

export const NO_ARMOR: Armor = { helmet: "none", chest: "none", arms: "none", legs: "none" };

/** The share of every blow a piece of each kit soaks up. */
export const GUARD: Record<Kit, number> = { none: 0, bronze: 0.12, ares: 0.18, poseidon: 0.2, hades: 0.22, zeus: 0.24, kronos: 0.26 };

export const PRICES: Record<Slot, number> = { helmet: 15, chest: 25, arms: 10, legs: 12 };

export const PIECE_NAMES: Record<Slot, string> = {
  helmet: "Helmet",
  chest: "Breastplate",
  arms: "Bracers",
  legs: "Greaves",
};

export function guard(armor: Armor): number {
  return SLOTS.reduce((sum, slot) => sum + GUARD[armor[slot]], 0);
}

/** Never less than 1: armour makes a hero tougher, not untouchable. */
export function damageTaken(raw: number, armor: Armor): number {
  return Math.max(1, Math.round(raw * (1 - guard(armor))));
}

export function wearsFullKit(armor: Armor, kit: Kit): boolean {
  return SLOTS.every((slot) => armor[slot] === kit);
}

/** A god's whole kit is the one thing that makes the sword hit harder; Zeus's turns it into a lightning bolt, harder still. */
export function swordPower(armor: Armor): number {
  if (wearsFullKit(armor, "zeus") || wearsFullKit(armor, "kronos")) return 3;
  return wearsFullKit(armor, "ares") || wearsFullKit(armor, "poseidon") || wearsFullKit(armor, "hades") ? 2 : 1;
}

/** How wide the raised shield covers, in front of the hero. */
export const SHIELD_ARC = Math.PI * 0.75;

export function shieldStops(
  raised: boolean,
  heroYaw: number,
  hero: { x: number; z: number },
  from: { x: number; z: number },
): boolean {
  return raised && inArc(heroYaw, hero.x, hero.z, from.x, from.z, SHIELD_ARC);
}

export type Purchase =
  | { ok: true; coins: number; armor: Armor }
  | { ok: false; reason: "owned" | "poor" };

export function buy(slot: Slot, coins: number, armor: Armor): Purchase {
  if (armor[slot] !== "none") return { ok: false, reason: "owned" };
  const price = PRICES[slot];
  if (coins < price) return { ok: false, reason: "poor" };
  return { ok: true, coins: coins - price, armor: { ...armor, [slot]: "bronze" } };
}

export function godKit(kit: Exclude<Kit, "none" | "bronze">): Armor {
  return { helmet: kit, chest: kit, arms: kit, legs: kit };
}

/** What the wardrobe offers: nothing, the bronze bought so far, or a whole god's kit. */
export type Outfit = Kit;
export const GOD_KITS: ReadonlyArray<Exclude<Kit, "none" | "bronze">> = ["ares", "poseidon", "hades", "zeus", "kronos"];

/** Every outfit the hero owns: always none, bronze once a piece is bought, and each god's kit once that god is beaten. */
export function outfits(beaten: readonly string[], bronze: readonly Slot[]): Outfit[] {
  return ["none", ...(bronze.length > 0 ? (["bronze"] as const) : []), ...GOD_KITS.filter((k) => beaten.includes(k))];
}

/** What wearing an outfit puts in each slot: bronze only covers the pieces actually bought. */
export function outfitArmor(outfit: Outfit, bronze: readonly Slot[]): Armor {
  if (outfit === "none") return { ...NO_ARMOR };
  if (outfit === "bronze") {
    const armor = { ...NO_ARMOR };
    for (const slot of bronze) armor[slot] = "bronze";
    return armor;
  }
  return godKit(outfit);
}

/** Which outfit the hero has on: a god's when any piece is that god's, bronze when any is bronze. */
export function wornOutfit(armor: Armor): Outfit {
  const worn = SLOTS.map((s) => armor[s]);
  return GOD_KITS.find((k) => worn.includes(k)) ?? (worn.includes("bronze") ? "bronze" : "none");
}
