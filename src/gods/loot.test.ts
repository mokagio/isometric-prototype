import { describe, expect, it } from "vitest";
import { CHEST_COINS, CHEST_SNACKS, rollLoot } from "./loot";
import { MAX_EACH } from "./pantry";
import { WEAPON_PRICES, type WeaponId } from "./weapons";

const always = (v: number) => () => v;
const ALL_SOLD = Object.keys(WEAPON_PRICES) as WeaponId[];

describe("a camp chest", () => {
  it("always holds coins, within the range", () => {
    expect(rollLoot(always(0), [], {}).coins).toBe(CHEST_COINS.min);
    expect(rollLoot(always(0.9999), [], {}).coins).toBe(CHEST_COINS.max);
  });

  it("holds food and a weapon on a lucky roll", () => {
    const loot = rollLoot(always(0), [], {});
    expect(CHEST_SNACKS).toContain(loot.snack);
    expect(ALL_SOLD).toContain(loot.weapon);
  });

  it("holds only coins on an unlucky roll", () => {
    const loot = rollLoot(always(0.9999), [], {});
    expect(loot.snack).toBeNull();
    expect(loot.weapon).toBeNull();
  });

  it("never gives a weapon the hero already has", () => {
    expect(rollLoot(always(0), ["spear"], {}).weapon).toBe("iron");
    expect(rollLoot(always(0), ALL_SOLD, {}).weapon).toBeNull();
  });

  it("never gives food the bag has no room for", () => {
    expect(rollLoot(always(0), [], { bread: MAX_EACH }).snack).not.toBe("bread");
    expect(rollLoot(always(0), [], { bread: MAX_EACH, fish: MAX_EACH, potion: MAX_EACH }).snack).toBeNull();
  });
});
