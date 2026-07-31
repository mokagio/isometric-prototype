import { blitFrame, frameAt, type Sheet } from "../sprites";
import { isProp, variantAt, type Asset, type Ground, type Prop, type TileRef } from "./library";
import { SHEETS, type SheetId } from "./sheets";

// Painting library assets onto a canvas. The editor and the game both come
// through here, so a cell someone paints is the cell they later walk on.

/** The sheets a caller has loaded. Anything missing simply does not draw. */
export type SheetBook = Partial<Record<SheetId, Sheet>>;

const GRID = 16; // the cell the world is laid out on, whatever a sheet's own cell size is

/** Draw one cell of a sheet with its top-left corner at `(x, y)`, blown up by `scale`. */
export function drawSheetTile(
  ctx: CanvasRenderingContext2D,
  book: SheetBook,
  id: SheetId,
  ref: TileRef,
  x: number,
  y: number,
  scale: number,
): void {
  const sheet = book[id];
  if (!sheet?.ok) return;
  const { cellW, cellH } = SHEETS[id];
  const w = cellW * scale;
  const h = cellH * scale;
  const dx = Math.round(x);
  const dy = Math.round(y);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (ref.flip === "v") {
    // The pack flips a handful of roof tiles rather than drawing them twice.
    ctx.translate(0, dy + h);
    ctx.scale(1, -1);
    ctx.drawImage(sheet.img, ref.col * cellW, ref.row * cellH, cellW, cellH, dx, 0, w, h);
  } else {
    ctx.drawImage(sheet.img, ref.col * cellW, ref.row * cellH, cellW, cellH, dx, dy, w, h);
  }
  ctx.restore();
}

/** Which tile a ground brush paints on a cell. */
export function groundTile(brush: Ground, col: number, row: number): TileRef | null {
  return brush.variants[variantAt(brush.variants.length, col, row)] ?? null;
}

/** Paint a ground brush on the cell whose top-left corner is at `(x, y)`. */
export function drawGroundCell(
  ctx: CanvasRenderingContext2D,
  book: SheetBook,
  brush: Ground,
  col: number,
  row: number,
  x: number,
  y: number,
  scale: number,
): void {
  const tile = groundTile(brush, col, row);
  if (tile) drawSheetTile(ctx, book, brush.sheet, tile, x, y, scale);
}

/**
 * Draw a prop standing on the cell whose top-left corner is at `(x, y)`.
 *
 * Sprites anchor on the middle of that cell, the way the game stands its trees
 * and its walker; tiles hang off the footprint's top-left corner.
 */
export function drawProp(
  ctx: CanvasRenderingContext2D,
  book: SheetBook,
  prop: Prop,
  x: number,
  y: number,
  scale: number,
  t: number,
): void {
  const { art } = prop;
  if (art.kind === "sprite") {
    const sheet = book[art.sheet];
    if (!sheet?.ok) return;
    const { cellW, cellH } = SHEETS[art.sheet];
    blitFrame(ctx, sheet.img, x + (GRID / 2) * scale, y + (GRID / 2) * scale, {
      cell: cellW,
      cellH,
      scale,
      anchorX: art.anchorX,
      anchorY: art.anchorY,
      frame: art.frames > 1 ? frameAt(t, art.fps, art.frames, true) : 0,
    });
    return;
  }
  if (art.kind === "tileStrip") {
    const frame = frameAt(t, art.fps, art.frames, true);
    drawSheetTile(ctx, book, art.sheet, { col: art.col + frame, row: art.row }, x, y, scale);
    return;
  }
  const { cellW, cellH } = SHEETS[art.sheet];
  const left = x - prop.base.dx * GRID * scale;
  const top = y - prop.base.dy * GRID * scale;
  for (const tile of art.tiles) {
    drawSheetTile(ctx, book, art.sheet, tile, left + tile.dx * cellW * scale, top + tile.dy * cellH * scale, scale);
  }
}

/**
 * How wide and tall a thing draws on its own, in sheet pixels — what a swatch
 * has to make room for. A sprite is its whole frame, whatever footprint the
 * thing claims on the ground.
 */
export function swatchExtent(asset: Asset): { w: number; h: number } {
  if (!isProp(asset)) return { w: GRID, h: GRID };
  if (asset.art.kind === "sprite") {
    const { cellW, cellH } = SHEETS[asset.art.sheet];
    return { w: cellW, h: cellH };
  }
  if (asset.art.kind === "tileStrip") return { w: GRID, h: GRID };
  return { w: asset.w * GRID, h: asset.h * GRID };
}

/**
 * Draw a thing on its own, with its top-left at `(x, y)` — for a swatch, where
 * there is no island underneath and nothing to stand on. Props draw from the
 * cell they stand on, so this offsets by that cell for them.
 */
export function drawAsset(
  ctx: CanvasRenderingContext2D,
  book: SheetBook,
  asset: Asset,
  x: number,
  y: number,
  scale: number,
  t = 0,
): void {
  if (!isProp(asset)) {
    const tile = groundTile(asset, 0, 0);
    if (tile) drawSheetTile(ctx, book, asset.sheet, tile, x, y, scale);
    return;
  }
  drawProp(ctx, book, asset, x + asset.base.dx * GRID * scale, y + asset.base.dy * GRID * scale, scale, t);
}
