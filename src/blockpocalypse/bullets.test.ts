import { describe, expect, it } from "vitest";
import { AIR, CONCRETE, GLASS } from "./blocks";
import { stepBullet, type Bullet } from "./bullets";
import { createBody } from "./physics";
import { World } from "./world";

function shot(x: number, y: number, vx: number): Bullet {
  return { x, y, vx, vy: 0, life: 0.7 };
}

describe("stepBullet", () => {
  it("punches a hole through glass", () => {
    const world = new World(30, 30);
    world.set(6, 5, GLASS);
    const outcome = stepBullet(world, shot(5.5, 5.5, 42), [], 1 / 60);
    expect(outcome).toMatchObject({ kind: "wall", broke: true, block: GLASS });
    expect(world.get(6, 5)).toBe(AIR);
  });

  it("stops against concrete and leaves it standing", () => {
    const world = new World(30, 30);
    world.set(6, 5, CONCRETE);
    const outcome = stepBullet(world, shot(5.5, 5.5, 42), [], 1 / 60);
    expect(outcome).toMatchObject({ kind: "wall", broke: false });
    expect(world.get(6, 5)).toBe(CONCRETE);
  });

  it("does not skip a wall a whole step wide at full speed", () => {
    const world = new World(60, 30);
    world.set(30, 5, CONCRETE);
    const bullet = shot(5.5, 5.5, 42);
    const world2 = world;
    let outcome = stepBullet(world2, bullet, [], 1 / 60);
    while (outcome.kind === "flying") outcome = stepBullet(world2, bullet, [], 1 / 60);
    expect(outcome.kind).toBe("wall");
  });

  it("reports which target it met first", () => {
    const world = new World(60, 30);
    const near = { body: createBody(6, 5, 0.8, 1.7) };
    const far = { body: createBody(20, 5, 0.8, 1.7) };
    const outcome = stepBullet(world, shot(5.5, 5.5, 42), [far, near], 1 / 60);
    expect(outcome).toMatchObject({ kind: "hit", index: 1 });
  });

  it("passes under a target it is aimed below", () => {
    const world = new World(60, 30);
    const target = { body: createBody(6, 8, 0.8, 1.7) };
    expect(stepBullet(world, shot(5.5, 5.5, 42), [target], 1 / 60).kind).toBe("flying");
  });

  it("expires when its life runs out", () => {
    const world = new World(60, 30);
    expect(stepBullet(world, { x: 5, y: 5, vx: 1, vy: 0, life: 0.001 }, [], 1 / 60).kind).toBe(
      "expired",
    );
  });
});
