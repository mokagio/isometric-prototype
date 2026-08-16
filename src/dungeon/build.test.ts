import { describe, expect, it } from "vitest";
import { buildToDungeon, encodeBuild } from "./build";

describe("encodeBuild", () => {
  it("writes one character per cell", () => {
    expect(
      encodeBuild([
        [false, true, false],
        [true, true, false],
      ]),
    ).toEqual({ cols: 3, rows: 2, floors: ["010", "110"] });
  });

  it("survives an empty board", () => {
    expect(encodeBuild([])).toEqual({ cols: 0, rows: 0, floors: [] });
  });
});

describe("buildToDungeon", () => {
  it("round-trips a painted board", () => {
    const floors = [
      [false, true, false],
      [true, true, false],
    ];
    const dungeon = buildToDungeon(encodeBuild(floors));
    for (let row = 0; row < floors.length; row++) {
      for (let col = 0; col < floors[row]!.length; col++) {
        expect(dungeon.isFloor(col, row)).toBe(floors[row]![col]);
      }
    }
  });

  it("reads anything off the map as solid rock", () => {
    const dungeon = buildToDungeon({ cols: 2, rows: 2, floors: ["11", "11"] });
    expect(dungeon.isFloor(-1, 0)).toBe(false);
    expect(dungeon.isFloor(0, -1)).toBe(false);
    expect(dungeon.isFloor(2, 0)).toBe(false);
    expect(dungeon.isFloor(0, 2)).toBe(false);
  });
});
