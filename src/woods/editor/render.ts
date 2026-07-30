import { drawGroundCell, drawProp, type SheetBook } from "../../sunnyside/draw";
import { footprint, isProp, type Asset } from "../../sunnyside/library";
import { groundById, propById } from "../../sunnyside/manifest";
import { FIELD, TILE } from "../field";
import { DEEP_SEA, drawCoastTile, drawIslandGround, fencePosts, type CoastSheets } from "../ground";
import { buildable, canPlace, drawOrder, playedGroundAt, type Island } from "../island";
import { cameraFor, islandOrigin, type Cell } from "./view";

export interface Scene {
  island: Island;
  /** What the cursor is holding: a ground brush, a thing to stand up, or the rubber. */
  holding: Asset | null;
  hover: Cell | null;
  erasing: boolean;
  grid: boolean;
  animT: number;
}

const GRID_LINE = "rgba(255, 255, 255, 0.16)";
const OK_TINT = "rgba(255, 255, 255, 0.35)";
const NO_TINT = "rgba(255, 90, 90, 0.45)";

export function renderEditor(
  ctx: CanvasRenderingContext2D,
  book: SheetBook,
  coast: CoastSheets,
  scene: Scene,
  w: number,
  h: number,
  zoom: number,
): void {
  const { island } = scene;
  ctx.fillStyle = DEEP_SEA;
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;

  const view = { camera: cameraFor(w, h, zoom), zoom, width: w, height: h, animT: scene.animT };
  drawIslandGround(ctx, coast, view, (col, row, at) => {
    const brush = groundById(playedGroundAt(island, col, row));
    if (!brush) return;
    drawGroundCell(ctx, book, brush, col, row, at.x, at.y, zoom);
  });

  const origin = islandOrigin(w, h, zoom);
  const cellAt = (col: number, row: number): { x: number; y: number } => ({
    x: origin.x + col * TILE * zoom,
    y: origin.y + row * TILE * zoom,
  });

  // Whatever stands lower on the island draws last, so a house in front of a
  // tree hides it — the same rule the game sorts its world by. The fence joins
  // them, since it stands on the ground like everything else.
  if (coast.fence.ok) {
    for (const post of fencePosts(view)) {
      drawCoastTile(ctx, coast.fence.img, post.tile, post.at, zoom, post.flipV);
    }
  }
  for (const placed of drawOrder(island)) {
    const prop = propById(placed.id);
    if (!prop) continue;
    const at = cellAt(placed.col, placed.row);
    drawProp(ctx, book, prop, at.x, at.y, zoom, scene.animT);
  }

  if (scene.grid) {
    const step = TILE * zoom;
    ctx.beginPath();
    for (let row = 0; row < FIELD; row++) {
      for (let col = 0; col < FIELD; col++) {
        if (!buildable(col, row)) continue;
        const at = cellAt(col, row);
        ctx.rect(Math.round(at.x) + 0.5, Math.round(at.y) + 0.5, step, step);
      }
    }
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const { hover } = scene;
  if (!hover) return;
  const step = TILE * zoom;

  if (scene.erasing || !scene.holding) {
    const at = cellAt(hover.col, hover.row);
    ctx.fillStyle = scene.erasing ? NO_TINT : OK_TINT;
    ctx.fillRect(at.x, at.y, step, step);
    return;
  }

  if (!isProp(scene.holding)) {
    const at = cellAt(hover.col, hover.row);
    ctx.fillStyle = buildable(hover.col, hover.row) ? OK_TINT : NO_TINT;
    ctx.fillRect(at.x, at.y, step, step);
    return;
  }

  // A held thing shows where it would land, and whether it would fit.
  const prop = scene.holding;
  const at = cellAt(hover.col, hover.row);
  ctx.save();
  ctx.globalAlpha = 0.65;
  drawProp(ctx, book, prop, at.x, at.y, zoom, scene.animT);
  ctx.restore();
  if (!canPlace(island, prop, hover.col, hover.row)) {
    ctx.fillStyle = NO_TINT;
    for (const cell of footprint(prop, hover.col, hover.row)) {
      const c = cellAt(cell.col, cell.row);
      ctx.fillRect(c.x, c.y, step, step);
    }
  }
}
