import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FloorAt } from "../../dungeonTiles";
import { floorRows } from "./around";
import { stamp, type Corrections } from "./corrections";
import { floorGrid, forgetWork, recallWork, stashWork } from "./stash";

/** Stands in for `localStorage`, which the node environment has none of. */
class FakeStorage {
  private held = new Map<string, string>();
  broken = false;
  getItem(key: string): string | null {
    if (this.broken) throw new Error("storage unavailable");
    return this.held.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.broken) throw new Error("storage unavailable");
    this.held.set(key, value);
  }
  removeItem(key: string): void {
    if (this.broken) throw new Error("storage unavailable");
    this.held.delete(key);
  }
}

let storage: FakeStorage;
beforeEach(() => {
  storage = new FakeStorage();
  vi.stubGlobal("localStorage", storage);
});

const mapOf =
  (rows: string[]): FloorAt =>
  (col, row) =>
    rows[row]?.[col] === ".";

const ROWS = ["####", "#..#", "#..#", "####"];
const isFloor = mapOf(ROWS);
const floor = floorRows(isFloor, 4, 4);

describe("stashWork and recallWork", () => {
  it("puts the floor by with the rulings made against it", () => {
    const corrections = stamp(isFloor, {}, 1, 0, "wall_edge_left");
    stashWork(floor, corrections);
    const back = recallWork(4, 4);
    expect(back?.floor).toEqual(ROWS);
    expect(back?.corrections).toEqual(corrections);
  });

  it("has nothing to give back before anything is stashed", () => {
    expect(recallWork(4, 4)).toBeNull();
  });

  it("refuses a stash for a dungeon of another size", () => {
    // The bug this exists for: rulings restored over a dungeon they were never
    // made against sit on the wrong cells and read as stale, every one of them.
    stashWork(floor, stamp(isFloor, {}, 1, 0, "wall_mid"));
    expect(recallWork(40, 30)).toBeNull();
    expect(recallWork(4, 5)).toBeNull();
  });

  it("refuses rows that are not the width they claim", () => {
    stashWork(["####", "##", "####", "####"], {});
    expect(recallWork(4, 4)).toBeNull();
  });

  it("forgets on being told to", () => {
    stashWork(floor, {});
    forgetWork();
    expect(recallWork(4, 4)).toBeNull();
  });

  it("survives storage being unavailable rather than losing the page", () => {
    storage.broken = true;
    expect(() => stashWork(floor, {})).not.toThrow();
    expect(() => forgetWork()).not.toThrow();
    expect(recallWork(4, 4)).toBeNull();
  });

  it("gives nothing back for damaged JSON", () => {
    storage.setItem("ad:tiles", "{not json");
    expect(recallWork(4, 4)).toBeNull();
  });

  it("walks past a stash from before the floor was kept", () => {
    // What the first cut wrote: rulings on their own. Restoring those over a
    // freshly generated dungeon is what put a red grid over somebody's screen.
    storage.setItem("ad:tiles", JSON.stringify(stamp(isFloor, {}, 1, 0, "wall_mid")));
    expect(recallWork(4, 4)).toBeNull();
  });
});

describe("floorGrid", () => {
  it("reads the rows back as the grid a board is built from", () => {
    const grid = floorGrid(ROWS);
    expect(grid).toHaveLength(4);
    expect(grid[1]).toEqual([false, true, true, false]);
  });

  it("round-trips a floor through the stash unchanged", () => {
    const corrections: Corrections = {};
    stashWork(floor, corrections);
    const back = recallWork(4, 4)!;
    const grid = floorGrid(back.floor);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) expect(grid[row]![col]).toBe(isFloor(col, row));
    }
  });
});
