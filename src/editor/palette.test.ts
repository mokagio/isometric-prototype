import { describe, expect, it } from "vitest";
import { PALETTE } from "./palette";
import { isLiquidTile } from "../world";

describe("editor palette", () => {
  it("offers a brush for water, since a lake is the point of a pool tile", () => {
    const water = PALETTE.find((e) => e.label === "Water");
    expect(water).toBeDefined();
    expect(isLiquidTile(water!.tile)).toBe(true);
  });

  it("names every impassable brush as a pool, so nothing walkable-sounding blocks", () => {
    // A label like "Blue Crystal" on an impassable tile reads as decoration and
    // sends you looking for a water brush that then turns out to be walkable.
    for (const entry of PALETTE) {
      const pool = /water|pool|lava/i.test(entry.label);
      expect(pool, `${entry.label} ${entry.tile}`).toBe(isLiquidTile(entry.tile));
    }
  });

  it("has no duplicate brushes", () => {
    const keys = PALETTE.map((e) => e.tile.join(","));
    expect(new Set(keys).size).toBe(PALETTE.length);
  });
});
