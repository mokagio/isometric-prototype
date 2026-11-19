import { MAX_EACH, type Pantry, type Snack } from "./pantry";
import { WEAPON_PRICES, type WeaponId } from "./weapons";

/** What a camp's chest gives up: always coins, sometimes something to eat, now and then a weapon. */
export interface Loot {
  coins: number;
  snack: Snack | null;
  weapon: WeaponId | null;
}

export const CHEST_COINS = { min: 6, max: 14 };
export const SNACK_CHANCE = 0.5;
export const WEAPON_CHANCE = 0.25;
/** What soldiers keep in a chest: no honey cake out here. */
export const CHEST_SNACKS: readonly Snack[] = ["bread", "fish", "potion"];

/** Only what the merchants sell turns up, and only what the hero has not got already. */
export function rollLoot(rand: () => number, bought: readonly WeaponId[], pantry: Pantry): Loot {
  const coins = CHEST_COINS.min + Math.floor(rand() * (CHEST_COINS.max - CHEST_COINS.min + 1));
  const room = CHEST_SNACKS.filter((s) => (pantry[s] ?? 0) < MAX_EACH);
  const snack = rand() < SNACK_CHANCE && room.length > 0 ? room[Math.floor(rand() * room.length)]! : null;
  const missing = (Object.keys(WEAPON_PRICES) as WeaponId[]).filter((w) => !bought.includes(w));
  const weapon = rand() < WEAPON_CHANCE && missing.length > 0 ? missing[Math.floor(rand() * missing.length)]! : null;
  return { coins, snack, weapon };
}
