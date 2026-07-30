import { isLiquidTile, makeWorld, type Cell, type Tile, type World } from "./world";

// The on-disk shape of a hand-built map: a tile palette plus two flat row-major
// arrays, one of palette indices and one of column heights. Two arrays of small
// integers stay readable in a text editor and stay small enough to download.
export const FORMAT = "whispering-woods-map";
export const VERSION = 1;
const EMPTY = -1; // palette index standing for "nothing placed here"
// A map arrives from a file the player picked, so the dimensions are untrusted:
// this is what stops a typo'd header from allocating a million cells.
export const MAX_SIDE = 256;

/** A placed column: `height` cubes tall, capped by `surface`. */
export interface MapCell {
  height: number;
  surface: Tile;
}

/** Row-major cells, `null` wherever nothing has been placed. */
export interface MapData {
  cols: number;
  rows: number;
  cells: readonly (MapCell | null)[];
}

export const cellAt = (map: MapData, col: number, row: number): MapCell | null =>
  col < 0 || row < 0 || col >= map.cols || row >= map.rows ? null : (map.cells[row * map.cols + col] ?? null);

export const countEmpty = (map: MapData): number => map.cells.reduce((n, c) => (c ? n : n + 1), 0);

export const isComplete = (map: MapData): boolean => countEmpty(map) === 0;

/** The same map with every empty cell filled at ground level by `surface`. */
export function fillEmpty(map: MapData, surface: Tile): MapData {
  return { ...map, cells: map.cells.map((c) => c ?? { height: 0, surface }) };
}

export function encodeMap(map: MapData): string {
  const palette: Tile[] = [];
  const seen = new Map<string, number>();
  const tiles: number[] = [];
  const heights: number[] = [];
  for (const cell of map.cells) {
    if (!cell) {
      tiles.push(EMPTY);
      heights.push(0);
      continue;
    }
    const key = `${cell.surface[0]},${cell.surface[1]}`;
    let index = seen.get(key);
    if (index === undefined) {
      index = palette.length;
      seen.set(key, index);
      palette.push(cell.surface);
    }
    tiles.push(index);
    heights.push(cell.height);
  }
  return JSON.stringify({ format: FORMAT, version: VERSION, cols: map.cols, rows: map.rows, palette, tiles, heights });
}

// Decode messages are shown to whoever picked the file, so they say what to do
// about it rather than naming the field that failed.
const fail = (message: string): never => {
  throw new Error(message);
};

const isSide = (n: unknown): boolean => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_SIDE;

function readPalette(raw: unknown): Tile[] {
  if (!Array.isArray(raw)) fail("This map's tile list is missing.");
  return (raw as unknown[]).map((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2 || !entry.every((n) => Number.isInteger(n) && n >= 0)) {
      fail("This map has a tile it cannot describe.");
    }
    return [(entry as number[])[0]!, (entry as number[])[1]!] as Tile;
  });
}

function readCells(raw: unknown, count: number, what: string): number[] {
  if (!Array.isArray(raw) || raw.length !== count) {
    fail(`This map's ${what} do not match its size — it may be half-saved.`);
  }
  return raw as number[];
}

export function decodeMap(text: string): MapData {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    fail("That file is not a map — it isn't even readable text.");
  }
  if (!raw! || typeof raw! !== "object" || raw!.format !== FORMAT) fail("That file is not a Whispering Woods map.");
  if (raw!.version !== VERSION) fail("That map was saved by a different version of the game.");
  const { cols, rows } = raw!;
  if (!isSide(cols) || !isSide(rows)) fail(`A map has to be between 1 and ${MAX_SIDE} tiles on each side.`);

  const palette = readPalette(raw!.palette);
  const count = (cols as number) * (rows as number);
  const tiles = readCells(raw!.tiles, count, "tiles");
  const heights = readCells(raw!.heights, count, "heights");

  const cells: (MapCell | null)[] = [];
  for (let i = 0; i < count; i++) {
    const index = tiles[i]!;
    if (index === EMPTY) {
      cells.push(null);
      continue;
    }
    const surface = palette[index];
    if (!surface) fail("This map points at a tile that isn't in its own tile list.");
    const height = heights[i]!;
    if (!Number.isInteger(height) || height < 0) fail("This map has a tile stacked to an impossible height.");
    cells.push({ height, surface: surface! });
  }
  return { cols: cols as number, rows: rows as number, cells };
}

/** Every cell of a world as a finished map, so the editor can open a generated one. */
export function mapFromWorld(world: World): MapData {
  const cells: MapCell[] = [];
  for (let row = 0; row < world.rows; row++) {
    for (let col = 0; col < world.cols; col++) {
      const cell = world.cell(col, row);
      cells.push({ height: cell.height, surface: cell.surface });
    }
  }
  return { cols: world.cols, rows: world.rows, cells };
}

/** A playable `World` from a finished map. Liquid-capped columns become water. */
export function worldFromMap(map: MapData): World {
  const grid: Cell[][] = [];
  for (let row = 0; row < map.rows; row++) {
    const line: Cell[] = [];
    for (let col = 0; col < map.cols; col++) {
      const cell = cellAt(map, col, row) ?? fail("This map still has empty tiles — fill them before playing it.");
      line.push({ height: cell.height, surface: cell.surface, isWater: isLiquidTile(cell.surface) });
    }
    grid.push(line);
  }
  return makeWorld(grid);
}
