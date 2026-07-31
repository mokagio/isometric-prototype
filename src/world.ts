// A cell is a solid column: `height` cubes tall, dirt-bodied, capped by a
// surface tile. Tile identity is its [column, row] in the sheet.
//
// The generated world is deliberately flat — every column is one level — so
// walking stays smooth. The stacking machinery it renders through still lives
// in the renderer, the hero physics, and the map editor; the default world
// just never uses more than a single level.
export type Tile = readonly [col: number, row: number];

export const GRASS: Tile = [1, 1]; // also what an unfinished map's gaps are filled with
const GRASS_VARIANTS: Tile[] = [
  [1, 2],
  [1, 5],
];
const FLOWERS: Tile[] = [
  [1, 8],
  [2, 2],
];
const DIRT: Tile = [0, 1]; // cliff-face body cube
const WATER: Tile = [0, 10]; // the bright blue water cube
const LAVA: Tile = [3, 10];
// Sheet row 10 is one cracked-pool cube in four hues — water, teal, purple,
// lava. Anywhere one of them caps a column, generated or hand-placed, it is
// liquid.
const LIQUID_SHEET_ROW = 10;
// Lava is waded at a heart a second (`hazard.ts`); every other pool, water
// included, is a wall. Water shapes the map, so it has to stop you: a river you
// can pay to cross is a river that no longer divides anything.
const HAZARDS: Tile[] = [LAVA];

// One size for every map, generated or hand-built, so the editor can open the
// world you are playing and the game can play a map you drew without either
// side resizing anything. Big enough to roam, small enough to pan across the
// editor in a handful of presses.
export const MAP_SIZE = 56;

export const GROUND_HEIGHT = 0; // single flat level for the whole world
const WATER_THRESHOLD = 0.22; // lower noise → water; keeps ponds small and scattered
const NOISE_FREQ = 0.11; // higher → smaller, more broken-up water features
// Rivers: a thin band tracing one contour of a low-frequency field, so it winds
// across the map as a narrow ribbon rather than a blob.
const RIVER_FREQ = 0.05;
const RIVER_WIDTH = 0.022;
const RIVER_SEED = 4242;
// Dry crossings punched through rivers on a grid, so a winding river always
// hits one and can never wall the map off end to end. Pools keep their shape.
const FORD_PERIOD = 11; // cells between crossings
const FORD_GAP = 2; // width of each crossing

// Terraced-generation tuning, kept for `{ flat: false }` worlds.
export const MAX_HEIGHT = 6;
export const WATER_LEVEL = 2;

export interface WorldOptions {
  /** Default true — a single flat level. `false` generates rolling terraces. */
  flat?: boolean;
  /** Default true. `false` lays nothing but dry land, for a backdrop with no shore in it. */
  water?: boolean;
}

// The surface tile decides what a cell does underfoot, so there is nothing here
// to keep in step with it.
export interface Cell {
  height: number;
  surface: Tile;
}

export interface World {
  cols: number;
  rows: number;
  cells: Cell[][];
  body: Tile;
  cell(col: number, row: number): Cell;
  /** Surface height at a cell — where a character stands. */
  heightAt(col: number, row: number): number;
  /** A pool nothing can cross. */
  blocks(col: number, row: number): boolean;
  /** Walkable, but it costs the hero a heart a second to stand in. */
  isHazard(col: number, row: number): boolean;
}

export const isLiquidTile = (tile: Tile): boolean => tile[1] === LIQUID_SHEET_ROW;

export const isHazardTile = (tile: Tile): boolean =>
  HAZARDS.some(([col, row]) => col === tile[0] && row === tile[1]);

/** Liquid that cannot be crossed at all, as opposed to liquid that merely hurts. */
export const blocksTile = (tile: Tile): boolean => isLiquidTile(tile) && !isHazardTile(tile);

export const randomSeed = (): number => Math.floor(Math.random() * 1_000_000);

/** Wraps a grid of cells as a `World`, reading out of bounds as the nearest edge cell. */
export function makeWorld(cells: Cell[][]): World {
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
  const at = (col: number, row: number): Cell => cells[clamp(row, 0, rows - 1)]![clamp(col, 0, cols - 1)]!;
  return {
    cols,
    rows,
    cells,
    body: DIRT,
    cell: at,
    heightAt: (col, row) => at(col, row).height,
    blocks: (col, row) => blocksTile(at(col, row).surface),
    isHazard: (col, row) => isHazardTile(at(col, row).surface),
  };
}

// Deterministic hash → [0, 1) at integer lattice points.
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const n00 = hash(x0, y0, seed);
  const n10 = hash(x0 + 1, y0, seed);
  const n01 = hash(x0, y0 + 1, seed);
  const n11 = hash(x0 + 1, y0 + 1, seed);
  return lerp(lerp(n00, n10, fx), lerp(n01, n11, fx), fy);
}

