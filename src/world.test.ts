import { describe, expect, it } from "vitest";
import {
  blocksTile,
  findSpawn,
  generateWorld,
  GROUND_HEIGHT,
  isHazardTile,
  isLiquidTile,
  MAX_HEIGHT,
  WATER_LEVEL,
  type Tile,
  type World,
} from "./world";

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
        if (isLiquidTile(world.cell(col, row).surface)) water++;
        else grass++;
      }
    }
    expect(grass).toBeGreaterThan(0);
    expect(water).toBeGreaterThan(0);
  });

  it("generates rivers and ponds that stop the hero, and nothing that hurts", () => {
    // Lava is the only hazard, and the generator never lays any: a random world
    // can be crossed on foot or not at all, never at the cost of hearts.
    let blocked = 0;
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        expect(world.isHazard(col, row)).toBe(false);
        if (world.blocks(col, row)) blocked++;
      }
    }
    expect(blocked).toBeGreaterThan(0);
  });

  it("is deterministic for a given seed", () => {
    expect(generateWorld(40, 40, 42).cells).toEqual(world.cells);
    expect(generateWorld(40, 40, 43).cells).not.toEqual(world.cells);
  });

  it("clamps out-of-bounds queries to the edge", () => {
    expect(world.heightAt(-5, -5)).toBe(world.heightAt(0, 0));
    expect(world.heightAt(999, 999)).toBe(world.heightAt(world.cols - 1, world.rows - 1));
  });

  it("reads what is underfoot straight off the surface tile", () => {
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        const { surface } = world.cell(col, row);
        expect(world.isHazard(col, row)).toBe(isHazardTile(surface));
        expect(world.blocks(col, row)).toBe(blocksTile(surface));
      }
    }
    expect(world.isHazard(-3, -3)).toBe(world.isHazard(0, 0)); // clamps like the others
  });
});

describe("generateWorld (dry — { water: false })", () => {
  // What the games list is drawn on: grass to every corner, no shore in sight.
  const world = generateWorld(40, 40, 42, { water: false });

  it("lays no water at all", () => {
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        expect(isLiquidTile(world.cell(col, row).surface), `${col},${row}`).toBe(false);
      }
    }
  });

  it("still sprinkles the grass, so it does not read as one flat colour", () => {
    const surfaces = new Set<string>();
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) surfaces.add(world.cell(col, row).surface.join(","));
    }
    expect(surfaces.size).toBeGreaterThan(1);
  });

  it("stays flat, so the field has no cliffs in it", () => {
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) expect(world.heightAt(col, row)).toBe(GROUND_HEIGHT);
    }
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
        if (isLiquidTile(world.cell(col, row).surface)) {
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

  /** A world where `sea` cells are the given kind of liquid and the rest is grass. */
  const worldOf = (kind: "blocks" | "isHazard", sea: (c: number, r: number) => boolean): World =>
    ({
      cols: S,
      rows: S,
      blocks: kind === "blocks" ? sea : () => false,
      isHazard: kind === "isHazard" ? sea : () => false,
    }) as unknown as World;

  const moat = (c: number, r: number): boolean => Math.max(Math.abs(c - centre), Math.abs(r - centre)) === 1;

  it("skips a ringed-off island for the mainland", () => {
    // A one-cell island at the centre, moated; everything past the moat is one
    // big landmass.
    const world = worldOf("blocks", moat);
    const spawn = findSpawn(world);
    expect(world.blocks(spawn.col, spawn.row)).toBe(false);
    expect(spawn).not.toEqual({ col: centre, row: centre }); // not the island
  });

  it("treats a hazard moat as sea too, so the hero does not wake in lava", () => {
    // Hazards are crossable, so the island is reachable — but waking up stood in
    // it would spend hearts before the player had touched a key.
    const world = worldOf("isHazard", moat);
    const spawn = findSpawn(world);
    expect(world.isHazard(spawn.col, spawn.row)).toBe(false);
    expect(spawn).not.toEqual({ col: centre, row: centre });
  });

  it("lands on safe ground with room to walk, on a generated world", () => {
    const world = generateWorld(60, 60, 7);
    const spawn = findSpawn(world);
    expect(world.isHazard(spawn.col, spawn.row)).toBe(false);
    expect(world.blocks(spawn.col, spawn.row)).toBe(false);

    // The spawn's connected safe region should be large, not a pocket.
    const seen = new Set<number>();
    const stack = [spawn];
    while (stack.length) {
      const { col, row } = stack.pop()!;
      const key = row * world.cols + col;
      if (seen.has(key) || col < 0 || row < 0 || col >= world.cols || row >= world.rows) continue;
      if (world.isHazard(col, row) || world.blocks(col, row)) continue;
      seen.add(key);
      stack.push({ col: col + 1, row }, { col: col - 1, row }, { col, row: row + 1 }, { col, row: row - 1 });
    }
    expect(seen.size).toBeGreaterThan(200);
  });
});

describe("what a tile does underfoot", () => {
  const WATER: Tile = [0, 10];
  const LAVA: Tile = [3, 10];
  const TEAL: Tile = [1, 10];
  const PURPLE: Tile = [2, 10];
  const GRASS_TILE: Tile = [1, 1];

  it("lets the hero wade lava, and only lava", () => {
    expect(isHazardTile(LAVA)).toBe(true);
    expect(blocksTile(LAVA)).toBe(false);
  });

  it("keeps water and the teal and purple pools as walls", () => {
    for (const tile of [WATER, TEAL, PURPLE]) {
      expect(blocksTile(tile), `${tile}`).toBe(true);
      expect(isHazardTile(tile), `${tile}`).toBe(false);
    }
  });

  it("leaves solid ground alone on both counts", () => {
    expect(isHazardTile(GRASS_TILE)).toBe(false);
    expect(blocksTile(GRASS_TILE)).toBe(false);
  });

  it("splits the liquids between the two, sparing none", () => {
    // Every pool either hurts or blocks; a liquid that did neither would look
    // like water and behave like grass.
    for (let col = 0; col < 4; col++) {
      const tile: Tile = [col, 10];
      expect(isLiquidTile(tile)).toBe(true);
      expect(isHazardTile(tile) !== blocksTile(tile)).toBe(true);
    }
  });
});
