import { describe, expect, it } from "vitest";
import { findSpawn, generateDungeon, MARGIN, ROOM_GAP, roomCentre } from "./dungeon";

const SEEDS = [1, 2, 3, 42, 1337, 90210];

describe("generateDungeon", () => {
  it("is deterministic for a seed", () => {
    const a = generateDungeon(40, 30, 7);
    const b = generateDungeon(40, 30, 7);
    for (let row = 0; row < 30; row++) {
      for (let col = 0; col < 40; col++) expect(a.isFloor(col, row)).toBe(b.isFloor(col, row));
    }
  });

  it("differs between seeds", () => {
    const a = generateDungeon(40, 30, 7);
    const b = generateDungeon(40, 30, 8);
    let same = true;
    for (let row = 0; row < 30 && same; row++) {
      for (let col = 0; col < 40 && same; col++) {
        if (a.isFloor(col, row) !== b.isFloor(col, row)) same = false;
      }
    }
    expect(same).toBe(false);
  });

  // Every floor cell needs rock on all sides for the renderer to draw walls from,
  // so nothing may be carved into the outermost ring.
  it.each(SEEDS)("keeps the map edge solid (seed %i)", (seed) => {
    const d = generateDungeon(48, 36, seed);
    for (let col = 0; col < d.cols; col++) {
      for (let row = 0; row < MARGIN; row++) {
        expect(d.isFloor(col, row)).toBe(false);
        expect(d.isFloor(col, d.rows - 1 - row)).toBe(false);
      }
    }
    for (let row = 0; row < d.rows; row++) {
      for (let col = 0; col < MARGIN; col++) {
        expect(d.isFloor(col, row)).toBe(false);
        expect(d.isFloor(d.cols - 1 - col, row)).toBe(false);
      }
    }
  });

  it.each(SEEDS)("keeps rooms apart (seed %i)", (seed) => {
    const rooms = generateDungeon(64, 48, seed).rooms;
    expect(rooms.length).toBeGreaterThan(1);
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i]!;
        const b = rooms[j]!;
        const apart =
          a.col + a.cols + ROOM_GAP <= b.col ||
          b.col + b.cols + ROOM_GAP <= a.col ||
          a.row + a.rows + ROOM_GAP <= b.row ||
          b.row + b.rows + ROOM_GAP <= a.row;
        expect(apart).toBe(true);
      }
    }
  });

  // Corridors are carved room to room in order, so a flood fill from the first
  // room has to reach every other room's centre.
  it.each(SEEDS)("connects every room (seed %i)", (seed) => {
    const d = generateDungeon(64, 48, seed);
    const seen = new Set<number>();
    const key = (col: number, row: number): number => row * d.cols + col;
    const start = findSpawn(d);
    const queue = [start];
    seen.add(key(start.col, start.row));
    while (queue.length > 0) {
      const { col, row } = queue.pop()!;
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const c = col + dc;
        const r = row + dr;
        if (!d.isFloor(c, r) || seen.has(key(c, r))) continue;
        seen.add(key(c, r));
        queue.push({ col: c, row: r });
      }
    }
    for (const room of d.rooms) {
      const c = roomCentre(room);
      expect(seen.has(key(c.col, c.row))).toBe(true);
    }
  });
});

describe("findSpawn", () => {
  it("drops the hero on floor", () => {
    for (const seed of SEEDS) {
      const d = generateDungeon(64, 48, seed);
      const spawn = findSpawn(d);
      expect(d.isFloor(spawn.col, spawn.row)).toBe(true);
    }
  });

  it("falls back to the first floor cell when there are no rooms", () => {
    const dungeon = {
      cols: 4,
      rows: 4,
      seed: 0,
      rooms: [],
      isFloor: (col: number, row: number) => col === 2 && row === 1,
    };
    expect(findSpawn(dungeon)).toEqual({ col: 2, row: 1 });
  });
});
