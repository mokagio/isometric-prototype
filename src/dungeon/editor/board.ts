import type { Dungeon } from "../dungeon";

/** The builder's canvas: a fixed grid of cells that are either carved floor or solid rock. */
export class Board {
  readonly cols: number;
  readonly rows: number;
  private cells: boolean[][];

  constructor(cols: number, rows: number, floors?: boolean[][]) {
    this.cols = cols;
    this.rows = rows;
    this.cells = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => floors?.[r]?.[c] === true),
    );
  }

  isFloor = (col: number, row: number): boolean =>
    row >= 0 && col >= 0 && row < this.rows && col < this.cols && this.cells[row]![col] === true;

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  /** Paint a square brush of `half` cells either side of (col, row). */
  paint(col: number, row: number, half: number, floor: boolean): void {
    for (let r = row - half; r <= row + half; r++) {
      for (let c = col - half; c <= col + half; c++) {
        if (this.inBounds(c, r)) this.cells[r]![c] = floor;
      }
    }
  }

  clear(): void {
    for (const row of this.cells) row.fill(false);
  }

  snapshot(): boolean[][] {
    return this.cells.map((row) => [...row]);
  }

  /** The board seen as a dungeon, so the game's renderer can draw it unchanged. */
  asDungeon(): Dungeon {
    return { cols: this.cols, rows: this.rows, seed: 0, rooms: [], isFloor: this.isFloor };
  }
}
