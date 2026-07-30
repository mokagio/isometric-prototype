import type { Tile } from "../world";

// A placed cell is a solid column: `height` cubes tall, dirt-bodied, capped by
// `surface` — same shape the world renderer draws. One entry per (col, row), so
// tiles can never overlap. Empty cells are absent from the map.
export interface Column {
  height: number;
  surface: Tile;
}

export const BODY_TILE: Tile = [0, 1]; // dirt cliff-face cube
export const MAX_BUILD_HEIGHT = 8;

export class Board {
  readonly size: number;
  private cells = new Map<number, Column>();

  constructor(size: number) {
    this.size = size;
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.size && row < this.size;
  }

  private key(col: number, row: number): number {
    return row * this.size + col;
  }

  at(col: number, row: number): Column | undefined {
    return this.cells.get(this.key(col, row));
  }

  /** Drop `surface` at `(col, row)`, capping a column `height` levels tall. */
  place(col: number, row: number, surface: Tile, height: number): void {
    if (!this.inBounds(col, row)) return;
    this.cells.set(this.key(col, row), { surface, height: Math.max(0, height) });
  }

  erase(col: number, row: number): void {
    this.cells.delete(this.key(col, row));
  }

  clear(): void {
    this.cells.clear();
  }

  forEach(fn: (col: number, row: number, column: Column) => void): void {
    for (const [key, column] of this.cells) {
      fn(key % this.size, Math.floor(key / this.size), column);
    }
  }
}
