import { cellAt, type MapCell, type MapData } from "../mapFormat";
import type { Board } from "./board";

/** The board as a map file's dense grid: one slot per cell, `null` where nothing is placed. */
export function boardToMap(board: Board): MapData {
  const cells: (MapCell | null)[] = Array.from({ length: board.size * board.size }, () => null);
  board.forEach((col, row, column) => {
    cells[row * board.size + col] = { height: column.height, surface: column.surface };
  });
  return { cols: board.size, rows: board.size, cells };
}

/**
 * Replace whatever is on the board with `map`. Throws rather than silently
 * cropping a map the board cannot hold — losing half of someone's work quietly
 * is worse than refusing to open it.
 */
export function loadMapIntoBoard(board: Board, map: MapData): void {
  if (map.cols !== board.size || map.rows !== board.size) {
    throw new Error(`That map is ${map.cols}x${map.rows}, and this editor builds ${board.size}x${board.size} maps.`);
  }
  board.clear();
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      const cell = cellAt(map, col, row);
      if (cell) board.place(col, row, cell.surface, cell.height);
    }
  }
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** Local date, not UTC — a map saved in the evening should not be filed under tomorrow. */
export const mapFilename = (now: Date): string =>
  `whispering-woods-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
