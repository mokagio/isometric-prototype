import { CROPS, type CropId } from "./garden";
import { FISH, type FishId } from "./fishing";

/**
 * What the kid carries, and the market stall that buys it and sells seeds.
 */
export type ItemId = CropId | FishId | "egg";
export const ITEMS: readonly ItemId[] = [...CROPS, ...FISH, "egg"];

export const SELL: Record<ItemId, number> = {
  carrot: 10,
  radish: 14,
  cabbage: 22,
  pumpkin: 40,
  sardine: 6,
  mackerel: 10,
  snapper: 18,
  golden: 60,
  egg: 5,
};
export const SEED_PRICE: Record<CropId, number> = { carrot: 4, radish: 6, cabbage: 10, pumpkin: 18 };

export const NAMES: Record<ItemId, string> = {
  carrot: "Carrot",
  radish: "Radish",
  cabbage: "Cabbage",
  pumpkin: "Pumpkin",
  sardine: "Sardine",
  mackerel: "Mackerel",
  snapper: "Snapper",
  golden: "Golden Fish",
  egg: "Egg",
};

export interface Pack {
  coins: number;
  items: Partial<Record<ItemId, number>>;
  seeds: Partial<Record<CropId, number>>;
}

export const startingPack = (): Pack => ({ coins: 10, items: {}, seeds: { carrot: 3 } });

export function add(pack: Pack, item: ItemId, n = 1): void {
  pack.items[item] = (pack.items[item] ?? 0) + n;
}

/** Sell everything carried; hands back how many coins it fetched. */
export function sellAll(pack: Pack): number {
  let earned = 0;
  for (const item of ITEMS) {
    earned += (pack.items[item] ?? 0) * SELL[item];
    delete pack.items[item];
  }
  pack.coins += earned;
  return earned;
}

export function buySeed(pack: Pack, crop: CropId): boolean {
  if (pack.coins < SEED_PRICE[crop]) return false;
  pack.coins -= SEED_PRICE[crop];
  pack.seeds[crop] = (pack.seeds[crop] ?? 0) + 1;
  return true;
}

/** Use up a seed, if there is one. */
export function takeSeed(pack: Pack, crop: CropId): boolean {
  if ((pack.seeds[crop] ?? 0) <= 0) return false;
  pack.seeds[crop]! -= 1;
  return true;
}

/** The next crop with seeds, after `from`, for cycling the seed in hand. */
export function nextSeed(pack: Pack, from: CropId | null): CropId | null {
  const owned = CROPS.filter((c) => (pack.seeds[c] ?? 0) > 0);
  if (owned.length === 0) return null;
  const i = from ? owned.indexOf(from) : -1;
  return owned[(i + 1) % owned.length]!;
}

export const carrying = (pack: Pack): number => ITEMS.reduce((n, i) => n + (pack.items[i] ?? 0), 0);
