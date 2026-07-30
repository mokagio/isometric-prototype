import { LOG_CLEARANCE } from "./logs";
import type { Bounds, Pos } from "./walker";

// The ground Whispering Woods stands on: a finite square of Sunnyside grass with
// nothing beyond it. World coordinates are sprite pixels, so they hold whatever
// the drawing zoom happens to be; only `screenAt` knows about zoom.

export const TILE = 16; // one Sunnyside ground tile, in sprite pixels
export const FIELD = 40; // tiles a side
export const GRASS_VARIANTS = 4; // frames in `grass.png`: plain, then three sprinklings

const SEED = 6421;
const TREE_SEED = 91177;
// Keeps the plain tile in the majority, so the sprinkled ones read as detail
// rather than as a pattern.
const PLAIN_SHARE = 0.72;

// Candidates, before spacing thins them out — most of a cluster loses to its
// neighbour, so this is well above the share of cells that end up wooded.
const TREE_SHARE = 0.5;
// Cells between trunks. A tree is drawn 32x34, a little over two tiles each way,
// so three cells apart is the closest two can stand without their crowns
// touching. `TREE_REACH` is how far one has to look to find a rival.
const TREE_SPACING = 3;
const TREE_REACH = TREE_SPACING - 1;
// Tiles kept clear around the middle, so nobody starts inside a trunk.
const CLEARING = 3;
// Tiles kept clear along the edge, so the logs a tree drops cannot land in the
// void where nobody could ever pick them up.
const EDGE = Math.ceil(LOG_CLEARANCE / TILE);

/**
 * What a trunk blocks, in world pixels around the base it stands on: its roots,
 * not its crown. Walking behind a tree is fine, and the crown hiding you as you
 * pass is the point of a wood. Measured off `tree.png`, and drawn by the debug
 * overlay so it can be checked against the art.
 */
export const TRUNK = { halfW: 8, top: 5, bottom: 2 };

/** Field size in world pixels. */
export const FIELD_PX = FIELD * TILE;

// Value noise: the same cell always draws the same tile, with no array to store.
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Where the character starts, and the middle of the field. */
export const MIDDLE: Pos = { x: FIELD_PX / 2, y: FIELD_PX / 2 };

/** A cell's claim to a tree, or -1 where one may not stand at all. */
function claim(col: number, row: number): number {
  if (col < EDGE || row < EDGE || col >= FIELD - EDGE || row >= FIELD - EDGE) return -1;
  const mid = FIELD / 2;
  if (Math.abs(col - mid) <= CLEARING && Math.abs(row - mid) <= CLEARING) return -1;
  const h = hash(col, row, TREE_SEED);
  return h < TREE_SHARE ? h : -1;
}

/**
 * Whether a tree stands on a cell. Deterministic, so the wood does not reshuffle,
 * and spaced, so no two crowns overlap.
 *
 * A cell keeps its tree only by out-claiming every cell within `TREE_REACH` —
 * the strongest claim in any neighbourhood wins and the rest lose theirs. That
 * thins clusters without a placement pass to store, and equal claims fall to
 * whichever cell comes first, so exactly one of the two survives.
 */
export function treeAt(col: number, row: number): boolean {
  const mine = claim(col, row);
  if (mine < 0) return false;
  for (let dr = -TREE_REACH; dr <= TREE_REACH; dr++) {
    for (let dc = -TREE_REACH; dc <= TREE_REACH; dc++) {
      if (dc === 0 && dr === 0) continue;
      const theirs = claim(col + dc, row + dr);
      if (theirs > mine) return false;
      if (theirs === mine && (dr < 0 || (dr === 0 && dc < 0))) return false;
    }
  }
  return true;
}

/** Whether a trunk stands where the feet are trying to go. */
export function blockedByTree(feet: Pos): boolean {
  const col0 = Math.floor(feet.x / TILE);
  const row0 = Math.floor(feet.y / TILE);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const col = col0 + dc;
      const row = row0 + dr;
      if (!treeAt(col, row)) continue;
      const base = { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
      const inTrunk =
        Math.abs(feet.x - base.x) < TRUNK.halfW && feet.y > base.y - TRUNK.top && feet.y < base.y + TRUNK.bottom;
      if (inTrunk) return true;
    }
  }
  return false;
}

/** Which frame of `grass.png` a cell is painted with. */
export function tileVariant(col: number, row: number): number {
  const v = hash(col, row, SEED);
  if (v < PLAIN_SHARE) return 0;
  const rest = (v - PLAIN_SHARE) / (1 - PLAIN_SHARE);
  return 1 + Math.min(GRASS_VARIANTS - 2, Math.floor(rest * (GRASS_VARIANTS - 1)));
}

/**
 * Where the walker may stand, `inset` world pixels in from the edge so the figure
 * is not left standing half over the void.
 */
export function fieldBounds(inset: number): Bounds {
  return { minX: inset, maxX: FIELD_PX - inset, minY: inset, maxY: FIELD_PX - inset };
}

/**
 * World position of the viewport's top-left corner, for a character held in the
 * middle of the screen. Deliberately unclamped: at the edge of the field you see
 * past it, the same as walking to the edge of a Peaceful Plains map.
 */
export function cameraAt(pos: Pos, viewW: number, viewH: number, zoom: number): Pos {
  return { x: pos.x - viewW / (2 * zoom), y: pos.y - viewH / (2 * zoom) };
}

/** Screen pixel a world point lands on, given the camera. */
export function screenAt(world: Pos, camera: Pos, zoom: number): Pos {
  return { x: (world.x - camera.x) * zoom, y: (world.y - camera.y) * zoom };
}

export interface TileRange {
  minCol: number;
  maxCol: number; // inclusive
  minRow: number;
  maxRow: number;
}

/**
 * The cells that fall on screen, clipped to the field — everything else is void.
 *
 * `pad` widens the range by whole tiles, for sprites taller than their cell: a
 * tree just off the top of the screen still hangs its crown into view.
 */
export function visibleTiles(camera: Pos, viewW: number, viewH: number, zoom: number, pad = 0): TileRange {
  const span = (from: number, size: number): [number, number] => [
    Math.max(0, Math.floor(from / TILE) - pad),
    Math.min(FIELD - 1, Math.floor((from + size / zoom) / TILE) + pad),
  ];
  const [minCol, maxCol] = span(camera.x, viewW);
  const [minRow, maxRow] = span(camera.y, viewH);
  return { minCol, maxCol, minRow, maxRow };
}
