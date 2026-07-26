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
