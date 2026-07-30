import { describe, expect, it } from "vitest";
import { FIGURE_LEVELS, isHidden, OCCLUSION_WINDOW } from "./occlusion";
import type { World } from "./world";

/** Flat ground at `base`, with `columns` keyed "col,row" standing taller. */
const terrain = (base: number, columns: Record<string, number> = {}): Pick<World, "heightAt"> => ({
  heightAt: (col, row) => columns[`${col},${row}`] ?? base,
});

const FLAT = terrain(0);

describe("isHidden", () => {
  it("leaves a figure on open ground alone", () => {
    expect(isHidden(FLAT, 10, 10, 0)).toBe(false);
  });

  it("hides a figure behind a tower", () => {
    expect(isHidden(terrain(0, { "11,10": 4 }), 10, 10, 0)).toBe(true);
  });

  it("ignores a ledge too low to cover half of it", () => {
    // Boots clipped by a one-level step is ordinary; ghosting on that would
    // flicker across every terrace on the map.
    expect(isHidden(terrain(0, { "11,10": 1 }), 10, 10, 0)).toBe(false);
  });

  it("takes more height to hide from further away", () => {
    // The same column that hides you from one cell away does not from three.
    const height = { "11,10": 2 };
    expect(isHidden(terrain(0, height), 10, 10, 0)).toBe(true);
    expect(isHidden(terrain(0, { "12,11": 2 }), 10, 10, 0)).toBe(false);
    expect(isHidden(terrain(0, { "12,11": 4 }), 10, 10, 0)).toBe(true);
  });

  it("is not fooled by the column the figure stands on", () => {
    // Standing on top of a tower, the tower is behind you, not in front.
    expect(isHidden(terrain(0, { "10,10": 6 }), 10, 10, 6)).toBe(false);
  });

  it("ignores what is behind the figure", () => {
    for (const cell of ["9,10", "10,9", "9,9"]) {
      expect(isHidden(terrain(0, { [cell]: 8 }), 10, 10, 0), cell).toBe(false);
    }
  });

  it("ignores towers too far in front to overlap the sprite", () => {
    const beyond = OCCLUSION_WINDOW + 1;
    expect(isHidden(terrain(0, { [`${10 + beyond},10`]: 8 }), 10, 10, 0)).toBe(false);
  });

  it("stops hiding a figure that climbs level with the wall", () => {
    // Up on the same plateau, the wall is no longer between you and the camera.
    const plateau = terrain(0, { "11,10": 4, "10,10": 4 });
    expect(isHidden(plateau, 10, 10, 0)).toBe(true);
    expect(isHidden(plateau, 10, 10, 4)).toBe(false);
  });

  it("stops hiding a figure that jumps above the wall", () => {
    const wall = terrain(0, { "11,10": 2 });
    expect(isHidden(wall, 10, 10, 0)).toBe(true);
    expect(isHidden(wall, 10, 10, FIGURE_LEVELS)).toBe(false);
  });

  it("leaves a figure on flat high ground alone", () => {
    expect(isHidden(terrain(5), 10, 10, 5)).toBe(false);
  });

  it("takes a fractional position as the cell it stands in", () => {
    // Positions are floats mid-step; the terrain is not.
    const wall = terrain(0, { "11,10": 4 });
    expect(isHidden(wall, 10.4, 9.6, 0)).toBe(true);
  });

  it("reads a figure mid-jump by where its feet are", () => {
    const wall = terrain(0, { "11,10": 3 });
    expect(isHidden(wall, 10, 10, 0)).toBe(true);
    expect(isHidden(wall, 10, 10, 2.5)).toBe(false);
  });
});
