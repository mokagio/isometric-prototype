import { hash, pick } from "./rng";
import type { TileName } from "./tiles";

// Which sheet tiles a cell is built from, given only its four neighbours. A
// cell can face floor on several of them, and each of those sides needs its own
// border, so the rules stack pieces rather than choosing between them.
//
// The sheet draws a wall as a 16px brick face with a 4px lit lip along its top
// edge, and the lip lives in the bottom of its own `wall_top_*` tile. So a wall
// the player looks at head-on — one with floor to its south — is two pieces: the
// face in its own cell and the lip one cell up. Every other wall is seen from
// above or behind, and shows only its lit edge over the void.
//
// Which is why a run going north-south takes `wall_edge_mid_*` — the bare strip
// — and not `wall_edge_*`, which carries a full brick face for the cell where a
// head-on run turns the corner.

export interface Piece {
  tile: TileName;
  /** Offset from the cell's top-left corner, in sheet pixels. */
  dx: number;
  dy: number;
  /** A wall the player looks at head-on — the only piece a banner can hang on. */
  face?: boolean;
}

export type FloorAt = (col: number, row: number) => boolean;

const FLOORS: readonly TileName[] = [
  "floor_1",
  "floor_1",
  "floor_1",
  "floor_1",
  "floor_2",
  "floor_3",
  "floor_4",
  "floor_5",
  "floor_6",
  "floor_7",
  "floor_8",
];

const BANNERS: readonly TileName[] = [
  "wall_banner_red",
  "wall_banner_blue",
  "wall_banner_green",
  "wall_banner_yellow",
];

const BANNER_CHANCE = 0.07;

/** Floor variant for a cell — mostly plain flagstones, occasionally cracked. */
export function floorTile(col: number, row: number, seed: number): TileName {
  return pick(FLOORS, col, row, seed);
}

/** A banner hung on a head-on wall face, or null. Only ever on `wallPieces` faces. */
export function bannerTile(col: number, row: number, seed: number): TileName | null {
  if (hash(col, row, seed + 991) >= BANNER_CHANCE) return null;
  return pick(BANNERS, col, row, seed + 3571);
}

export function wallPieces(isFloor: FloorAt, col: number, row: number): Piece[] {
  if (isFloor(col, row)) return [];

  const south = isFloor(col, row + 1);
  const north = isFloor(col, row - 1);
  const west = isFloor(col - 1, row);
  const east = isFloor(col + 1, row);

  // Every side facing floor gets its own piece. A cell on a corner faces floor
  // more than one way, and picking a single tile for it leaves the other sides
  // opening straight onto the void.
  const pieces: Piece[] = [];

  // `wall_edge_left`/`_right` are the face with that side's lit edge already on
  // it, so a corner of a head-on run is one piece rather than a face plus a
  // strip drawn over it.
  const faceLitWest = west && !east;
  const faceLitEast = east && !west;

  if (south) {
    const face: TileName = faceLitWest ? "wall_edge_left" : faceLitEast ? "wall_edge_right" : "wall_mid";
    // The lip is capped on whichever side the floor below stops.
    const lip: TileName = !isFloor(col - 1, row + 1)
      ? "wall_top_left"
      : !isFloor(col + 1, row + 1)
        ? "wall_top_right"
        : "wall_top_mid";
    pieces.push({ tile: face, dx: 0, dy: 0, face: true }, { tile: lip, dx: 0, dy: -16 });
  } else if (north) {
    // The far side of a room is the same one-cell wall, stood the other way up:
    // the lip caps the cell where it meets the floor, and the brick fills the
    // rest. Lip second, so it paints over the top of the body.
    pieces.push({ tile: "wall_mid", dx: 0, dy: 0 }, { tile: "wall_top_mid", dx: 0, dy: -12 });
  }

  if (west && !(south && faceLitWest)) pieces.push({ tile: "wall_edge_mid_left", dx: 0, dy: 0 });
  if (east && !(south && faceLitEast)) pieces.push({ tile: "wall_edge_mid_right", dx: 0, dy: 0 });

  if (pieces.length > 0) return pieces;
  return cornerPieces(isFloor, col, row);
}

/**
 * The cell diagonally off the corner of a room. It faces no floor at all, so
 * every rule above passes it over — and it is the cell where the run down the
 * side and the run along the top would meet, so leaving it blank is the notch
 * that opens at every corner.
 *
 * The sheet keeps a set for exactly this: a corner is the same face or lip as
 * its run, with the lit edge carried round the turn.
 */
function cornerPieces(isFloor: FloorAt, col: number, row: number): Piece[] {
  const southEast = isFloor(col + 1, row + 1);
  const southWest = isFloor(col - 1, row + 1);
  const northEast = isFloor(col + 1, row - 1);
  const northWest = isFloor(col - 1, row - 1);

  // Floor below and to one side: the top corner of a room, where the run down
  // the side begins. One piece — the cap that closes off the run's top end,
  // whose nub sits in the same column the run comes down.
  if (southEast && !southWest) return [{ tile: "wall_outer_top_left", dx: 0, dy: 0 }];
  if (southWest && !southEast) return [{ tile: "wall_outer_top_right", dx: 0, dy: 0 }];
  // Floor above and to one side: the bottom corner, built the same way the far
  // wall is — a body filling the cell and a cap at the top of it — but with the
  // corner's own pieces, whose ink sits in the column the side run came down.
  if (northEast && !northWest) {
    return [
      { tile: "wall_outer_front_left", dx: 0, dy: 0 },
      { tile: "wall_outer_top_left", dx: 0, dy: -12 },
    ];
  }
  if (northWest && !northEast) {
    return [
      { tile: "wall_outer_front_right", dx: 0, dy: 0 },
      { tile: "wall_outer_top_right", dx: 0, dy: -12 },
    ];
  }
  return [];
}
