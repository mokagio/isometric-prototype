import { describe, expect, it } from "vitest";
import { generateLevel, GROUND_TOP, standable } from "./level";

const SEEDS = [1, 7, 42, 1234, 99999];

describe("generateLevel", () => {
  it("builds the same city twice from the same seed", () => {
    expect(generateLevel(42).world.data).toEqual(generateLevel(42).world.data);
    expect(generateLevel(42).world.data).not.toEqual(generateLevel(43).world.data);
  });

  it.each(SEEDS)("leaves the player somewhere to stand at spawn (seed %i)", (seed) => {
    const level = generateLevel(seed);
    expect(standable(level.world, level.spawnX, level.spawnY)).toBe(true);
  });

  it.each(SEEDS)("puts every checkpoint on clear ground (seed %i)", (seed) => {
    const level = generateLevel(seed);
    expect(level.checkpoints.length).toBeGreaterThan(0);
    for (const point of level.checkpoints) {
      expect(standable(level.world, point.x, point.y)).toBe(true);
    }
  });

  it.each(SEEDS)("never wakes a zombie inside a block (seed %i)", (seed) => {
    const level = generateLevel(seed);
    expect(level.zombieSpawns.length).toBeGreaterThan(10);
    for (const spawn of level.zombieSpawns) {
      expect(standable(level.world, spawn.x, spawn.y)).toBe(true);
    }
  });

  it.each(SEEDS)("stands the helipad clear at the end of the run (seed %i)", (seed) => {
    const level = generateLevel(seed);
    expect(level.goalX).toBeGreaterThan(level.spawnX + 300);
    expect(level.world.isSolid(Math.floor(level.goalX), Math.floor(level.goalY))).toBe(true);
    expect(level.world.isSolid(Math.floor(level.goalX), Math.floor(level.goalY) + 1)).toBe(false);
  });

  it("gives the opening stretch flat, empty street", () => {
    const level = generateLevel(3);
    for (let x = 0; x < 12; x++) {
      expect(level.world.isSolid(x, GROUND_TOP - 1)).toBe(true);
      expect(level.world.isSolid(x, GROUND_TOP)).toBe(false);
    }
    expect(level.zombieSpawns.every((spawn) => spawn.x > 12)).toBe(true);
  });
});
