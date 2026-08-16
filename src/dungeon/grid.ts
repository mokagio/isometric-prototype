/** One tile of the 0x72 sheet, in sheet pixels. */
export const TILE = 16;

// Whole-pixel zoom, so the 16px art stays crisp.
export const ZOOM = 3;

/** Screen size of one grid cell. */
export const CELL = TILE * ZOOM;

export interface Origin {
  x: number;
  y: number;
}

/** Screen position of a grid cell's top-left corner. */
export function project(col: number, row: number, o: Origin): { x: number; y: number } {
  return { x: o.x + col * CELL, y: o.y + row * CELL };
}

/** The cell containing screen point `(x, y)`. */
export function unproject(x: number, y: number, o: Origin): { col: number; row: number } {
  return { col: Math.floor((x - o.x) / CELL), row: Math.floor((y - o.y) / CELL) };
}

/** Screen position of a cell's centre — where a figure's feet sit. */
export function centre(col: number, row: number, o: Origin): { x: number; y: number } {
  return { x: o.x + (col + 0.5) * CELL, y: o.y + (row + 0.5) * CELL };
}
