import { describe, expect, it } from "vitest";
import { wallPieces, type FloorAt } from "../../dungeonTiles";
import { AROUND_SEP, around, floorRows, windowFloor, FLOOR_CHAR } from "./around";

/** A 5x5 board holding `window` in its middle, with `beyond` filling the ring around it. */
const boardAround = (window: string, beyond: boolean): FloorAt => {
  const inner = windowFloor(window);
  return (col, row) =>
    col >= 1 && col <= 3 && row >= 1 && row <= 3 ? inner(col - 1, row - 1) : beyond;
};

/** Every arrangement of nine cells, as a window. */
const allWindows = (): string[] =>
  Array.from({ length: 512 }, (_, bits) => {
    let out = "";
    for (let i = 0; i < 9; i++) {
      if (i > 0 && i % 3 === 0) out += AROUND_SEP;
      out += (bits >> i) & 1 ? FLOOR_CHAR : "#";
    }
    return out;
  });

describe("around", () => {
  it("writes three rows of three, top to bottom", () => {
    expect(around(windowFloor("###/#../.#."), 1, 1)).toBe("###/#../.#.");
  });

  it("reads anything off the map as rock", () => {
    // Standing in the top-left corner of a board that is floor everywhere else:
    // the row above and the column left of it are off the map. The bounds guard
    // is `FloorAt`'s own, which every one in the codebase carries.
    const bounded: FloorAt = (col, row) => col >= 0 && row >= 0 && col < 8 && row < 8;
    expect(around(bounded, 0, 0)).toBe("###/#../#..");
  });

  it("puts the cell itself in the middle", () => {
    const onlyHere: FloorAt = (col, row) => col === 4 && row === 4;
    expect(around(onlyHere, 4, 4)).toBe("###/#.#/###");
  });
});

describe("the window settles what the autotiler draws", () => {
  // The claim the export format rests on: corrections collected by window are a
  // complete specification, because nothing outside the window can change the
  // answer. If this ever fails, a rule in an exported file is a lie.
  it("gives the same pieces whatever surrounds the window, for all 512 of them", () => {
    const differing: string[] = [];
    for (const window of allWindows()) {
      const inRock = wallPieces(boardAround(window, false), 2, 2);
      const inFloor = wallPieces(boardAround(window, true), 2, 2);
      if (JSON.stringify(inRock) !== JSON.stringify(inFloor)) differing.push(window);
    }
    expect(differing).toEqual([]);
  });

  it("reads back the window it was given", () => {
    for (const window of allWindows()) {
      expect(around(boardAround(window, false), 2, 2)).toBe(window);
    }
  });
});

describe("floorRows", () => {
  it("writes the board one string per row, in the tile tests' alphabet", () => {
    const isFloor: FloorAt = (col, row) => row === 1 && col > 0;
    expect(floorRows(isFloor, 3, 3)).toEqual(["###", "#..", "###"]);
  });

  it("gives a row per row and a character per column", () => {
    const rows = floorRows(() => true, 7, 4);
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row).toHaveLength(7);
  });
});

describe("windowFloor", () => {
  it("reads a window back as the floor test that made it", () => {
    expect(around(windowFloor("###/#../.#."), 1, 1)).toBe("###/#../.#.");
  });

  it("reads outside the window as whatever it was told to", () => {
    expect(windowFloor("...", true)(9, 9)).toBe(true);
    expect(windowFloor("...", false)(9, 9)).toBe(false);
  });
});
