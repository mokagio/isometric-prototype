/**
 * The labyrinth, out in the west: a square of stone walls on a grid of cells,
 * one way in on the east side, and a room at the very middle where the
 * Minotaur waits. The passages are cut by a seeded random walk, so the maze is
 * the same every game and every cell can be reached from the door.
 */
export const MAZE = { x0: -460, z0: 130, cell: 6, size: 9, wall: 1, height: 4.5 };
/** The cells cleared for the Minotaur's room, inclusive. */
export const ROOM = { from: 3, to: 5 };
/** The way in: a gap in the east wall, on this row. */
export const DOOR_ROW = 4;

export interface Wall {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const inRoom = (c: number, r: number): boolean => c >= ROOM.from && c <= ROOM.to && r >= ROOM.from && r <= ROOM.to;

/** Which walls stand: `east[c][r]` between cell (c, r) and (c+1, r), `south[c][r]` between (c, r) and (c, r+1). */
export function carve(seed = 7): { east: boolean[][]; south: boolean[][] } {
  const n = MAZE.size;
  const east = Array.from({ length: n }, () => Array<boolean>(n).fill(true));
  const south = Array.from({ length: n }, () => Array<boolean>(n).fill(true));
  const seen = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const rand = rng(seed);
  const stack: Array<[number, number]> = [[n - 1, DOOR_ROW]];
  seen[n - 1]![DOOR_ROW] = true;
  while (stack.length > 0) {
    const [c, r] = stack[stack.length - 1]!;
    const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      .map(([dc, dr]) => [c + dc, r + dr] as const)
      .filter(([nc, nr]) => nc >= 0 && nr >= 0 && nc < n && nr < n && !seen[nc]![nr]);
    if (next.length === 0) {
      stack.pop();
      continue;
    }
    const [nc, nr] = next[Math.floor(rand() * next.length)]!;
    if (nc > c) east[c]![r] = false;
    else if (nc < c) east[nc]![r] = false;
    else if (nr > r) south[c]![r] = false;
    else south[c]![nr] = false;
    seen[nc]![nr] = true;
    stack.push([nc, nr]);
  }
  // Clear the room in the middle: no walls inside it.
  for (let c = ROOM.from; c <= ROOM.to; c++) {
    for (let r = ROOM.from; r <= ROOM.to; r++) {
      if (c < ROOM.to) east[c]![r] = false;
      if (r < ROOM.to) south[c]![r] = false;
    }
  }
  return { east, south };
}

/** Every wall as a box on the ground, outer walls included, with the door left open. */
export function mazeWalls(seed = 7): Wall[] {
  const { cell: s, size: n, wall: t, x0, z0 } = MAZE;
  const { east, south } = carve(seed);
  const out: Wall[] = [];
  const h = t / 2;
  // Outer walls.
  out.push({ x0: x0 - h, z0: z0 - h, x1: x0 + n * s + h, z1: z0 + h });
  out.push({ x0: x0 - h, z0: z0 + n * s - h, x1: x0 + n * s + h, z1: z0 + n * s + h });
  out.push({ x0: x0 - h, z0: z0 - h, x1: x0 + h, z1: z0 + n * s + h });
  out.push({ x0: x0 + n * s - h, z0: z0 - h, x1: x0 + n * s + h, z1: z0 + DOOR_ROW * s + h });
  out.push({ x0: x0 + n * s - h, z0: z0 + (DOOR_ROW + 1) * s - h, x1: x0 + n * s + h, z1: z0 + n * s + h });
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < n; r++) {
      if (c < n - 1 && east[c]![r]) out.push({ x0: x0 + (c + 1) * s - h, z0: z0 + r * s - h, x1: x0 + (c + 1) * s + h, z1: z0 + (r + 1) * s + h });
      if (r < n - 1 && south[c]![r]) out.push({ x0: x0 + c * s - h, z0: z0 + (r + 1) * s - h, x1: x0 + (c + 1) * s + h, z1: z0 + (r + 1) * s + h });
    }
  }
  return out;
}

export const ROOM_CENTRE = { x: MAZE.x0 + ((ROOM.from + ROOM.to + 1) / 2) * MAZE.cell, z: MAZE.z0 + ((ROOM.from + ROOM.to + 1) / 2) * MAZE.cell };
export const DOOR = { x: MAZE.x0 + MAZE.size * MAZE.cell, z: MAZE.z0 + (DOOR_ROW + 0.5) * MAZE.cell };
export const MAZE_CENTRE = { x: MAZE.x0 + (MAZE.size * MAZE.cell) / 2, z: MAZE.z0 + (MAZE.size * MAZE.cell) / 2 };

export function inRoomAt(x: number, z: number): boolean {
  const c = Math.floor((x - MAZE.x0) / MAZE.cell);
  const r = Math.floor((z - MAZE.z0) / MAZE.cell);
  return inRoom(c, r);
}
