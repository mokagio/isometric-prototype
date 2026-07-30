import { CLIFF_RINGS, COAST_RINGS, FIELD, TILE } from "./field";

// What turns the field into an island. The arrangement is the pack's own — its
// GameMaker example room builds a coast this way, read from the water inland:
// foam and rim, the bank's face, the dark lip cut into the grass, then grass.
//
// The face only appears on the south shore. It is drawn as a wall seen from the
// front, so on the other three shores there would be nothing to see: there the
// land simply ends at the water, which is how the room does it too.

/** `sea.png` is a seamless 4x4 block of tiles, not a set of variants. */
export const SEA_BLOCK = 4;

// The pack animates both at 5 fps, each frame held for several steps: the surf
// swaps every 0.8s, and the sparkle likewise.
export const FOAM_SECONDS = 0.8;
export const SPARKLE_SECONDS = 0.8;
export const SPARKLE_FRAMES = 4;

// Rare enough to read as a glint rather than a pattern.
const SPARKLE_SHARE = 0.05;
const SPARKLE_SEED = 33191;

/**
 * The shore ring as the pack cut it, by position in `shore.png` (3 wide, 5 tall).
 * It is cut for a *lake* — land around the outside, water in the middle — so an
 * island reads it inside out: the ring's top edge has land above the water, which
 * is exactly our south shore. Hence the crossed-over names, and no rotations.
 */
const RING = {
  landAbove: { col: 1, row: 0 }, // brown bank: our south shore
  landBelow: { col: 1, row: 2 }, // grass bank: our north shore
  landRight: { col: 2, row: 1 }, // our west shore
  landLeft: { col: 0, row: 1 }, // our east shore
  landAboveLeft: { col: 0, row: 0 }, // our south-east corner
  landAboveRight: { col: 2, row: 0 }, // our south-west corner
  landBelowLeft: { col: 0, row: 2 }, // our north-east corner
  landBelowRight: { col: 2, row: 2 }, // our north-west corner
} as const;

export type Tile = { col: number; row: number };

/** How many cells in from the nearest edge a cell sits. Negative is out at sea. */
export function ringOf(col: number, row: number): number {
  if (col < 0 || row < 0 || col >= FIELD || row >= FIELD) return -1;
  return Math.min(col, row, FIELD - 1 - col, FIELD - 1 - row);
}

/**
 * Whether a cell is water rather than land. The field's outermost ring is: the
 * shore tiles are drawn over the sea, not over grass.
 *
 * That is how the pack cuts them. Only the south tile carries any land — a band
 * of bank across its top, then foam and rim, then transparent. The north, east and
 * west tiles are a rim and nothing else, meant to be laid on the water cell facing
 * the land. Grass under any of them shows through as a green strip beyond the rim,
 * and at a corner as a tongue of grass sticking out into the sea.
 */
export function isWater(col: number, row: number): boolean {
  return ringOf(col, row) === 0;
}

/** Whether a cell's nearest edge is the south one — the only shore with a face. */
export function facesSouth(col: number, row: number): boolean {
  const ring = ringOf(col, row);
  return ring >= 0 && row === FIELD - 1 - ring;
}

// The island's own corner cells, on the shores that have no bank. Land runs from
// COAST_RINGS to FIELD - 1 - COAST_RINGS, so these are its first and last cells.
const INNER_FIRST = COAST_RINGS;
const INNER_LAST = FIELD - 1 - COAST_RINGS;

/**
 * The wedge that chamfers a corner of the island, or null.
 *
 * These tiles carry land in one quadrant and a diagonal rim across it, so they
 * work as the land's own corner: the coast turns on the diagonal, like a headland,
 * instead of being cut square. Laid on the *diagonal water cell* outside the
 * island — which touches it only at a point — the same tile is a lone shard of
 * land floating in the sea, which is the mistake worth not repeating.
 *
 * The north pair are the grass-bank wedges, the south pair the brown-bank ones, so
 * each corner turns in the colour of the shore it belongs to.
 */
export function chamferTile(col: number, row: number): Tile | null {
  const first = col === INNER_FIRST;
  const last = col === INNER_LAST;
  if (row === INNER_FIRST) {
    if (first) return RING.landBelowRight; // land to its south-east
    if (last) return RING.landBelowLeft; // land to its south-west
  }
  if (row === INNER_LAST) {
    if (first) return RING.landAboveRight; // land to its north-east
    if (last) return RING.landAboveLeft; // land to its north-west
  }
  return null;
}

/** Whether a water cell's straight rim is left off because a chamfer covers it. */
function chamfered(col: number, row: number): boolean {
  const onCornerCol = col === INNER_FIRST || col === INNER_LAST;
  const onCornerRow = row === INNER_FIRST || row === INNER_LAST;
  const flanksAcross = (row === 0 || row === FIELD - 1) && onCornerCol;
  const flanksDown = (col === 0 || col === FIELD - 1) && onCornerRow;
  const diagonallyOutside = (row === 0 || row === FIELD - 1) && (col === 0 || col === FIELD - 1);
  return flanksAcross || flanksDown || diagonallyOutside;
}

/** The shore tile at the water's edge, or null anywhere else. */
export function shoreTile(col: number, row: number): Tile | null {
  if (ringOf(col, row) !== 0) return null;
  if (chamfered(col, row)) return null; // the chamfer carries the rim here
  const north = row === 0;
  const south = row === FIELD - 1;
  const west = col === 0;
  const east = col === FIELD - 1;
  // The extreme corner cells are handled by `chamferTile`, which puts the wedge on
  // the island's own corner rather than out here where it touches nothing.
  if ((north || south) && (west || east)) return null;
  if (south) return RING.landAbove;
  if (north) return RING.landBelow;
  if (west) return RING.landRight;
  return RING.landLeft;
}

/**
 * Whether the bank's face is drawn on a cell: the `CLIFF_RINGS` of cells just
 * above the south shore, and never the shore cell itself — that tile is
 * transparent below its foam so the sea can show through, and a face behind it
 * would show through as brown water.
 */
export function isCliffFace(col: number, row: number): boolean {
  if (chamferTile(col, row)) return false; // the corner turns on its wedge instead
  const ring = ringOf(col, row);
  return ring >= COAST_RINGS && ring < COAST_RINGS + CLIFF_RINGS && facesSouth(col, row);
}

/** Whether the grass on a cell carries the dark lip cut by the drop below it. */
export function isLip(col: number, row: number): boolean {
  return ringOf(col, row) === COAST_RINGS + CLIFF_RINGS && facesSouth(col, row);
}

/** Which tile of the sea block a cell takes, so the mottle stays seamless. */
export function seaTile(col: number, row: number): Tile {
  const wrap = (n: number): number => ((n % SEA_BLOCK) + SEA_BLOCK) % SEA_BLOCK;
  return { col: wrap(col), row: wrap(row) };
}

// Value noise, as `field.ts` uses for the grass: the same water always glints.
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Where the open water glints, and how far into its cycle — offset per cell so
 * the sea twinkles rather than blinking all at once. Null on land.
 */
export function sparkleAt(col: number, row: number): { phase: number } | null {
  if (ringOf(col, row) >= 0) return null; // only out past the shore
  if (hash(col, row, SPARKLE_SEED) >= SPARKLE_SHARE) return null;
  return { phase: hash(col, row, SPARKLE_SEED + 1) };
}

/** Frame of a strip whose frames each hold for `hold` seconds. */
export function frameOf(t: number, hold: number, frames: number): number {
  return Math.floor(t / hold) % frames;
}

/** World-pixel corner of a cell, for the callers that draw one. */
export function cellAt(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE, y: row * TILE };
}
