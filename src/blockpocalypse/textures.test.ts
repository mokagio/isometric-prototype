import { describe, expect, it } from "vitest";
import { SPECS } from "./blocks";
import { ATLAS_COLUMNS, TILE, tileUv } from "./textures";

/**
 * Only the addressing is tested here: painting needs a canvas, and this
 * project's tests run in node. The tiles themselves are checked by looking at
 * them — which is how the brick painter was caught drawing its running bond
 * across the whole atlas and over its neighbours' tiles.
 */
describe("tileUv", () => {
  const rows = Math.ceil(SPECS.length / ATLAS_COLUMNS);

  it("keeps every block inside the atlas", () => {
    SPECS.forEach((_, block) => {
      const { u0, v0, u1, v1 } = tileUv(block);
      expect(u0).toBeGreaterThanOrEqual(0);
      expect(v0).toBeGreaterThanOrEqual(0);
      expect(u1).toBeLessThanOrEqual(1);
      expect(v1).toBeLessThanOrEqual(1);
      expect(u1).toBeGreaterThan(u0);
      expect(v1).toBeGreaterThan(v0);
    });
  });

  it("gives every block a tile of its own", () => {
    const seen = new Set<string>();
    SPECS.forEach((_, block) => {
      const { u0, v0 } = tileUv(block);
      const key = `${Math.round(u0 * 1e4)}:${Math.round(v0 * 1e4)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    });
    expect(seen.size).toBe(SPECS.length);
  });

  it("insets off the seam by half a texel, so nearest sampling cannot bleed", () => {
    const { u0, u1 } = tileUv(1);
    const width = 1 / ATLAS_COLUMNS;
    expect(u0 - width).toBeCloseTo(0.5 / TILE / ATLAS_COLUMNS, 6);
    expect(2 * width - u1).toBeCloseTo(0.5 / TILE / ATLAS_COLUMNS, 6);
  });

  it("reads the atlas top row first, since canvas rows run the other way", () => {
    expect(tileUv(0).v1).toBeCloseTo(1 - 0.5 / TILE / rows, 6);
    expect(tileUv(ATLAS_COLUMNS).v1).toBeLessThan(tileUv(0).v0);
  });
});
