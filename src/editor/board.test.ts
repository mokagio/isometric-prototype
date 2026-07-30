import { describe, expect, it } from "vitest";
import { Board } from "./board";

const GRASS = [1, 1] as const;
const STONE = [0, 4] as const;

describe("Board", () => {
  it("places then erases a cell", () => {
    const b = new Board(10);
    b.place(3, 4, GRASS, 2);
    expect(b.at(3, 4)).toEqual({ surface: GRASS, height: 2 });
    b.erase(3, 4);
    expect(b.at(3, 4)).toBeUndefined();
  });

  it("keeps one column per cell — a second place replaces, never overlaps", () => {
    const b = new Board(10);
    b.place(3, 4, GRASS, 1);
    b.place(3, 4, STONE, 5);
    let count = 0;
    b.forEach(() => count++);
    expect(count).toBe(1);
    expect(b.at(3, 4)).toEqual({ surface: STONE, height: 5 });
  });

  it("ignores out-of-bounds placement", () => {
    const b = new Board(10);
    b.place(-1, 4, GRASS, 0);
    b.place(10, 4, GRASS, 0);
    let count = 0;
    b.forEach(() => count++);
    expect(count).toBe(0);
  });

  it("counts what has been built, so a load can ask before wiping it", () => {
    const b = new Board(10);
    expect(b.placed).toBe(0);
    b.place(1, 1, GRASS, 0);
    b.place(2, 2, GRASS, 0);
    expect(b.placed).toBe(2);
    b.place(2, 2, STONE, 1); // replacing a cell is not a new one
    expect(b.placed).toBe(2);
    b.erase(1, 1);
    expect(b.placed).toBe(1);
    b.clear();
    expect(b.placed).toBe(0);
  });

  it("reports bounds correctly and round-trips (col,row) through forEach", () => {
    const b = new Board(16);
    expect(b.inBounds(0, 0)).toBe(true);
    expect(b.inBounds(15, 15)).toBe(true);
    expect(b.inBounds(16, 0)).toBe(false);
    b.place(12, 7, GRASS, 3);
    b.forEach((col, row) => {
      expect(col).toBe(12);
      expect(row).toBe(7);
    });
  });
});
