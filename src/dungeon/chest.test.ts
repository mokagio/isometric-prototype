import { describe, expect, it } from "vitest";
import { Chest, OPEN_TIME, placeChest, REACH } from "./chest";
import { findSpawn, generateDungeon, roomCentre, type Dungeon } from "./dungeon";
import { FlowField } from "./flow";

const floodFrom = (dungeon: Dungeon, col: number, row: number): FlowField => {
  const flow = new FlowField(dungeon.cols, dungeon.rows);
  flow.recompute(dungeon.isFloor, col, row);
  return flow;
};

const SEEDS = [1, 7, 42, 1337, 90210];

describe("placeChest", () => {
  it.each(SEEDS)("hides it somewhere she can walk to (seed %i)", (seed) => {
    const dungeon = generateDungeon(64, 48, seed);
    const spawn = findSpawn(dungeon);
    const flow = floodFrom(dungeon, spawn.col, spawn.row);
    const cell = placeChest(flow, dungeon);
    expect(dungeon.isFloor(cell.col, cell.row)).toBe(true);
    expect(Number.isFinite(flow.distance(cell.col, cell.row))).toBe(true);
  });

  // The whole point is that it takes a search. Landing it next door would make
  // the dungeon a formality.
  it.each(SEEDS)("puts it a long way from her start (seed %i)", (seed) => {
    const dungeon = generateDungeon(64, 48, seed);
    const spawn = findSpawn(dungeon);
    const flow = floodFrom(dungeon, spawn.col, spawn.row);
    const cell = placeChest(flow, dungeon);
    expect(flow.distance(cell.col, cell.row)).toBeGreaterThan(20);
  });

  it("picks the furthest room, not merely a far one", () => {
    const dungeon = generateDungeon(64, 48, 7);
    const spawn = findSpawn(dungeon);
    const flow = floodFrom(dungeon, spawn.col, spawn.row);
    const chosen = placeChest(flow, dungeon);
    const furthest = Math.max(
      ...dungeon.rooms
        .map((r) => flow.distance(roomCentre(r).col, roomCentre(r).row))
        .filter((d) => Number.isFinite(d)),
    );
    expect(flow.distance(chosen.col, chosen.row)).toBe(furthest);
  });

  // Builder dungeons carry no rooms, so without the fallback they would be
  // unwinnable.
  it("falls back to the furthest floor cell when there are no rooms", () => {
    const dungeon: Dungeon = {
      cols: 8,
      rows: 3,
      seed: 0,
      rooms: [],
      isFloor: (col, row) => row === 1 && col >= 1 && col <= 6,
    };
    const flow = floodFrom(dungeon, 1, 1);
    expect(placeChest(flow, dungeon)).toEqual({ col: 6, row: 1 });
  });

  it("survives a dungeon with nowhere to stand", () => {
    const dungeon: Dungeon = { cols: 4, rows: 4, seed: 0, rooms: [], isFloor: () => false };
    const flow = floodFrom(dungeon, 0, 0);
    expect(placeChest(flow, dungeon)).toEqual({ col: 0, row: 0 });
  });

  it("ignores a room walled off from her, since she could never reach it", () => {
    // One reachable room at col 1, one sealed at col 6. Only the first qualifies.
    const dungeon: Dungeon = {
      cols: 8,
      rows: 3,
      seed: 0,
      rooms: [
        { col: 1, row: 1, cols: 1, rows: 1 },
        { col: 6, row: 1, cols: 1, rows: 1 },
      ],
      isFloor: (col, row) => row === 1 && (col === 1 || col === 6),
    };
    const flow = floodFrom(dungeon, 1, 1);
    expect(placeChest(flow, dungeon)).toEqual({ col: 1, row: 1 });
  });
});

describe("Chest", () => {
  const at = (): Chest => new Chest({ col: 10, row: 10 });

  it("starts shut", () => {
    const chest = at();
    expect(chest.opening).toBe(false);
    expect(chest.open).toBe(false);
  });

  it("stays shut while she is out of reach", () => {
    const chest = at();
    expect(chest.tryOpen(10 + REACH + 0.2, 10)).toBe(false);
    expect(chest.opening).toBe(false);
  });

  it("opens when she reaches it", () => {
    const chest = at();
    expect(chest.tryOpen(10 + REACH - 0.1, 10)).toBe(true);
    expect(chest.opening).toBe(true);
  });

  it("only fires once, so the win cannot be counted twice", () => {
    const chest = at();
    expect(chest.tryOpen(10, 10)).toBe(true);
    expect(chest.tryOpen(10, 10)).toBe(false);
  });

  it("takes OPEN_TIME for the lid to finish", () => {
    const chest = at();
    chest.tryOpen(10, 10);
    chest.update(OPEN_TIME / 2);
    expect(chest.open).toBe(false);
    chest.update(OPEN_TIME / 2 + 0.01);
    expect(chest.open).toBe(true);
  });

  it("does nothing on update while still shut", () => {
    const chest = at();
    chest.update(10);
    expect(chest.opening).toBe(false);
    expect(chest.open).toBe(false);
  });

  it("measures reach as a circle, not per axis", () => {
    const chest = at();
    const diagonal = REACH / Math.SQRT2 + 0.05; // inside on both axes, outside as a radius
    expect(chest.tryOpen(10 + diagonal, 10 + diagonal)).toBe(false);
  });
});
