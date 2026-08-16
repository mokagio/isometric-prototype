import { createRng } from "./rng";

// A dungeon is solid rock with rooms carved out of it and corridors joining
// them. Nothing is ever carved within `MARGIN` of the map edge, so every floor
// cell has rock on all sides to draw walls from.
export const MARGIN = 2;
// Rooms keep this much rock between them. Two is the thinnest that still leaves
// a brick face plus its cap where one room's south wall backs onto another's.
export const ROOM_GAP = 2;

export const ROOM_MIN = 5;
export const ROOM_MAX = 11;
const PLACEMENT_TRIES = 400;

export interface Room {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export interface Dungeon {
  cols: number;
  rows: number;
  seed: number;
  rooms: Room[];
  isFloor(col: number, row: number): boolean;
}

export const roomCentre = (r: Room): { col: number; row: number } => ({
  col: r.col + Math.floor(r.cols / 2),
  row: r.row + Math.floor(r.rows / 2),
});

const overlaps = (a: Room, b: Room, gap: number): boolean =>
  a.col - gap < b.col + b.cols &&
  a.col + a.cols + gap > b.col &&
  a.row - gap < b.row + b.rows &&
  a.row + a.rows + gap > b.row;

export function generateDungeon(cols: number, rows: number, seed: number, roomTarget = 9): Dungeon {
  const rng = createRng(seed);
  const floor: boolean[][] = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const rooms: Room[] = [];

  const span = (): number => ROOM_MIN + Math.floor(rng() * (ROOM_MAX - ROOM_MIN + 1));
  for (let tries = 0; tries < PLACEMENT_TRIES && rooms.length < roomTarget; tries++) {
    const w = span();
    const h = span();
    const room: Room = {
      col: MARGIN + Math.floor(rng() * (cols - w - MARGIN * 2)),
      row: MARGIN + Math.floor(rng() * (rows - h - MARGIN * 2)),
      cols: w,
      rows: h,
    };
    if (room.col < MARGIN || room.row < MARGIN) continue;
    if (rooms.some((other) => overlaps(room, other, ROOM_GAP))) continue;
    rooms.push(room);
  }

  for (const room of rooms) {
    for (let r = room.row; r < room.row + room.rows; r++) {
      for (let c = room.col; c < room.col + room.cols; c++) floor[r]![c] = true;
    }
  }

  const carveRow = (row: number, fromCol: number, toCol: number): void => {
    for (let c = Math.min(fromCol, toCol); c <= Math.max(fromCol, toCol); c++) floor[row]![c] = true;
  };
  const carveCol = (col: number, fromRow: number, toRow: number): void => {
    for (let r = Math.min(fromRow, toRow); r <= Math.max(fromRow, toRow); r++) floor[r]![col] = true;
  };

  // Chain the rooms in placement order, elbowing horizontally or vertically
  // first at random so the corridors don't all bend the same way.
  for (let i = 1; i < rooms.length; i++) {
    const a = roomCentre(rooms[i - 1]!);
    const b = roomCentre(rooms[i]!);
    if (rng() < 0.5) {
      carveRow(a.row, a.col, b.col);
      carveCol(b.col, a.row, b.row);
    } else {
      carveCol(a.col, a.row, b.row);
      carveRow(b.row, a.col, b.col);
    }
  }

  return {
    cols,
    rows,
    seed,
    rooms,
    isFloor: (col, row) =>
      row >= 0 && col >= 0 && row < rows && col < cols && floor[row]![col] === true,
  };
}

/** The centre of the first room — where the hero starts. */
export function findSpawn(dungeon: Dungeon): { col: number; row: number } {
  const first = dungeon.rooms[0];
  if (first) return roomCentre(first);
  for (let row = 0; row < dungeon.rows; row++) {
    for (let col = 0; col < dungeon.cols; col++) {
      if (dungeon.isFloor(col, row)) return { col, row };
    }
  }
  return { col: 0, row: 0 };
}
