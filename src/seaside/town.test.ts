import { describe, expect, it } from "vitest";
import { propById } from "../sunnyside/manifest";
import { groundById } from "../sunnyside/manifest";
import {
  atCounter,
  blocker,
  canFish,
  COLS,
  COUNTER,
  DOCK,
  footprints,
  GARDEN,
  groundAt,
  inGarden,
  PEN,
  ROWS,
  SEA_COL,
  solidGrid,
  START,
  TILE,
  townProps,
} from "./town";

const props = townProps();
const blocked = blocker(solidGrid(props));
const at = (col: number, row: number) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

describe("the seaside town", () => {
  it("paints only brushes and props the library has", () => {
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) expect(groundById(groundAt(col, row))).toBeDefined();
    for (const p of props) expect(propById(p.id), p.id).toBeDefined();
  });

  it("keeps everything on the map and nothing on top of anything else", () => {
    const seen = new Set<string>();
    for (const c of footprints(props)) {
      expect(c.col >= 0 && c.col < COLS && c.row >= 0 && c.row < ROWS, `${c.id} at ${c.col},${c.row}`).toBe(true);
      expect(inGarden(c.col, c.row), `${c.id} in the garden`).toBe(false);
      const key = `${c.col},${c.row}`;
      expect(seen.has(key), `${c.id} overlaps at ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("lets the kid walk the start, the garden, the counter and out to the end of the dock", () => {
    expect(blocked(START)).toBe(false);
    for (let row = GARDEN.row0; row <= GARDEN.row1; row++) for (let col = GARDEN.col0; col <= GARDEN.col1; col++) expect(blocked(at(col, row))).toBe(false);
    expect(blocked(at(COUNTER.col, COUNTER.row))).toBe(false);
    for (let col = DOCK.col0; col <= DOCK.col1 - 1; col++) expect(blocked(at(col, DOCK.row0)), `dock ${col}`).toBe(false);
  });

  it("keeps the kid out of the sea, and in through the pen's gate", () => {
    expect(blocked(at(SEA_COL + 2, DOCK.row0 - 3))).toBe(true);
    expect(blocked(at(PEN.gateCol, PEN.row1))).toBe(false);
    expect(blocked(at(PEN.gateCol + 1, PEN.row1))).toBe(true);
  });

  it("can fish off the end of the dock or the beach, facing the water", () => {
    expect(canFish(at(DOCK.col1, DOCK.row0), "right")).toBe(true);
    expect(canFish(at(SEA_COL - 1, 8), "right")).toBe(true);
    expect(canFish(at(SEA_COL - 1, 8), "left")).toBe(false);
    expect(canFish(START, "right")).toBe(false);
  });

  it("trades from in front of the stall", () => {
    expect(atCounter(at(COUNTER.col, COUNTER.row))).toBe(true);
    expect(atCounter(START)).toBe(false);
  });
});