// Fractal (layered) noise → smooth rolling terrain in [0, 1].
function fbm(x: number, y: number, seed: number): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let octave = 0; octave < 4; octave++) {
    value += amp * valueNoise(x * freq, y * freq, seed + octave * 97);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value / norm;
}

function isWaterAt(col: number, row: number, seed: number): boolean {
  if (fbm(col * NOISE_FREQ, row * NOISE_FREQ, seed) < WATER_THRESHOLD) return true; // pool
  const river = Math.abs(fbm(col * RIVER_FREQ, row * RIVER_FREQ, seed + RIVER_SEED) - 0.5) < RIVER_WIDTH;
  const ford = col % FORD_PERIOD < FORD_GAP || row % FORD_PERIOD < FORD_GAP;
  return river && !ford;
}

function flatCell(col: number, row: number, seed: number, water: boolean): Cell {
  // Water pools and rivers; a hash sprinkles grass variants and the odd flower
  // patch onto the dry land. Every column stays at ground level.
  if (water && isWaterAt(col, row, seed)) {
    return { height: GROUND_HEIGHT, surface: WATER };
  }
  const v = hash(col, row, seed + 7);
  let surface = GRASS;
  if (v > 0.96) surface = FLOWERS[Math.floor(hash(col, row, seed + 13) * FLOWERS.length)]!;
  else if (v > 0.82) surface = GRASS_VARIANTS[Math.floor(hash(col, row, seed + 11) * GRASS_VARIANTS.length)]!;
  return { height: GROUND_HEIGHT, surface };
}

function terracedCell(col: number, row: number, cols: number, rows: number, seed: number): Cell {
  // Bias elevation up toward the centre so the map crests into hills and dips
  // to water near the edges, rather than reading as uniform noise.
  let h = fbm(col * 0.08, row * 0.08, seed);
  const dxc = (col - cols / 2) / (cols / 2);
  const dyc = (row - rows / 2) / (rows / 2);
  h += 0.15 * (1 - Math.min(1, dxc * dxc + dyc * dyc));

  const height = Math.max(0, Math.min(MAX_HEIGHT, Math.round(h * MAX_HEIGHT)));
  if (height <= WATER_LEVEL) {
    return { height: WATER_LEVEL, surface: WATER };
  }
  const v = hash(col, row, seed + 7);
  const surface =
    v > 0.82 ? GRASS_VARIANTS[Math.floor(hash(col, row, seed + 11) * GRASS_VARIANTS.length)]! : GRASS;
  return { height, surface };
}

export function generateWorld(cols: number, rows: number, seed = 1337, options: WorldOptions = {}): World {
  const flat = options.flat ?? true;
  const water = options.water ?? true;
  const cells: Cell[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: Cell[] = [];
    for (let col = 0; col < cols; col++) {
      line.push(flat ? flatCell(col, row, seed, water) : terracedCell(col, row, cols, rows, seed));
    }
    cells.push(line);
  }
  return makeWorld(cells);
}

/**
 * A dry cell on the largest connected landmass, nearest the map centre — so the
 * hero never wakes trapped on a little island. Land is 4-connected, matching a
 * hero who can't cut a diagonal corner between two water cells.
 *
 * Hazards count as sea rather than as land: they are crossable, but waking up
 * standing in lava would spend the hero's hearts before they moved.
 */
export function findSpawn(world: World): { col: number; row: number } {
  const { cols, rows } = world;
  const comp = new Int32Array(cols * rows).fill(-1); // land component id per cell, -1 = unvisited
  const at = (c: number, r: number): number => r * cols + c;
  const sea = (c: number, r: number): boolean => world.blocks(c, r) || world.isHazard(c, r);

  let bestId = -1;
  let bestSize = 0;
  const stack: number[] = [];
  let id = 0;
  for (let r0 = 0; r0 < rows; r0++) {
    for (let c0 = 0; c0 < cols; c0++) {
      if (sea(c0, r0) || comp[at(c0, r0)] !== -1) continue;
      let size = 0;
      stack.length = 0;
      stack.push(at(c0, r0));
      comp[at(c0, r0)] = id;
      while (stack.length) {
        const p = stack.pop()!;
        const c = p % cols;
        const r = (p - c) / cols;
        size++;
        const neighbours = [
          [c + 1, r],
          [c - 1, r],
          [c, r + 1],
          [c, r - 1],
        ];
        for (const [nc, nr] of neighbours) {
          if (nc! < 0 || nr! < 0 || nc! >= cols || nr! >= rows) continue;
          if (comp[at(nc!, nr!)] !== -1 || sea(nc!, nr!)) continue;
          comp[at(nc!, nr!)] = id;
          stack.push(at(nc!, nr!));
        }
      }
      if (size > bestSize) {
        bestSize = size;
        bestId = id;
      }
      id++;
    }
  }

  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  let best = { col: Math.floor(cx), row: Math.floor(cy) };
  let bestDist = Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (comp[at(c, r)] !== bestId) continue;
      const dist = (c - cx) * (c - cx) + (r - cy) * (r - cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { col: c, row: r };
      }
    }
  }
  return best;
}
