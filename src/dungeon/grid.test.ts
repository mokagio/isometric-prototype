import { describe, expect, it } from "vitest";
import { CELL, centre, project, unproject } from "./grid";
import { visibleRange } from "./renderer";

const origin = { x: 100, y: 60 };

describe("project and unproject", () => {
  it("puts a cell's top-left corner a whole cell along each axis", () => {
    expect(project(0, 0, origin)).toEqual({ x: 100, y: 60 });
    expect(project(3, 2, origin)).toEqual({ x: 100 + 3 * CELL, y: 60 + 2 * CELL });
  });

  it("round-trips every point inside a cell back to that cell", () => {
    for (const [dx, dy] of [
      [0, 0],
      [1, 1],
      [CELL - 1, CELL - 1],
      [CELL / 2, CELL / 2],
    ]) {
      const p = project(4, 7, origin);
      expect(unproject(p.x + dx!, p.y + dy!, origin)).toEqual({ col: 4, row: 7 });
    }
  });

  it("puts the feet anchor in the middle of the cell", () => {
    expect(centre(0, 0, origin)).toEqual({ x: 100 + CELL / 2, y: 60 + CELL / 2 });
  });
});

describe("visibleRange", () => {
  it("covers the whole viewport", () => {
    const range = visibleRange({ x: 0, y: 0 }, CELL * 4, CELL * 3, 40, 30);
    expect(range.c0).toBe(0);
    expect(range.c1).toBeGreaterThanOrEqual(4);
    expect(range.r1).toBeGreaterThanOrEqual(3);
  });

  it("keeps a row of margin above, for the wall lip that overhangs upward", () => {
    const range = visibleRange({ x: 0, y: -CELL * 10 }, CELL * 4, CELL * 3, 40, 30);
    expect(range.r0).toBe(9);
  });

  it("never runs off the map", () => {
    const range = visibleRange({ x: -CELL * 500, y: -CELL * 500 }, 800, 600, 40, 30);
    expect(range.c0).toBeLessThanOrEqual(39);
    expect(range.c1).toBe(39);
    expect(range.r1).toBe(29);
    expect(range.r0).toBeGreaterThanOrEqual(0);
  });
});
