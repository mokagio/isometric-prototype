import { describe, expect, it } from "vitest";
import { blowPower, ownedWeapons, WEAPONS } from "./weapons";

describe("weapons", () => {
  it("starts with the sword and gains each beaten god's weapon", () => {
    expect(ownedWeapons([])).toEqual(["sword"]);
    expect(ownedWeapons(["ares", "invasion"])).toEqual(["sword", "ares"]);
    expect(ownedWeapons(["kratos", "poseidon", "artemis"])).toEqual(["sword", "trident", "bow", "club"]);
  });

  it("adds weapons bought from the weaponsmith", () => {
    expect(ownedWeapons(["ares"], ["iron"])).toEqual(["sword", "iron", "ares"]);
  });

  it("hits with the weapon's power, or the armour's when that is more", () => {
    expect(blowPower("sword", 1)).toBe(1);
    expect(blowPower("sword", 3)).toBe(3);
    expect(blowPower("club", 2)).toBe(WEAPONS.club.power);
  });

  it("gives the long weapons a longer reach than the sword, and only the bow fights at range", () => {
    expect(WEAPONS.trident.reach).toBeGreaterThan(WEAPONS.sword.reach);
    expect(Object.entries(WEAPONS).filter(([, w]) => w.ranged).map(([id]) => id)).toEqual(["bow"]);
  });
});
