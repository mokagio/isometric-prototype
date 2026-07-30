import type { Sheet } from "../sprites";
import {
  cellAt,
  chamferTile,
  fenceTile,
  FOAM_SECONDS,
  frameOf,
  isCliffFace,
  isLip,
  isWater,
  lipCornerTile,
  ringOf,
  seaTile,
  shoreTile,
  SPARKLE_FRAMES,
  SPARKLE_SECONDS,
  sparkleAt,
  type Tile,
} from "./coast";
import { screenAt, TILE } from "./field";
import type { Pos } from "./walker";

// The island's ground, drawn the one way. The game paints its own grass into it
// and the editor paints whatever was built, but the sea, the water's edge, the
// bank's face and its lip are the same picture in both — so they live here
// rather than being written out twice and drifting apart.

/** Under the sea tiles, for the frame before they load: the pack's own deep water. */
export const DEEP_SEA = "#0099db";

// The bank's face out of `cliff.png`: its second row is the body of the wall, in
// three variants picked by column so the striations do not repeat.
const CLIFF_FACE_ROW = 1;
const CLIFF_FACE_COLS = 3;

export interface CoastSheets {
  sea: Sheet;
  sparkle: Sheet;
  shore: Sheet;
  shore2: Sheet;
  cliff: Sheet;
  lip: Sheet;
  lipCorner: Sheet;
  fence: Sheet;
}

export interface GroundView {
  camera: Pos;
  zoom: number;
  width: number;
  height: number;
  /** Seconds, for the surf and the glints. */
  animT: number;
}

/** One 16px tile of a sheet, blown up to the drawing zoom. */
export function drawCoastTile(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  src: Tile,
  at: Pos,
  zoom: number,
  flipV = false,
): void {
  const size = TILE * zoom;
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  if (!flipV) {
    ctx.drawImage(img, src.col * TILE, src.row * TILE, TILE, TILE, x, y, size, size);
    return;
  }
  // Stood on its head, which is how the coast reuses a corner post on the far side.
  ctx.save();
  ctx.translate(x, y + size);
  ctx.scale(1, -1);
  ctx.drawImage(img, src.col * TILE, src.row * TILE, TILE, TILE, 0, 0, size, size);
  ctx.restore();
}

/**
 * Sea, then the island on top of it. `paintLand` is called for every land cell
 * that is not the coast's own — the game's grass, or whatever was built there.
 */
export function drawIslandGround(
  ctx: CanvasRenderingContext2D,
  sheets: CoastSheets,
  view: GroundView,
  paintLand: (col: number, row: number, at: Pos) => void,
): void {
  const { camera, zoom, animT } = view;
  const tile = (img: CanvasImageSource, src: Tile, at: Pos): void => drawCoastTile(ctx, img, src, at, zoom);

  // Deliberately unclamped: the sea carries on past the field, which is the
  // whole point of an island.
  const minCol = Math.floor(camera.x / TILE);
  const minRow = Math.floor(camera.y / TILE);
  const maxCol = Math.floor((camera.x + view.width / zoom) / TILE);
  const maxRow = Math.floor((camera.y + view.height / zoom) / TILE);
  const surf = frameOf(animT, FOAM_SECONDS, 2) === 0 ? sheets.shore : sheets.shore2;

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const at = screenAt(cellAt(col, row), camera, zoom);
      if (sheets.sea.ok) tile(sheets.sea.img, seaTile(col, row), at);
      const sparkle = sheets.sparkle.ok ? sparkleAt(col, row) : null;
      if (sparkle) {
        const t = animT + sparkle.phase * SPARKLE_SECONDS * SPARKLE_FRAMES;
        tile(sheets.sparkle.img, { col: frameOf(t, SPARKLE_SECONDS, SPARKLE_FRAMES), row: 0 }, at);
      }
      if (ringOf(col, row) < 0) continue; // out at sea

      // Ground everywhere on the island but the lip and the corner chamfers,
      // which are their own. Never on the coast ring: that is water, and the
      // shore tiles go over it.
      const chamfer = sheets.shore.ok ? chamferTile(col, row) : null;
      const ownGround = isWater(col, row) || chamfer !== null || (isLip(col, row) && sheets.lip.ok);
      if (!ownGround) paintLand(col, row, at);
      if (chamfer && surf.ok) tile(surf.img, chamfer, at);
      if (isLip(col, row)) {
        const corner = sheets.lipCorner.ok ? lipCornerTile(col, row) : null;
        if (corner) tile(sheets.lipCorner.img, corner, at);
        else if (sheets.lip.ok) tile(sheets.lip.img, { col: 0, row: 0 }, at);
      }
      // The face is a wall, so it is drawn over the ground rather than instead
      // of it: its own tiles are cut away at the top where the lip shows through.
      if (isCliffFace(col, row) && sheets.cliff.ok) {
        tile(sheets.cliff.img, { col: col % CLIFF_FACE_COLS, row: CLIFF_FACE_ROW }, at);
      }
      const shore = shoreTile(col, row);
      if (shore && surf.ok) tile(surf.img, shore, at);
    }
  }
}

export interface FencePost {
  tile: Tile;
  flipV: boolean;
  at: Pos;
  /** World y of the cell it stands on, for sorting it in among everything else. */
  y: number;
}

/**
 * The fence along the top of the drop, as placed tiles rather than as drawing:
 * it stands up off the ground, so each caller sorts it in with whatever else is
 * standing and the walker can pass behind it.
 */
export function fencePosts(view: GroundView): FencePost[] {
  const { camera, zoom } = view;
  const posts: FencePost[] = [];
  const minCol = Math.floor(camera.x / TILE);
  const minRow = Math.floor(camera.y / TILE);
  const maxCol = Math.floor((camera.x + view.width / zoom) / TILE);
  const maxRow = Math.floor((camera.y + view.height / zoom) / TILE);
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const fence = fenceTile(col, row);
      if (!fence) continue;
      posts.push({
        tile: fence.tile,
        flipV: fence.flipV,
        at: screenAt(cellAt(col, row), camera, zoom),
        y: row * TILE + TILE / 2,
      });
    }
  }
  return posts;
}
