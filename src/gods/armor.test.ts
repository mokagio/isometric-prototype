import { describe, expect, it } from "vitest";
import { buy, damageTaken, godKit, GUARD, NO_ARMOR, PRICES, shieldStops, swordPower, type Armor } from "./armor";

const bronze: Armor = { helmet: "bronze", chest: "bronze", arms: "bronze", legs: "bronze" };

describe("armour", () => {
  it("lets a bare hero take a blow in full", () => {
    expect(damageTaken(20, NO_ARMOR)).toBe(20);
  });

  it("soaks up a share of the blow per piece", () => {
    expect(damageTaken(100, { ...NO_ARMOR, helmet: "bronze" })).toBe(100 - GUARD.bronze * 100);
    expect(damageTaken(100, bronze)).toBe(Math.round(100 * (1 - 4 * GUARD.bronze)));
  });

  it("makes Ares's kit tougher than a full bronze set", () => {
    expect(damageTaken(100, godKit("ares"))).toBeLessThan(damageTaken(100, bronze));
  });

  it("never makes a hero untouchable", () => {
    expect(damageTaken(1, godKit("ares"))).toBe(1);
  });

  it("only makes the sword hit harder in the whole of Ares's kit", () => {
    expect(swordPower(bronze)).toBe(1);
    expect(swordPower({ ...godKit("ares"), legs: "bronze" })).toBe(1);
    expect(swordPower(godKit("ares"))).toBe(2);
  });
});

describe("the blacksmith", () => {
  it("swaps coins for a bronze piece", () => {
    const sale = buy("helmet", 40, NO_ARMOR);
    expect(sale).toEqual({ ok: true, coins: 40 - PRICES.helmet, armor: { ...NO_ARMOR, helmet: "bronze" } });
  });

  it("will not sell what you cannot afford", () => {
    expect(buy("chest", PRICES.chest - 1, NO_ARMOR)).toEqual({ ok: false, reason: "poor" });
  });

  it("will not sell a piece you are already wearing, even a god's", () => {
    expect(buy("helmet", 99, { ...NO_ARMOR, helmet: "bronze" })).toEqual({ ok: false, reason: "owned" });
    expect(buy("legs", 99, godKit("ares"))).toEqual({ ok: false, reason: "owned" });
  });
});

describe("the shield", () => {
  const hero = { x: 0, z: 0 };
  it("stops a blow from in front", () => {
    expect(shieldStops(true, 0, hero, { x: 0.5, z: 2 })).toBe(true);
  });
  it("does nothing from behind", () => {
    expect(shieldStops(true, 0, hero, { x: 0, z: -2 })).toBe(false);
  });
  it("does nothing lowered", () => {
    expect(shieldStops(false, 0, hero, { x: 0, z: 2 })).toBe(false);
  });
});
