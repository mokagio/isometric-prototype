import type { FloorAt } from "../../dungeonTiles";

// How a cell's surroundings are written down, in the same alphabet the tile
// tests use, so a window lifted out of an export pastes straight into one.
//
// `wallPieces` reads seven cells: itself, its four neighbours, and the two
// below-diagonals that cap the lip. All seven sit inside this window, so the
// window settles what the autotiler draws — which is what lets corrections be
// collected by shape rather than by position. `around.test.ts` holds that
// claim down over all 512 of them.

export const FLOOR_CHAR = ".";
export const ROCK_CHAR = "#";
export const AROUND_SEP = "/";

/** How many cells either side of the middle one the window reaches. */
export const REACH = 1;

const charAt = (isFloor: FloorAt, col: number, row: number): string =>
  isFloor(col, row) ? FLOOR_CHAR : ROCK_CHAR;

/**
 * The window around a cell, top row first. Cells off the map read as rock,
 * which comes from `FloorAt`'s own bounds guard rather than from here.
 */
export function around(isFloor: FloorAt, col: number, row: number): string {
  const lines: string[] = [];
  for (let dr = -REACH; dr <= REACH; dr++) {
    let line = "";
    for (let dc = -REACH; dc <= REACH; dc++) line += charAt(isFloor, col + dc, row + dr);
    lines.push(line);
  }
  return lines.join(AROUND_SEP);
}

/** The whole board in the same alphabet, one string per row. */
export function floorRows(isFloor: FloorAt, cols: number, rows: number): string[] {
  return Array.from({ length: rows }, (_, row) => {
    let line = "";
    for (let col = 0; col < cols; col++) line += charAt(isFloor, col, row);
    return line;
  });
}

/** Read a window back as a floor test, with `beyond` standing for everything outside it. */
export function windowFloor(window: string, beyond = false): FloorAt {
  const lines = window.split(AROUND_SEP);
  return (col, row) => {
    const line = lines[row];
    if (line === undefined) return beyond;
    const cell = line[col];
    return cell === undefined ? beyond : cell === FLOOR_CHAR;
  };
}
