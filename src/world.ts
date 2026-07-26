// A cell is a solid column: `height` cubes tall, dirt-bodied, capped by a
// surface tile. Tile identity is its [column, row] in the sheet.
//
// The generated world is deliberately flat — every column is one level — so
// walking stays smooth. The stacking machinery it renders through still lives
// in the renderer, the hero physics, and the map editor; the default world
// just never uses more than a single level.
export type Tile = readonly [col: number, row: number];

const GRASS: Tile = [1, 1];
const GRASS_VARIANTS: Tile[] = [
  [1, 2],
  [1, 5],
];
const FLOWERS: Tile[] = [
  [1, 8],
  [2, 2],
];
const DIRT: Tile = [0, 1]; // cliff-face body cube
const WATER: Tile = [7, 1];

export const GROUND_HEIGHT = 0; // single flat level for the whole world
const WATER_THRESHOLD = 0.24; // lower noise → water; keeps ponds small and scattered
const NOISE_FREQ = 0.11; // higher → smaller, more broken-up water features

// Terraced-generation tuning, kept for `{ flat: false }` worlds.
export const MAX_HEIGHT = 6;
export const WATER_LEVEL = 2;

export interface WorldOptions {
  /** Default true — a single flat level. `false` generates rolling terraces. */
  flat?: boolean;
}

export interface Cell {
  height: number;
  surface: Tile;
  isWater: boolean;
}

export interface World {
  cols: number;
  rows: number;
  cells: Cell[][];
  body: Tile;
  cell(col: number, row: number): Cell;
  /** Surface height at a cell — where a character stands. */
  heightAt(col: number, row: number): number;
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

function flatCell(col: number, row: number, seed: number): Cell {
  // Noise only paints where water pools; a hash sprinkles grass variants and
  // the odd flower patch. Every column stays at ground level.
  if (fbm(col * NOISE_FREQ, row * NOISE_FREQ, seed) < WATER_THRESHOLD) {
    return { height: GROUND_HEIGHT, surface: WATER, isWater: true };
  }
  const v = hash(col, row, seed + 7);
  let surface = GRASS;
  if (v > 0.96) surface = FLOWERS[Math.floor(hash(col, row, seed + 13) * FLOWERS.length)]!;
  else if (v > 0.82) surface = GRASS_VARIANTS[Math.floor(hash(col, row, seed + 11) * GRASS_VARIANTS.length)]!;
  return { height: GROUND_HEIGHT, surface, isWater: false };
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
    return { height: WATER_LEVEL, surface: WATER, isWater: true };
  }
  const v = hash(col, row, seed + 7);
  const surface =
    v > 0.82 ? GRASS_VARIANTS[Math.floor(hash(col, row, seed + 11) * GRASS_VARIANTS.length)]! : GRASS;
  return { height, surface, isWater: false };
}

export function generateWorld(cols: number, rows: number, seed = 1337, options: WorldOptions = {}): World {
  const flat = options.flat ?? true;
  const cells: Cell[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: Cell[] = [];
    for (let col = 0; col < cols; col++) {
      line.push(flat ? flatCell(col, row, seed) : terracedCell(col, row, cols, rows, seed));
    }
    cells.push(line);
  }

  const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
  return {
    cols,
    rows,
    cells,
    body: DIRT,
    cell: (col, row) => cells[clamp(row, 0, rows - 1)]![clamp(col, 0, cols - 1)]!,
    heightAt: (col, row) => cells[clamp(row, 0, rows - 1)]![clamp(col, 0, cols - 1)]!.height,
  };
}

/** Nearest non-water cell to the map centre — a dry place to drop the hero. */
export function findSpawn(world: World): { col: number; row: number } {
  const cx = Math.floor(world.cols / 2);
  const cy = Math.floor(world.rows / 2);
  const reach = Math.max(world.cols, world.rows);
  for (let radius = 0; radius < reach; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue; // walk the ring only
        const col = cx + dc;
        const row = cy + dr;
        if (col < 0 || row < 0 || col >= world.cols || row >= world.rows) continue;
        if (!world.cell(col, row).isWater) return { col, row };
      }
    }
  }
  return { col: cx, row: cy };
}
