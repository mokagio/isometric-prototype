import { describe, expect, it } from "vitest";
import { generateWorld, GROUND_HEIGHT, MAX_HEIGHT, WATER_LEVEL } from "./world";

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
