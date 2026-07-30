import type { Bounds, Pos } from "./walker";

// The ground Whispering Woods stands on: a finite square of Sunnyside grass with
// nothing beyond it. World coordinates are sprite pixels, so they hold whatever
// the drawing zoom happens to be; only `screenAt` knows about zoom.

export const TILE = 16; // one Sunnyside ground tile, in sprite pixels
export const FIELD = 40; // tiles a side
export const GRASS_VARIANTS = 4; // frames in `grass.png`: plain, then three sprinklings

const SEED = 6421;
// Keeps the plain tile in the majority, so the sprinkled ones read as detail
// rather than as a pattern.
const PLAIN_SHARE = 0.72;

/** Field size in world pixels. */
export const FIELD_PX = FIELD * TILE;

// Value noise: the same cell always draws the same tile, with no array to store.
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + SEED * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Which frame of `grass.png` a cell is painted with. */
export function tileVariant(col: number, row: number): number {
  const v = hash(col, row);
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

/** The cells that fall on screen, clipped to the field — everything else is void. */
export function visibleTiles(camera: Pos, viewW: number, viewH: number, zoom: number): TileRange {
  const span = (from: number, size: number): [number, number] => [
    Math.max(0, Math.floor(from / TILE)),
    Math.min(FIELD - 1, Math.floor((from + size / zoom) / TILE)),
  ];
  const [minCol, maxCol] = span(camera.x, viewW);
  const [minRow, maxRow] = span(camera.y, viewH);
  return { minCol, maxCol, minRow, maxRow };
}
