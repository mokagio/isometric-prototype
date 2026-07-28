import { describe, expect, it } from "vitest";
import { findSpawn, generateWorld, GROUND_HEIGHT, MAX_HEIGHT, WATER_LEVEL, type World } from "./world";

describe("generateWorld (flat — the default)", () => {
  const world = generateWorld(40, 40, 42);

  it("makes every column a single flat level", () => {
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        expect(world.heightAt(col, row)).toBe(GROUND_HEIGHT);
      }
    }
  });

  it("still has both grass and water", () => {
    let grass = 0;
    let water = 0;
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        if (world.cell(col, row).isWater) water++;
        else grass++;
      }
    }
    expect(grass).toBeGreaterThan(0);
    expect(water).toBeGreaterThan(0);
  });

  it("is deterministic for a given seed", () => {
    expect(generateWorld(40, 40, 42).cells).toEqual(world.cells);
    expect(generateWorld(40, 40, 43).cells).not.toEqual(world.cells);
  });

  it("clamps out-of-bounds queries to the edge", () => {
    expect(world.heightAt(-5, -5)).toBe(world.heightAt(0, 0));
    expect(world.heightAt(999, 999)).toBe(world.heightAt(world.cols - 1, world.rows - 1));
  });

  it("reports isWater in step with each cell", () => {
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        expect(world.isWater(col, row)).toBe(world.cell(col, row).isWater);
      }
    }
    expect(world.isWater(-3, -3)).toBe(world.isWater(0, 0)); // clamps like the others
  });
});

describe("generateWorld (terraced — { flat: false })", () => {
  const world = generateWorld(40, 40, 42, { flat: false });

  it("keeps every column within the height range", () => {
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        const h = world.heightAt(col, row);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(MAX_HEIGHT);
      }
    }
  });

  it("caps water columns flat at the water line", () => {
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        if (world.cell(col, row).isWater) {
          expect(world.heightAt(col, row)).toBe(WATER_LEVEL);
        }
      }
    }
  });

  it("actually varies in elevation (stacks levels)", () => {
    const heights = new Set<number>();
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) heights.add(world.heightAt(col, row));
    }
    expect(heights.size).toBeGreaterThan(2);
  });
});

describe("findSpawn", () => {
  const S = 20;
  const centre = 10;

  it("skips a ringed-off island for the mainland", () => {
    // A one-cell island at the centre, moated by water; everything past the moat
    // is one big landmass.
    const isWater = (c: number, r: number): boolean =>
      Math.max(Math.abs(c - centre), Math.abs(r - centre)) === 1;
    const world = { cols: S, rows: S, isWater } as unknown as World;

    const spawn = findSpawn(world);
    expect(world.isWater(spawn.col, spawn.row)).toBe(false);
    expect(spawn).not.toEqual({ col: centre, row: centre }); // not the island
  });

  it("lands on dry ground with room to walk, on a generated world", () => {
    const world = generateWorld(60, 60, 7);
    const spawn = findSpawn(world);
    expect(world.isWater(spawn.col, spawn.row)).toBe(false);

    // The spawn's connected land region should be large, not a pocket.
    const seen = new Set<number>();
    const stack = [spawn];
    while (stack.length) {
      const { col, row } = stack.pop()!;
      const key = row * world.cols + col;
      if (seen.has(key) || col < 0 || row < 0 || col >= world.cols || row >= world.rows) continue;
      if (world.isWater(col, row)) continue;
      seen.add(key);
      stack.push({ col: col + 1, row }, { col: col - 1, row }, { col, row: row + 1 }, { col, row: row - 1 });
    }
    expect(seen.size).toBeGreaterThan(200);
  });
});
