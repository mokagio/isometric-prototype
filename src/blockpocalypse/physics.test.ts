import { describe, expect, it } from "vitest";
import { CONCRETE } from "./blocks";
import {
  createBody,
  ledgeAhead,
  moveBody,
  overlapsSolid,
  restingOnGround,
} from "./physics";
import { World } from "./world";

/** A 20x20 room with a floor along row 4 and nothing else. */
function floorWorld(): World {
  const world = new World(20, 20);
  world.fill(0, 0, 19, 4, CONCRETE);
  return world;
}

describe("overlapsSolid", () => {
  it("is clear when the box rests exactly on the floor", () => {
    expect(overlapsSolid(floorWorld(), 10, 5, 0.7, 1.7)).toBe(false);
  });

  it("catches a box sunk into the floor", () => {
    expect(overlapsSolid(floorWorld(), 10, 4.5, 0.7, 1.7)).toBe(true);
  });
});

describe("moveBody", () => {
  it("lands a falling body on top of the floor", () => {
    const world = floorWorld();
    const body = createBody(10, 12, 0.7, 1.7);
    for (let tick = 0; tick < 400; tick++) {
      body.vy -= 34 / 120;
      moveBody(world, body, 1 / 120);
    }
    expect(body.y).toBeCloseTo(5, 3);
    expect(body.onGround).toBe(true);
    expect(body.vy).toBe(0);
  });

  it("stops dead against a wall", () => {
    const world = floorWorld();
    world.fill(12, 5, 12, 12, CONCRETE);
    const body = createBody(11.5, 5, 0.7, 1.7);
    body.vx = 20;
    moveBody(world, body, 1 / 60);
    expect(body.hitWall).toBe(true);
    expect(body.vx).toBe(0);
    expect(body.x).toBeCloseTo(12 - 0.35, 3);
  });

  it("does not tunnel through a one-block wall at speed", () => {
    const world = floorWorld();
    world.fill(12, 5, 12, 12, CONCRETE);
    const body = createBody(6, 5, 0.7, 1.7);
    body.vx = 400;
    moveBody(world, body, 1 / 60);
    expect(body.x).toBeLessThan(12);
  });

  it("stops a jump under a ceiling", () => {
    const world = floorWorld();
    world.fill(0, 10, 19, 10, CONCRETE);
    const body = createBody(10, 8, 0.7, 1.7);
    body.vy = 30;
    moveBody(world, body, 1 / 60);
    expect(body.hitCeiling).toBe(true);
    expect(body.vy).toBe(0);
    expect(body.y).toBeCloseTo(10 - 1.7, 3);
  });
});

describe("restingOnGround", () => {
  it("is true on the floor and false one block up", () => {
    const world = floorWorld();
    const standing = createBody(10, 5, 0.7, 1.7);
    const jumping = createBody(10, 6, 0.7, 1.7);
    expect(restingOnGround(world, standing)).toBe(true);
    expect(restingOnGround(world, jumping)).toBe(false);
  });
});

describe("ledgeAhead", () => {
  it("sees the drop at the end of the floor", () => {
    const world = new World(20, 20);
    world.fill(0, 0, 9, 4, CONCRETE);
    const body = createBody(9.5, 5, 0.7, 1.7);
    expect(ledgeAhead(world, body, 1)).toBe(true);
    expect(ledgeAhead(world, body, -1)).toBe(false);
  });
});
