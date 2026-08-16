import type { Atlas } from "./atlas";
import type { Dungeon } from "./dungeon";
import { bannerTile, floorTile, wallPieces, type Piece } from "./dungeonTiles";
import { CELL, project, ZOOM, type Origin } from "./grid";

/**
 * What a cell is built from when somebody has decided by hand. `null` leaves it
 * to the autotiler, which is every cell in the game — only the tile editor ever
 * answers with anything else.
 */
export type WallAt = (col: number, row: number) => Piece[] | null;

// A figure drawn between the wall rows, so walls in front of it (a larger row)
// paint over it. `draw` runs right after its own row's walls.
export interface Entity {
  row: number;
  draw: () => void;
}

/** Cells overlapping the viewport, with a margin for the wall lip that overhangs upward. */
export function visibleRange(
  origin: Origin,
  viewW: number,
  viewH: number,
  cols: number,
  rows: number,
): { c0: number; c1: number; r0: number; r1: number } {
  const clamp = (n: number, hi: number): number => Math.max(0, Math.min(hi, n));
  return {
    c0: clamp(Math.floor(-origin.x / CELL), cols - 1),
    c1: clamp(Math.ceil((viewW - origin.x) / CELL), cols - 1),
    r0: clamp(Math.floor(-origin.y / CELL) - 1, rows - 1),
    r1: clamp(Math.ceil((viewH - origin.y) / CELL) + 1, rows - 1),
  };
}

export function render(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  dungeon: Dungeon,
  origin: Origin,
  viewW: number,
  viewH: number,
  entities: Entity[] = [],
  wallAt?: WallAt,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, viewW, viewH);

  const { c0, c1, r0, r1 } = visibleRange(origin, viewW, viewH, dungeon.cols, dungeon.rows);
  const seed = dungeon.seed;

  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (!dungeon.isFloor(col, row)) continue;
      const p = project(col, row, origin);
      atlas.draw(ctx, floorTile(col, row, seed), p.x, p.y, ZOOM);
    }
  }

  const placed = entities.map((e) => ({ e, row: Math.round(e.row) }));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const drawn = wallAt?.(col, row) ?? null;
      const pieces = drawn ?? wallPieces(dungeon.isFloor, col, row);
      if (pieces.length === 0) continue;
      const p = project(col, row, origin);
      for (const piece of pieces) {
        atlas.draw(ctx, piece.tile, p.x + piece.dx * ZOOM, p.y + piece.dy * ZOOM, ZOOM);
      }
      // A banner rolled onto a hand-drawn cell would land over a tile somebody
      // chose, so only a cell left to the autotiler gets one.
      if (!drawn && pieces.some((piece) => piece.face)) {
        const banner = bannerTile(col, row, seed);
        if (banner) atlas.draw(ctx, banner, p.x, p.y, ZOOM);
      }
    }
    for (const p of placed) if (p.row === row) p.e.draw();
  }
}
