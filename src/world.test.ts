import { describe, expect, it } from "vitest";
import { generateWorld, MAX_HEIGHT, WATER_LEVEL } from "./world";

describe("generateWorld", () => {
  const world = generateWorld(40, 40, 42);

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

  it("is deterministic for a given seed", () => {
    const again = generateWorld(40, 40, 42);
    expect(again.heightAt(12, 7)).toBe(world.heightAt(12, 7));
    expect(generateWorld(40, 40, 43).cells).not.toEqual(world.cells);
  });

  it("clamps out-of-bounds queries to the edge", () => {
    expect(world.heightAt(-5, -5)).toBe(world.heightAt(0, 0));
    expect(world.heightAt(999, 999)).toBe(world.heightAt(world.cols - 1, world.rows - 1));
  });
});
