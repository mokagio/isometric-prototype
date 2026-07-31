import { FIELD } from "./field";

// The island's outline. A rectangle reads as a cut-out rather than a place, so
// each shore wanders in and out by a cell or two — the coastlines in the pack's
// own scenes are all steps like this, never a straight run into a square corner.
//
// The wander is a pure function of the cell, like the wood and the grass: no map
// stores it, both games agree on it, and the editor can lean on it.

/** Deepest a shore ever cuts in from the field's border, in cells. */
export const JAG = 3;

// A shore steps by at most a cell at a time, and holds that depth for a run, so
// the coast reads as headlands and bays rather than as noise.
const RUN = 4; // cells before the depth may change again
const SHAPE_SEED = 7723;

type Side = "north" | "east" | "south" | "west";
const SIDE_SALT: Record<Side, number> = { north: 0, east: 101, south: 202, west: 303 };

function hash(x: number, seed: number): number {
  let h = (x * 374761393 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * How far in the shore lies at one point along a side, in cells.
 *
 * Walked rather than picked: each run of cells steps at most one deeper or one
 * shallower than the run before it, so neighbouring steps always meet on a
 * diagonal the corner tiles can turn. Picking a depth per cell outright would
 * leave cliffs of three cells that no tile in the pack can join.
 */
export function shoreDepth(side: Side, along: number): number {
  const run = Math.floor(along / RUN);
  let depth = 1;
  for (let i = 0; i <= run; i++) {
    const roll = hash(i, SHAPE_SEED + SIDE_SALT[side]);
    if (roll < 0.35) depth -= 1;
    else if (roll > 0.65) depth += 1;
    depth = Math.max(0, Math.min(JAG, depth));
  }
  return depth;
}

/**
 * Whether a cell is part of the island.
 *
 * Each side pushes in independently, so the corners are where two wanders meet —
 * which is what gives the island its headlands.
 */
export function isLand(col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= FIELD || row >= FIELD) return false;
  if (row < shoreDepth("north", col)) return false;
  if (row > FIELD - 1 - shoreDepth("south", col)) return false;
  if (col < shoreDepth("west", row)) return false;
  if (col > FIELD - 1 - shoreDepth("east", row)) return false;
  return true;
}

/** Land on each side of a cell — everything the shore tiles are chosen from. */
export function neighbours(col: number, row: number): {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
} {
  return {
    north: isLand(col, row - 1),
    east: isLand(col + 1, row),
    south: isLand(col, row + 1),
    west: isLand(col - 1, row),
  };
}
