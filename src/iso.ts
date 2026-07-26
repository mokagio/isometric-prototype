import { HALF_H, HALF_W, TILE } from "./tileset";

// Whole-tile pixel zoom; keeps the 48px art chunky and crisp.
export const ZOOM = 2;

// Screen-space steps, zoom baked in.
export const SX = HALF_W * ZOOM; // 48 — half a tile across per +col / -row
export const SY = HALF_H * ZOOM; // 24 — quarter tile down per +col / +row
export const SZ = (TILE / 2) * ZOOM; // 48 — one elevation level up
export const DRAW = TILE * ZOOM; // 96 — drawn sprite size

export interface Origin {
  x: number;
  y: number;
}

/** Screen position of a grid cell's top-diamond apex at elevation `z`. */
export function project(col: number, row: number, z: number, o: Origin): { x: number; y: number } {
  return {
    x: o.x + (col - row) * SX,
    y: o.y + (col + row) * SY - z * SZ,
  };
}

/**
 * Ground-plane (z=0) inverse of `project`: the grid cell whose top diamond
 * contains screen point `(x, y)`. Referenced from the diamond centre (one SY
 * below the apex), so points anywhere in a cell round to that cell.
 */
export function unproject(x: number, y: number, o: Origin): { col: number; row: number } {
  const u = (x - o.x) / SX; // col - row
  const v = (y - o.y - SY) / SY; // col + row
  return { col: Math.round((u + v) / 2), row: Math.round((v - u) / 2) };
}
