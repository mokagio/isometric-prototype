/**
 * What the hero fights with. The sword to start with, then each god's own
 * weapon once that god is beaten. Each has its own power and reach; the bow
 * alone fights at a distance, by loosing an arrow instead of swinging.
 */
export type WeaponId = "sword" | "spear" | "iron" | "ares" | "trident" | "bident" | "bolt" | "scythe" | "bow" | "club";

export interface WeaponStats {
  name: string;
  power: number;
  /** How far past the hero's reach the blow carries, in metres. */
  reach: number;
  ranged?: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponStats> = {
  sword: { name: "Sword", power: 1, reach: 2.4 },
  spear: { name: "Bronze Spear", power: 1, reach: 3.3 },
  iron: { name: "Iron Sword", power: 2, reach: 2.5 },
  ares: { name: "Sword of Ares", power: 2, reach: 2.6 },
  trident: { name: "Trident of Poseidon", power: 2, reach: 3.4 },
  bident: { name: "Bident of Hades", power: 2, reach: 3.2 },
  bolt: { name: "Thunderbolt of Zeus", power: 3, reach: 2.6 },
  scythe: { name: "Scythe of Kronos", power: 3, reach: 3.0 },
  bow: { name: "Bow of Artemis", power: 2, reach: 2.4, ranged: true },
  club: { name: "Club of Kratos", power: 3, reach: 2.8 },
};

/** Which god's weapon is which. */
export const WEAPON_OF: Record<string, WeaponId> = {
  ares: "ares",
  poseidon: "trident",
  hades: "bident",
  zeus: "bolt",
  kronos: "scythe",
  artemis: "bow",
  kratos: "club",
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

/** The weapons a merchant sells, and for how much. */
export const WEAPON_PRICES: Partial<Record<WeaponId, number>> = { spear: 30, iron: 70 };

/** The sword, anything bought, and every beaten god's weapon, in that order. */
export function ownedWeapons(beaten: readonly string[], bought: readonly WeaponId[] = []): WeaponId[] {
  return WEAPON_IDS.filter((w) => w === "sword" || bought.includes(w) || beaten.some((god) => WEAPON_OF[god] === w));
}

/** How hard a blow lands: the weapon's own power, or the armour's if a god's whole kit hits harder. */
export function blowPower(weapon: WeaponId, armourPower: number): number {
  return Math.max(WEAPONS[weapon].power, armourPower);
}

export const ARROW_SPEED = 26;
export const ARROW_RANGE = 30;
