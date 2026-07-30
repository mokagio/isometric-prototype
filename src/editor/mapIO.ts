import type { MapCell, MapData } from "../mapFormat";
import type { Board } from "./board";

/** The board as a map file's dense grid: one slot per cell, `null` where nothing is placed. */
export function boardToMap(board: Board): MapData {
  const cells: (MapCell | null)[] = Array.from({ length: board.size * board.size }, () => null);
  board.forEach((col, row, column) => {
    cells[row * board.size + col] = { height: column.height, surface: column.surface };
  });
  return { cols: board.size, rows: board.size, cells };
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** Local date, not UTC — a map saved in the evening should not be filed under tomorrow. */
export const mapFilename = (now: Date): string =>
  `whispering-woods-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
