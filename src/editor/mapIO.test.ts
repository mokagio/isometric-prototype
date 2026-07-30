import { describe, expect, it } from "vitest";
import { Board } from "./board";
import { boardToMap, mapFilename } from "./mapIO";
import { cellAt, countEmpty, decodeMap, encodeMap, isComplete } from "../mapFormat";
import type { Tile } from "../world";

const GRASS: Tile = [1, 1];
const STONE: Tile = [0, 4];

describe("boardToMap", () => {
  it("turns an untouched board into a map of nothing but gaps", () => {
    const map = boardToMap(new Board(8));
    expect(map.cols).toBe(8);
    expect(map.rows).toBe(8);
    expect(countEmpty(map)).toBe(64);
  });

  it("puts each placed column at its own grid position", () => {
    const board = new Board(8);
    board.place(1, 0, GRASS, 0);
    board.place(0, 1, STONE, 3);
    const map = boardToMap(board);
    expect(cellAt(map, 1, 0)).toEqual({ height: 0, surface: GRASS });
    expect(cellAt(map, 0, 1)).toEqual({ height: 3, surface: STONE });
    expect(countEmpty(map)).toBe(62);
  });

  it("does not mix up columns and rows", () => {
    // A board indexed the other way round would put this cell at (2, 5).
    const board = new Board(8);
    board.place(5, 2, GRASS, 0);
    expect(cellAt(boardToMap(board), 5, 2)).not.toBeNull();
    expect(cellAt(boardToMap(board), 2, 5)).toBeNull();
  });

  it("calls a fully painted board complete", () => {
    const board = new Board(4);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) board.place(col, row, GRASS, 0);
    expect(isComplete(boardToMap(board))).toBe(true);
  });

  it("survives the round trip out to a file and back", () => {
    const board = new Board(6);
    board.place(0, 0, GRASS, 0);
    board.place(5, 5, STONE, 4);
    board.place(3, 2, GRASS, 2);
    const map = boardToMap(board);
    expect(decodeMap(encodeMap(map))).toEqual(map);
  });
});

describe("mapFilename", () => {
  it("dates the file by the local day, not UTC", () => {
    // Late evening local time is already tomorrow in UTC; the name must not skip a day.
    const evening = new Date(2026, 6, 30, 23, 30);
    expect(mapFilename(evening)).toBe("whispering-woods-2026-07-30.json");
  });

  it("pads single-digit months and days", () => {
    expect(mapFilename(new Date(2026, 0, 5))).toBe("whispering-woods-2026-01-05.json");
  });
});
