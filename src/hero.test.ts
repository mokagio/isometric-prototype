import { describe, expect, it } from "vitest";
import { Hero, type HeroControls } from "./hero";

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
