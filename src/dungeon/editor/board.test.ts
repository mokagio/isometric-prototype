import { describe, expect, it } from "vitest";
import { Board } from "./board";

describe("Board", () => {
  it("starts as solid rock", () => {
    const board = new Board(4, 3);
    expect(board.snapshot().flat().some(Boolean)).toBe(false);
  });

  it("digs a square brush around the cursor", () => {
    const board = new Board(6, 6);
    board.paint(2, 2, 1, true);
    expect(board.isFloor(1, 1)).toBe(true);
    expect(board.isFloor(3, 3)).toBe(true);
    expect(board.isFloor(4, 2)).toBe(false);
  });

  it("clips a brush that runs off the edge instead of wrapping", () => {
    const board = new Board(4, 4);
    board.paint(0, 0, 2, true);
    expect(board.isFloor(0, 0)).toBe(true);
    expect(board.isFloor(3, 3)).toBe(false);
    expect(board.snapshot()).toHaveLength(4);
  });

  it("fills back in", () => {
    const board = new Board(4, 4);
    board.paint(1, 1, 1, true);
    board.paint(1, 1, 0, false);
    expect(board.isFloor(1, 1)).toBe(false);
    expect(board.isFloor(0, 0)).toBe(true);
  });

  it("reads anything off the board as rock", () => {
    const board = new Board(3, 3);
    board.paint(1, 1, 5, true);
    expect(board.isFloor(-1, 1)).toBe(false);
    expect(board.isFloor(3, 1)).toBe(false);
  });

  it("restores a saved board", () => {
    const board = new Board(3, 2, [
      [false, true, false],
      [true, false, false],
    ]);
    expect(board.isFloor(1, 0)).toBe(true);
    expect(board.isFloor(0, 1)).toBe(true);
    expect(board.isFloor(0, 0)).toBe(false);
  });

  it("hands the renderer a dungeon it can draw unchanged", () => {
    const board = new Board(5, 5);
    board.paint(2, 2, 0, true);
    const dungeon = board.asDungeon();
    expect(dungeon.cols).toBe(5);
    expect(dungeon.isFloor(2, 2)).toBe(true);
    expect(dungeon.rooms).toEqual([]);
  });

  it("clears the whole board", () => {
    const board = new Board(4, 4);
    board.paint(2, 2, 2, true);
    board.clear();
    expect(board.snapshot().flat().some(Boolean)).toBe(false);
  });
});
