import { DRAW, project, SX, SY, type Origin } from "../iso";
import type { Tileset } from "../tileset";
import { BODY_TILE, type Board } from "./board";
import type { EditorState } from "./sidebar";

export interface Cell {
  col: number;
  row: number;
}

/** Centres the board in the canvas area. */
export function boardOrigin(board: Board, viewW: number, viewH: number): Origin {
  return { x: viewW / 2, y: viewH / 2 - board.size * SY };
}

function diamondPath(ctx: CanvasRenderingContext2D, col: number, row: number, o: Origin): void {
  const a = project(col, row, 0, o); // apex = top corner of the cell's diamond
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(a.x + SX, a.y + SY);
  ctx.lineTo(a.x, a.y + 2 * SY);
  ctx.lineTo(a.x - SX, a.y + SY);
  ctx.closePath();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  tileset: Tileset,
  tile: readonly [number, number],
  col: number,
  row: number,
  z: number,
  o: Origin,
): void {
  const apex = project(col, row, z, o);
  const [sx, sy, sw, sh] = tileset.rect(tile[0], tile[1]);
  ctx.drawImage(tileset.image, sx, sy, sw, sh, apex.x - SX, apex.y, DRAW, DRAW);
}

export function renderEditor(
  ctx: CanvasRenderingContext2D,
  tileset: Tileset,
  board: Board,
  origin: Origin,
  hover: Cell | null,
  state: EditorState,
  viewW: number,
  viewH: number,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, viewW, viewH);

  // Grid guide: every cell's top diamond, faint.
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  for (let row = 0; row < board.size; row++) {
    for (let col = 0; col < board.size; col++) {
      diamondPath(ctx, col, row, origin);
      ctx.stroke();
    }
  }

  // Placed columns, back-to-front (larger col+row is nearer, drawn later).
  const items: { col: number; row: number; height: number; surface: readonly [number, number] }[] = [];
  board.forEach((col, row, column) => items.push({ col, row, ...column }));
  items.sort((a, b) => a.col + a.row - (b.col + b.row));
  for (const it of items) {
    for (let z = 0; z <= it.height; z++) {
      drawTile(ctx, tileset, z === it.height ? it.surface : BODY_TILE, it.col, it.row, z, origin);
    }
  }

  // Hover: a footprint outline, plus (in place mode) a ghost of the brush.
  if (hover && board.inBounds(hover.col, hover.row)) {
    if (state.mode === "place") {
      diamondPath(ctx, hover.col, hover.row, origin);
      ctx.strokeStyle = "rgba(255, 244, 193, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 0.6;
      drawTile(ctx, tileset, state.brush, hover.col, hover.row, state.height, origin);
      ctx.globalAlpha = 1;
    } else {
      diamondPath(ctx, hover.col, hover.row, origin);
      ctx.strokeStyle = "rgba(220, 70, 60, 0.95)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
