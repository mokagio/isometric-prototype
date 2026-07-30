import { describe, expect, it } from "vitest";
import { Hero, KNOCKBACK, type HeroControls } from "./hero";

// Minimal terrain: heights come from a function, sized 20x20.
const terrain = (heightAt: (c: number, r: number) => number) =>
  ({ cols: 20, rows: 20, heightAt }) as unknown as Parameters<Hero["update"]>[2];

const NONE: HeroControls = { axis: { dc: 0, dr: 0 }, jump: false };
const DT = 1 / 60;

function run(hero: Hero, world: ReturnType<typeof terrain>, frames: number, ctrl: HeroControls): void {
  for (let i = 0; i < frames; i++) hero.update(DT, ctrl, world);
}

describe("Hero", () => {
  it("spawns grounded on the surface", () => {
    const hero = new Hero(5, 5, terrain(() => 3));
    expect(hero.z).toBe(3);
    expect(hero.grounded).toBe(true);
  });

  it("climbs a one-level step up onto a terrace", () => {
    const world = terrain((c) => (c >= 6 ? 1 : 0));
    const hero = new Hero(5, 5, world);
    run(hero, world, 20, { axis: { dc: 1, dr: 0 }, jump: false });
    expect(Math.round(hero.col)).toBeGreaterThanOrEqual(6);
    expect(hero.z).toBe(1);
    expect(hero.grounded).toBe(true);
  });

  it("is blocked by a wall taller than one level", () => {
    const world = terrain((c) => (c >= 6 ? 2 : 0));
    const hero = new Hero(5, 5, world);
    run(hero, world, 60, { axis: { dc: 1, dr: 0 }, jump: false });
    expect(Math.round(hero.col)).toBe(5); // never entered the taller cell
    expect(hero.z).toBe(0);
  });

  it("jumps up and lands back on the ground", () => {
    const world = terrain(() => 0);
    const hero = new Hero(5, 5, world);
    let maxZ = 0;
    hero.update(DT, { axis: { dc: 0, dr: 0 }, jump: true }, world); // launch once
    for (let i = 0; i < 60; i++) {
      hero.update(DT, NONE, world);
      maxZ = Math.max(maxZ, hero.z);
    }
    expect(maxZ).toBeGreaterThan(0.5);
    expect(hero.z).toBe(0);
    expect(hero.grounded).toBe(true);
  });

  it("falls when it walks off a ledge", () => {
    const world = terrain((c) => (c >= 6 ? 0 : 3));
    const hero = new Hero(5, 5, world);
    run(hero, world, 60, { axis: { dc: 1, dr: 0 }, jump: false });
    expect(Math.round(hero.col)).toBeGreaterThanOrEqual(6);
    expect(hero.z).toBe(0);
    expect(hero.grounded).toBe(true);
  });
});

describe("Hero.knockback", () => {
  const FLAT = terrain(() => 0);

  it("shoves the hero the way it is pointed", () => {
    const hero = new Hero(5, 5, FLAT);
    hero.knockback(1, 0);
    run(hero, FLAT, 60, NONE);
    expect(hero.col).toBeGreaterThan(5);
    expect(hero.row).toBe(5);
  });

  it("covers the knockback distance", () => {
    const hero = new Hero(5, 5, FLAT);
    hero.knockback(0, -1);
    run(hero, FLAT, 120, NONE);
    expect(5 - hero.row).toBeCloseTo(KNOCKBACK, 2);
  });

  it("covers the same ground however the frames are sliced", () => {
    // A velocity integrated per frame would overshoot at low frame rates.
    const smooth = new Hero(5, 5, FLAT);
    smooth.knockback(1, 0);
    run(smooth, FLAT, 240, NONE);

    const choppy = new Hero(5, 5, FLAT);
    choppy.knockback(1, 0);
    for (let i = 0; i < 12; i++) choppy.update(1 / 5, NONE, FLAT);

    expect(choppy.col).toBeCloseTo(smooth.col, 2);
  });

  it("sizes the shove by the constant, not by how hard it was pushed", () => {
    const gentle = new Hero(5, 5, FLAT);
    gentle.knockback(1, 0);
    const hard = new Hero(5, 5, FLAT);
    hard.knockback(1000, 0);
    run(gentle, FLAT, 120, NONE);
    run(hard, FLAT, 120, NONE);
    expect(hard.col).toBeCloseTo(gentle.col, 6);
  });

  it("settles instead of sliding forever", () => {
    const hero = new Hero(5, 5, FLAT);
    hero.knockback(1, 0);
    run(hero, FLAT, 120, NONE);
    const settled = hero.col;
    run(hero, FLAT, 60, NONE);
    expect(hero.col).toBe(settled);
  });

  it("cannot shove the hero through a wall", () => {
    const world = terrain((c) => (c >= 6 ? 2 : 0));
    const hero = new Hero(5, 5, world);
    hero.knockback(1, 0);
    run(hero, world, 120, NONE);
    expect(Math.round(hero.col)).toBe(5);
  });

  it("ignores a shove with no direction", () => {
    const hero = new Hero(5, 5, FLAT);
    hero.knockback(0, 0);
    run(hero, FLAT, 60, NONE);
    expect(hero.col).toBe(5);
    expect(hero.row).toBe(5);
  });
});

describe("Hero and liquid", () => {
  /** Flat land where every column from 6 on is the given kind of liquid. */
  const shoreAt6 = (kind: "blocks" | "isHazard"): Parameters<Hero["update"]>[2] =>
    ({
      cols: 20,
      rows: 20,
      heightAt: () => 0,
      blocks: kind === "blocks" ? (c: number) => c >= 6 : () => false,
      isHazard: kind === "isHazard" ? (c: number) => c >= 6 : () => false,
    }) as unknown as Parameters<Hero["update"]>[2];

  const EAST = { axis: { dc: 1, dr: 0 }, jump: false };

  it("cannot step into a pool that blocks", () => {
    const world = shoreAt6("blocks");
    const hero = new Hero(5, 5, world);
    run(hero, world, 60, EAST);
    expect(Math.round(hero.col)).toBe(5); // stopped at the shore
  });

  it("wades straight into water and lava", () => {
    // They cost hearts, not passage — `hazard.ts` does the charging.
    const world = shoreAt6("isHazard");
    const hero = new Hero(5, 5, world);
    run(hero, world, 60, EAST);
    expect(hero.col).toBeGreaterThan(6);
  });

  it("is stopped by a wall even when the ground beyond it hurts", () => {
    // A hazard behind a wall is still behind a wall.
    const world = {
      cols: 20,
      rows: 20,
      heightAt: () => 0,
      blocks: (c: number) => c === 6,
      isHazard: (c: number) => c > 6,
    } as unknown as Parameters<Hero["update"]>[2];
    const hero = new Hero(5, 5, world);
    run(hero, world, 60, EAST);
    expect(Math.round(hero.col)).toBe(5);
  });
});
