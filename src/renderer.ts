import { DRAW, project, SX, SY, SZ, type Origin } from "./iso";
import type { Tileset } from "./tileset";
import type { World } from "./world";

/** Tiles per side needed to cover a viewport, with margin for the raised terrain. */
export function gridSizeFor(viewW: number, viewH: number): { cols: number; rows: number } {
  // A diamond-shaped map leaves triangular gaps at the rectangle's corners, so
  // oversize it: half-width plus half-height in tiles covers the far corners,
  // with extra for the raised terrain climbing up the screen.
  const span = Math.ceil(viewW / (2 * SX) + viewH / (2 * SY)) + 8;
  return { cols: span, rows: span };
}

/** Places the map's centre column near the viewport centre. */
export function originFor(world: World, viewW: number, viewH: number): Origin {
  const cCol = world.cols / 2;
  const cRow = world.rows / 2;
  return {
    x: viewW / 2 - (cCol - cRow) * SX,
    y: viewH / 2 - (cCol + cRow) * SY + world.cell(cCol | 0, cRow | 0).height * SZ * 0.5,
  };
}

export function render(
  ctx: CanvasRenderingContext2D,
  tileset: Tileset,
  world: World,
  origin: Origin,
  viewW: number,
  viewH: number,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, viewW, viewH);

  // Back-to-front: row-major then col-minor is the painter's order for the iso
  // grid; within a column, bottom cube first so caps land on top of their body.
  for (let row = 0; row < world.rows; row++) {
    for (let col = 0; col < world.cols; col++) {
      const cell = world.cells[row]![col]!;
      for (let z = 0; z <= cell.height; z++) {
        const tile = z === cell.height ? cell.surface : world.body;
        const apex = project(col, row, z, origin);
        const drawX = apex.x - SX;
        const drawY = apex.y;
        if (drawX > viewW || drawX + DRAW < 0 || drawY > viewH || drawY + DRAW < 0) continue;
        const [sx, sy, sw, sh] = tileset.rect(...tile);
        ctx.drawImage(tileset.image, sx, sy, sw, sh, drawX, drawY, DRAW, DRAW);
      }
    }
  }
}
