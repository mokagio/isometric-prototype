import { FIELD, FIELD_PX } from "../field";
import type { Pos } from "../walker";

// The whole island on screen at once. There is no panning: a kid should be able
// to see everything they are building without being asked to scroll for it, and
// forty tiles fits on any screen worth drawing on.

/** Half-steps, so a small window still gets bigger tiles than a whole one would. */
const STEP = 2;
export const MIN_ZOOM = 1;

/** The largest zoom that fits the island in a `w` x `h` canvas. */
export function fitZoom(w: number, h: number): number {
  const raw = Math.min(w / FIELD_PX, h / FIELD_PX);
  return Math.max(MIN_ZOOM, Math.floor(raw * STEP) / STEP);
}

/** Where the island's top-left corner sits, centred in the canvas. */
export const islandOrigin = (w: number, h: number, zoom: number): Pos => ({
  x: Math.round((w - FIELD_PX * zoom) / 2),
  y: Math.round((h - FIELD_PX * zoom) / 2),
});

/** The camera `screenAt` wants, for an island parked at `islandOrigin`. */
export const cameraFor = (w: number, h: number, zoom: number): Pos => {
  const origin = islandOrigin(w, h, zoom);
  return { x: -origin.x / zoom, y: -origin.y / zoom };
};

export interface Cell {
  col: number;
  row: number;
}

/** Which cell a canvas point is over. Off the island reads as out of bounds. */
export function cellAtPoint(x: number, y: number, w: number, h: number, zoom: number): Cell {
  const origin = islandOrigin(w, h, zoom);
  return {
    col: Math.floor((x - origin.x) / (16 * zoom)),
    row: Math.floor((y - origin.y) / (16 * zoom)),
  };
}

export const onIsland = (cell: Cell): boolean =>
  cell.col >= 0 && cell.row >= 0 && cell.col < FIELD && cell.row < FIELD;
