// A cell is a solid column: `height` cubes tall, dirt-bodied, capped by a
// surface tile. Water columns are capped flat at the water line so lakes pool
// in the low ground. Tile identity is its [column, row] in the sheet.
export type Tile = readonly [col: number, row: number];

const GRASS: Tile = [1, 1];
const GRASS_VARIANTS: Tile[] = [
  [1, 2],
  [1, 5],
];
const DIRT: Tile = [0, 1]; // cliff-face body cube
const WATER: Tile = [7, 1];

export const MAX_HEIGHT = 6;
export const WATER_LEVEL = 2;

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

export function generateWorld(cols: number, rows: number, seed = 1337): World {
  const cells: Cell[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: Cell[] = [];
    for (let col = 0; col < cols; col++) {
      // Bias the elevation up toward the centre so the map crests into hills
      // and dips to water near the edges, rather than reading as uniform noise.
      const nx = col * 0.08;
      const ny = row * 0.08;
      let h = fbm(nx, ny, seed);
      const dxc = (col - cols / 2) / (cols / 2);
      const dyc = (row - rows / 2) / (rows / 2);
      h += 0.15 * (1 - Math.min(1, dxc * dxc + dyc * dyc));

      const height = Math.max(0, Math.min(MAX_HEIGHT, Math.round(h * MAX_HEIGHT)));

      if (height <= WATER_LEVEL) {
        line.push({ height: WATER_LEVEL, surface: WATER, isWater: true });
      } else {
        const v = hash(col, row, seed + 7);
        const surface =
          v > 0.82 ? GRASS_VARIANTS[Math.floor(hash(col, row, seed + 11) * GRASS_VARIANTS.length)]! : GRASS;
        line.push({ height, surface, isWater: false });
      }
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
