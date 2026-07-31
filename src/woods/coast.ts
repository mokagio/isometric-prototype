import { FENCE_RING, FIELD, TILE } from "./field";
import { isLand, neighbours } from "./shape";

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
  return !isLand(col, row);
}

/** Whether a cell's shore is the south one — the only shore with a face. */
export function facesSouth(col: number, row: number): boolean {
  return isLand(col, row) && !isLand(col, row + 1);
}

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
  if (!isLand(col, row)) return null;
  const { north, east, south, west } = neighbours(col, row);
  // A headland: water on two sides at once, so the coast turns here. The wedge
  // carries the land in the quadrant that stays dry.
  if (!north && !west) return RING.landBelowRight;
  if (!north && !east) return RING.landBelowLeft;
  if (!south && !west) return RING.landAboveRight;
  if (!south && !east) return RING.landAboveLeft;
  return null;
}

/**
 * The shore tile on a stretch of water, or null where the water touches nothing.
 *
 * Chosen from which sides of the cell the island lies on, which is why the ring's
 * tiles are named for where their land is: a cell with land above it wants the
 * tile whose land is above. Water with land on two sides is a bay's corner and
 * takes the matching wedge; water touching the island only on a diagonal is open
 * sea, and takes nothing.
 */
export function shoreTile(col: number, row: number): Tile | null {
  if (isLand(col, row)) return null;
  const { north, east, south, west } = neighbours(col, row);
  if (north && west) return RING.landAboveLeft;
  if (north && east) return RING.landAboveRight;
  if (south && west) return RING.landBelowLeft;
  if (south && east) return RING.landBelowRight;
  if (north) return RING.landAbove;
  if (south) return RING.landBelow;
  if (west) return RING.landLeft;
  if (east) return RING.landRight;
  return null;
}

/**
 * Whether the bank's face is drawn on a cell: the `CLIFF_RINGS` of cells just
 * above the south shore, and never the shore cell itself — that tile is
 * transparent below its foam so the sea can show through, and a face behind it
 * would show through as brown water.
 */
export function isCliffFace(col: number, row: number): boolean {
  if (chamferTile(col, row)) return false; // the corner turns on its wedge instead
  return facesSouth(col, row);
}

/** Whether the grass on a cell carries the dark lip cut by the drop below it. */
export function isLip(col: number, row: number): boolean {
  return isLand(col, row) && isCliffFace(col, row + 1);
}

/**
 * The lip's own corner tile at either end of its run, where the drop turns and the
 * dark edge has to curve down with it rather than stopping square. `cliffTop.png`
 * holds the pair, one for each end.
 */
export function lipCornerTile(col: number, row: number): Tile | null {
  if (!isLip(col, row)) return null;
  // Where the drop below runs out, the dark edge has to curve down after it
  // rather than stopping square. Which way it curves depends on which side the
  // drop carries on.
  const dropWest = isCliffFace(col - 1, row + 1) || isCliffFace(col - 1, row);
  const dropEast = isCliffFace(col + 1, row + 1) || isCliffFace(col + 1, row);
  if (dropEast && !dropWest) return { col: 0, row: 0 };
  if (dropWest && !dropEast) return { col: 1, row: 0 };
  return null;
}

// `fence.png`, cut as a strip: a post with rails running across, one with the
// rail running down, and the two corner posts — rail east and rail west, each
// with its shaft running south.
const FENCE = {
  across: { col: 0, row: 0 },
  down: { col: 1, row: 0 },
  cornerRailEast: { col: 2, row: 0 },
  cornerRailWest: { col: 3, row: 0 },
} as const;

// The fence stays a plain rectangle however the shore wanders, and it is what the
// walker and the editor are held inside: the coast is scenery beyond it. It sits
// deep enough in that the deepest bay still leaves room for the water's edge, the
// drop's face and its lip outside it — see `FENCE_RING`.
const FENCE_FIRST = FENCE_RING;
const FENCE_LAST = FIELD - 1 - FENCE_RING;

/**
 * The fence, and whether its tile is stood on its head. A closed run right round
 * the island: rails across the north and south, down the east and west, and a
 * corner post where they turn.
 */
export function fenceTile(col: number, row: number): { tile: Tile; flipV: boolean } | null {
  if (ringOf(col, row) !== FENCE_RING) return null;
  const first = col === FENCE_FIRST;
  const last = col === FENCE_LAST;
  const top = row === FENCE_FIRST;
  const bottom = row === FENCE_LAST;
  // The corner posts are cut with their shaft running south, so the two southern
  // corners are the same posts stood on their heads.
  if (top && first) return { tile: FENCE.cornerRailEast, flipV: false };
  if (top && last) return { tile: FENCE.cornerRailWest, flipV: false };
  if (bottom && first) return { tile: FENCE.cornerRailEast, flipV: true };
  if (bottom && last) return { tile: FENCE.cornerRailWest, flipV: true };
  if (top || bottom) return { tile: FENCE.across, flipV: false };
  return { tile: FENCE.down, flipV: false };
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
