import { describe, expect, it } from "vitest";
import { GUARD_SPEED, hurtHero, makeHero, MAX_HP, RUN, startSwing, stepHero, SWING_HIT, SWING_TIME, underBlade } from "./hero";
import { decodeSave, encodeSave, freshSave } from "./save";
import { godKit } from "./armor";

const still = { move: { x: 0, z: 0 }, block: false };

describe("the hero", () => {
  it("connects exactly once per swing", () => {
    const h = makeHero(0, 0, 0);
    startSwing(h);
    let lands = 0;
    for (let t = 0; t < SWING_TIME + 0.1; t += 1 / 60) if (stepHero(h, 1 / 60, still)) lands++;
    expect(lands).toBe(1);
    expect(h.swing).toBe(-1);
  });

  it("cannot start a second swing inside the first", () => {
    const h = makeHero(0, 0, 0);
    expect(startSwing(h)).toBe(true);
    stepHero(h, SWING_HIT / 2, still);
    expect(startSwing(h)).toBe(false);
  });

  it("edges along behind the shield", () => {
    const h = makeHero(0, 0, 0);
    stepHero(h, 1, { move: { x: 0, z: 1 }, block: true });
    expect(h.z).toBeCloseTo(GUARD_SPEED);
    const free = makeHero(0, 0, 0);
    stepHero(free, 1, { move: { x: 0, z: 1 }, block: false });
    expect(free.z).toBeCloseTo(RUN);
  });

  it("keeps facing forward behind the shield while sidestepping", () => {
    const h = makeHero(0, 0, 0);
    stepHero(h, 0.5, { move: { x: 1, z: 0 }, block: true });
    expect(h.yaw).toBe(0);
  });

  it("reaches what is in front, not behind", () => {
    const h = makeHero(0, 0, 0);
    expect(underBlade(h, 0, 2, 0.4)).toBe(true);
    expect(underBlade(h, 0, -2, 0.4)).toBe(false);
  });

  it("falls at nothing left", () => {
    const h = makeHero(0, 0, 0);
    hurtHero(h, MAX_HP, 0, 1, false);
    expect(h.fallen).toBe(0);
    expect(startSwing(h)).toBe(false);
  });
});

describe("the save", () => {
  it("round-trips", () => {
    const save = { coins: 12, armor: godKit("ares"), beaten: ["ares"], bronze: ["helmet" as const, "legs" as const], weapon: "ares" as const, bought: ["spear" as const], potions: 2 };
    expect(decodeSave(encodeSave(save))).toEqual(save);
  });

  it("remembers the bronze worn in a save from before the wardrobe", () => {
    const old = decodeSave(JSON.stringify({ coins: 0, armor: { helmet: "bronze", chest: "none", arms: "bronze", legs: "none" }, beaten: [] }));
    expect(old.bronze).toEqual(["helmet", "arms"]);
  });

  it("starts over on anything it cannot read", () => {
    expect(decodeSave("{nope")).toEqual(freshSave());
    expect(decodeSave(null)).toEqual(freshSave());
  });

  it("drops a kit it has never heard of rather than wearing it", () => {
    const save = decodeSave(JSON.stringify({ coins: 3, armor: { helmet: "apollo", legs: "bronze" } }));
    expect(save.armor.helmet).toBe("none");
    expect(save.armor.legs).toBe("bronze");
  });
});
