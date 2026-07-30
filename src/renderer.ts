import { DRAW, project, SX, type Origin } from "./iso";
import type { Tileset } from "./tileset";
import type { World } from "./world";

// A point actor (e.g. the hero) drawn interleaved with terrain so columns in
// front of its cell occlude it. `draw` runs right after that cell's column.
export interface Entity {
  col: number;
  row: number;
  draw: () => void;
}

export function render(
  ctx: CanvasRenderingContext2D,
  tileset: Tileset,
  world: World,
  origin: Origin,
  viewW: number,
  viewH: number,
  entities: Entity[] = [],
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, viewW, viewH);

  const placed = entities.map((e) => ({ e, col: Math.round(e.col), row: Math.round(e.row) }));

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
      for (const p of placed) if (p.col === col && p.row === row) p.e.draw();
    }
  }
}
