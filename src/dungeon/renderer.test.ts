import { describe, expect, it } from "vitest";
import type { Atlas } from "./atlas";
import type { Dungeon } from "./dungeon";
import { bannerTile, wallPieces } from "./dungeonTiles";
import { ZOOM } from "./grid";
import { render, visibleRange, type WallAt } from "./renderer";

// `render` only ever calls `clearRect`, `imageSmoothingEnabled` and `atlas.draw`,
// so a pair of recorders stands in for the canvas without needing a DOM.

interface Drawn {
  tile: string;
  x: number;
  y: number;
}

const recorder = (): { atlas: Atlas; drawn: Drawn[] } => {
  const drawn: Drawn[] = [];
  const atlas = {
    draw: (_ctx: unknown, tile: string, x: number, y: number) => {
      drawn.push({ tile, x, y });
    },
    size: () => ({ w: 16, h: 16 }),
    toCanvas: () => ({}) as HTMLCanvasElement,
    ready: Promise.resolve(),
  } as unknown as Atlas;
  return { atlas, drawn };
};

const ctx = { imageSmoothingEnabled: true, clearRect: () => {} } as unknown as CanvasRenderingContext2D;

/** A dungeon from rows of "." (floor) and "#" (rock). */
const dungeonOf = (rows: string[], seed = 0): Dungeon => ({
  cols: rows[0]?.length ?? 0,
  rows: rows.length,
  seed,
  rooms: [],
  isFloor: (col, row) => rows[row]?.[col] === ".",
});

const ORIGIN = { x: 0, y: 0 };
const wallsOnly = (drawn: Drawn[]): Drawn[] => drawn.filter((d) => !d.tile.startsWith("floor_"));

describe("render, with nothing decided by hand", () => {
  // The game's own path: every call site passes no `wallAt`, and this is what
  // says that path did not move.
  it("draws a wall cell exactly as the autotiler says", () => {
    const dungeon = dungeonOf(["###", "###", "..."]);
    const { atlas, drawn } = recorder();
    render(ctx, atlas, dungeon, ORIGIN, 200, 200);

    const expected = wallPieces(dungeon.isFloor, 1, 1);
    expect(expected.length).toBeGreaterThan(0);
    for (const piece of expected) {
      expect(drawn).toContainEqual({
        tile: piece.tile,
        x: 1 * 16 * ZOOM + piece.dx * ZOOM,
        y: 1 * 16 * ZOOM + piece.dy * ZOOM,
      });
    }
  });

  it("draws a floor tile for every floor cell and no wall over it", () => {
    const { atlas, drawn } = recorder();
    render(ctx, atlas, dungeonOf(["..", ".."]), ORIGIN, 200, 200);
    expect(drawn.filter((d) => d.tile.startsWith("floor_"))).toHaveLength(4);
    expect(wallsOnly(drawn)).toEqual([]);
  });
});

describe("render, with cells decided by hand", () => {
  it("draws the pieces it is handed, at the offsets it is handed", () => {
    const dungeon = dungeonOf(["###", "###", "..."]);
    const { atlas, drawn } = recorder();
    const wallAt: WallAt = (col, row) =>
      col === 1 && row === 1 ? [{ tile: "wall_edge_bottom_left", dx: 0, dy: -12 }] : null;
    render(ctx, atlas, dungeon, ORIGIN, 200, 200, [], wallAt);

    expect(drawn).toContainEqual({
      tile: "wall_edge_bottom_left",
      x: 16 * ZOOM,
      y: 16 * ZOOM - 12 * ZOOM,
    });
    // The autotiler's own answer for that cell is gone, not drawn underneath.
    expect(drawn.some((d) => d.tile === "wall_mid" && d.x === 16 * ZOOM && d.y === 16 * ZOOM)).toBe(false);
  });

  it("leaves a cell it declines to the autotiler", () => {
    const dungeon = dungeonOf(["###", "###", "..."]);
    const { atlas, drawn } = recorder();
    render(ctx, atlas, dungeon, ORIGIN, 200, 200, [], () => null);

    for (const piece of wallPieces(dungeon.isFloor, 1, 1)) {
      expect(drawn.some((d) => d.tile === piece.tile)).toBe(true);
    }
  });

  it("hangs no banner over tiles somebody chose", () => {
    // A seed whose cell (1,1) would otherwise carry a banner, so the assertion
    // is about suppression rather than about the roll coming up empty.
    const seed = Array.from({ length: 4000 }, (_, s) => s).find((s) => bannerTile(1, 1, s) !== null);
    expect(seed).toBeDefined();

    const dungeon = dungeonOf(["###", "###", "..."], seed);
    const banner = bannerTile(1, 1, seed!)!;

    const auto = recorder();
    render(ctx, auto.atlas, dungeon, ORIGIN, 200, 200);
    expect(auto.drawn.some((d) => d.tile === banner)).toBe(true);

    const byHand = recorder();
    render(ctx, byHand.atlas, dungeon, ORIGIN, 200, 200, [], (col, row) =>
      col === 1 && row === 1 ? [{ tile: "wall_mid", dx: 0, dy: 0, face: true }] : null,
    );
    expect(byHand.drawn.some((d) => d.tile === banner)).toBe(false);
  });

  it("draws a hand-placed tile over a floor cell, not instead of it", () => {
    const { atlas, drawn } = recorder();
    render(ctx, atlas, dungeonOf(["..", ".."]), ORIGIN, 200, 200, [], (col, row) =>
      col === 0 && row === 0 ? [{ tile: "crate", dx: 0, dy: 0 }] : null,
    );
    expect(drawn.filter((d) => d.tile.startsWith("floor_"))).toHaveLength(4);
    expect(drawn).toContainEqual({ tile: "crate", x: 0, y: 0 });
  });
});

describe("visibleRange", () => {
  it("keeps a row of margin above, for the lip that overhangs upward", () => {
    const all = visibleRange({ x: 0, y: 0 }, 1000, 1000, 8, 8);
    expect(all).toEqual({ c0: 0, c1: 7, r0: 0, r1: 7 });
  });

  it("stays inside the dungeon however far the camera has scrolled", () => {
    const far = visibleRange({ x: -10_000, y: -10_000 }, 200, 200, 8, 8);
    expect(far.c0).toBeGreaterThanOrEqual(0);
    expect(far.c1).toBeLessThanOrEqual(7);
    expect(far.r0).toBeGreaterThanOrEqual(0);
    expect(far.r1).toBeLessThanOrEqual(7);
  });
});
