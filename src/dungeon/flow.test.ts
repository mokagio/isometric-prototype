import { describe, expect, it } from "vitest";
import { FlowField, lineClear, type FloorAt } from "./flow";

/** A map from rows of "." (floor) and "#" (rock). */
const mapOf = (rows: string[]): { isFloor: FloorAt; cols: number; rows: number } => ({
  isFloor: (col, row) => rows[row]?.[col] === ".",
  cols: rows[0]?.length ?? 0,
  rows: rows.length,
});

const fieldFor = (rows: string[], goalCol: number, goalRow: number): FlowField => {
  const map = mapOf(rows);
  const flow = new FlowField(map.cols, map.rows);
  flow.recompute(map.isFloor, goalCol, goalRow);
  return flow;
};

// Two rooms sharing only a corridor along the bottom. An enemy in the top-left
// corner has to give up ground before it can gain any.
const TWO_ROOMS = [
  "###########",
  "#....#....#",
  "#....#....#",
  "#....#....#",
  "#.........#",
  "###########",
];

describe("FlowField.recompute", () => {
  it("counts steps out from the goal", () => {
    const flow = fieldFor(["#####", "#...#", "#####"], 1, 1);
    expect(flow.distance(1, 1)).toBe(0);
    expect(flow.distance(2, 1)).toBe(1);
    expect(flow.distance(3, 1)).toBe(2);
  });

  it("measures the way round, not the way through", () => {
    const flow = fieldFor(TWO_ROOMS, 1, 1);
    // Four cells apart on screen, but the only way across is down and back up.
    expect(flow.distance(6, 1)).toBe(11);
  });

  it("reads rock and anything walled off as unreachable", () => {
    const flow = fieldFor(["#####", "#.#.#", "#####"], 1, 1);
    expect(flow.distance(2, 1)).toBe(Infinity);
    expect(flow.distance(3, 1)).toBe(Infinity);
    expect(flow.distance(-1, 0)).toBe(Infinity);
  });

  it("leaves the field empty when the goal is in the rock", () => {
    const flow = fieldFor(["#####", "#...#", "#####"], 0, 0);
    expect(flow.distance(1, 1)).toBe(Infinity);
  });

  it("clears the last flood rather than blending into it", () => {
    const map = mapOf(TWO_ROOMS);
    const flow = new FlowField(map.cols, map.rows);
    flow.recompute(map.isFloor, 1, 1);
    flow.recompute(map.isFloor, 9, 1);
    expect(flow.distance(9, 1)).toBe(0);
    expect(flow.distance(1, 1)).toBe(14); // down 3, across 8, up 3
  });
});

describe("FlowField.next", () => {
  it("gives nothing at the goal, or from somewhere cut off", () => {
    const flow = fieldFor(["#####", "#.#.#", "#####"], 1, 1);
    expect(flow.next(1, 1)).toBeNull();
    expect(flow.next(3, 1)).toBeNull();
  });

  // The bug this whole field exists for: an enemy pressed into the far corner
  // of one room, with the hero in the other, used to sit there against the wall.
  it("walks out of a corner and round through the corridor", () => {
    const map = mapOf(TWO_ROOMS);
    const flow = new FlowField(map.cols, map.rows);
    flow.recompute(map.isFloor, 9, 1);

    let at = { col: 1, row: 1 };
    const walked: string[] = [];
    for (let step = 0; step < 40; step++) {
      const next = flow.next(at.col, at.row);
      if (!next) break;
      at = next;
      walked.push(`${at.col},${at.row}`);
    }
    expect(at).toEqual({ col: 9, row: 1 });
    expect(walked).toContain("5,4"); // through the corridor, not across the wall
  });

  it("always steps closer, never sideways or back", () => {
    const map = mapOf(TWO_ROOMS);
    const flow = new FlowField(map.cols, map.rows);
    flow.recompute(map.isFloor, 9, 1);
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        const next = flow.next(col, row);
        if (!next) continue;
        expect(flow.distance(next.col, next.row)).toBeLessThan(flow.distance(col, row));
      }
    }
  });

  it("refuses a diagonal that squeezes between two corners", () => {
    // The goal is diagonally adjacent, but both cells beside it are rock.
    const flow = fieldFor(["....", ".#..", "..#.", "...."], 2, 1);
    expect(flow.next(1, 2)).not.toEqual({ col: 2, row: 1 });
  });
});

describe("FlowField.cellsInRange", () => {
  it("returns only reachable cells, within the band", () => {
    const flow = fieldFor(["#####", "#...#", "#.#.#", "#####"], 1, 1);
    const cells = flow.cellsInRange(2, 3);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      const d = flow.distance(cell.col, cell.row);
      expect(d).toBeGreaterThanOrEqual(2);
      expect(d).toBeLessThanOrEqual(3);
    }
  });

  it("is empty when nothing is that far out", () => {
    expect(fieldFor(["###", "#.#", "###"], 1, 1).cellsInRange(5, 9)).toEqual([]);
  });
});

describe("lineClear", () => {
  const open = mapOf(["......", "......", "......"]).isFloor;
  const split = mapOf(["......", "..##..", "......"]).isFloor;

  it("passes across open floor", () => {
    expect(lineClear(open, 1, 1, 4, 1, 0.3)).toBe(true);
  });

  it("fails through rock", () => {
    expect(lineClear(split, 2, 0, 2, 2, 0.3)).toBe(false);
  });

  it("counts the body's width, not just its centre", () => {
    // The centre line grazes the corner of the rock at (2, 1); a body of any
    // width does not fit through.
    expect(lineClear(split, 1, 0, 3, 2, 0.3)).toBe(false);
  });

  it("is true for a zero-length line on open floor", () => {
    expect(lineClear(open, 2, 1, 2, 1, 0.3)).toBe(true);
  });
});
