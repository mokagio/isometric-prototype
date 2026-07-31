// Every tile the pack gives you for the edge of an island, named and given a
// character, so a coastline can be written down and drawn by hand.
//
// The autotiler in `coast.ts` picks from a handful of these by looking at a
// cell's neighbours. This is the whole set instead, laid out for someone with a
// mouse: the sand beach the pack cut alongside the grass one, the cliff's own
// corners and feet, the seams where grass meets sand.

/** Which vendored strip a tile is cut from. `shore` swaps with `shore2` as it surfs. */
export type CoastSheetId =
  | "shore"
  | "cliff"
  | "lip"
  | "lipCorner"
  | "fence"
  | "grassSand"
  | "grassEdge"
  | "sandDeco";

/** What ground is painted under a tile before it is drawn. The sea is always there. */
export type Under = "none" | "grass" | "sand";

export type CoastGroupId = "ground" | "edge" | "beach" | "fringe" | "cliff" | "top" | "seam" | "fence";

export interface CoastGroup {
  id: CoastGroupId;
  label: string;
}

export interface CoastTile {
  /** One character: how the cell is written down in a saved outline. */
  code: string;
  label: string;
  group: CoastGroupId;
  under: Under;
  /** Absent for the plain grounds, which are nothing but what is under them. */
  sheet?: CoastSheetId;
  col?: number;
  row?: number;
  /** The pack's own trick for reusing a corner post on the far side. */
  flipV?: boolean;
}

export const COAST_GROUPS: CoastGroup[] = [
  { id: "ground", label: "Ground" },
  { id: "edge", label: "Shore" },
  { id: "beach", label: "Beach" },
  { id: "fringe", label: "Grass edge" },
  { id: "cliff", label: "Cliff" },
  { id: "top", label: "Cliff top" },
  { id: "seam", label: "Seams" },
  { id: "fence", label: "Fence" },
];

/** An empty cell: open water, with nothing laid on it. */
export const SEA_CODE = "~";
export const GRASS_CODE = ".";

const ground = (code: string, label: string, under: Under): CoastTile => ({
  code,
  label,
  group: "ground",
  under,
});

const tile = (
  code: string,
  label: string,
  group: CoastGroupId,
  sheet: CoastSheetId,
  col: number,
  row: number,
  under: Under = "none",
  flipV = false,
): CoastTile => ({ code, label, group, under, sheet, col, row, flipV });

// The shore ring is cut for a *lake* — land around the outside, water in the
// middle — so an island reads it inside out and the names cross over: the tile
// with land along its top edge is the island's south shore. The codes are laid
// out on the keyboard the way the ring is laid out on the sheet, so `q w e` is
// its top row and `z x c` its bottom.
export const COAST_TILES: CoastTile[] = [
  ground(SEA_CODE, "Open water", "none"),
  ground(GRASS_CODE, "Grass", "grass"),
  ground(",", "Sand", "sand"),

  tile("q", "South-east corner", "edge", "shore", 0, 0),
  tile("w", "South shore", "edge", "shore", 1, 0),
  tile("e", "South-west corner", "edge", "shore", 2, 0),
  tile("a", "East shore", "edge", "shore", 0, 1),
  tile("d", "West shore", "edge", "shore", 2, 1),
  tile("z", "North-east corner", "edge", "shore", 0, 2),
  tile("x", "North shore", "edge", "shore", 1, 2),
  tile("c", "North-west corner", "edge", "shore", 2, 2),

  // The pack cut a second ring in sand, but only the shore that faces the
  // camera: a top edge, its two corners, and the two corners that close it off.
  tile("Q", "Beach, south-east", "beach", "shore", 0, 3),
  tile("W", "Beach, south", "beach", "shore", 1, 3),
  tile("E", "Beach, south-west", "beach", "shore", 2, 3),
  tile("Z", "Beach, turning east", "beach", "shore", 0, 4),
  tile("C", "Beach, turning west", "beach", "shore", 2, 4),
  tile("f", "Sand, shells", "beach", "sandDeco", 0, 0),
  tile("r", "Sand, pebbles", "beach", "sandDeco", 1, 0),
  tile("p", "Sand, one pebble", "beach", "sandDeco", 2, 0),

  // The pack's own ragged grass edges: two that fringe a straight side, two that
  // cut the cell on the diagonal so the grass ends in a point.
  tile("n", "Grass, fringed above", "fringe", "grassEdge", 0, 0),
  tile("m", "Grass, fringed left", "fringe", "grassEdge", 1, 0),
  tile("b", "Grass, cut from the left", "fringe", "grassEdge", 2, 0),
  tile("u", "Grass, cut from the right", "fringe", "grassEdge", 3, 0),

  tile("7", "Cliff, cut left", "cliff", "cliff", 0, 0),
  tile("8", "Cliff top", "cliff", "cliff", 1, 0),
  tile("9", "Cliff, cut right", "cliff", "cliff", 2, 0),
  tile("4", "Cliff face", "cliff", "cliff", 0, 1),
  tile("5", "Cliff face 2", "cliff", "cliff", 1, 1),
  tile("6", "Cliff face 3", "cliff", "cliff", 2, 1),
  tile("1", "Cliff into sand, left", "cliff", "cliff", 0, 2),
  tile("3", "Cliff into sand, right", "cliff", "cliff", 2, 2),
  tile("t", "Cliff into grass, left", "cliff", "cliff", 0, 3),
  tile("y", "Cliff into grass, right", "cliff", "cliff", 2, 3),

  tile("_", "Lip", "top", "lip", 0, 0, "grass"),
  tile("<", "Lip turning left", "top", "lipCorner", 0, 0, "grass"),
  tile(">", "Lip turning right", "top", "lipCorner", 1, 0, "grass"),

  tile("g", "Sand into grass, left", "seam", "grassSand", 0, 0),
  tile("h", "Sand into grass, right", "seam", "grassSand", 1, 0),
  tile("j", "Grass seam, left", "seam", "grassSand", 2, 0),
  tile("k", "Grass seam, right", "seam", "grassSand", 3, 0),

  tile("-", "Rail across", "fence", "fence", 0, 0, "grass"),
  tile("|", "Rail down", "fence", "fence", 1, 0, "grass"),
  tile("[", "Corner, rail east", "fence", "fence", 2, 0, "grass"),
  tile("]", "Corner, rail west", "fence", "fence", 3, 0, "grass"),
  tile("{", "Corner, rail east, upended", "fence", "fence", 2, 0, "grass", true),
  tile("}", "Corner, rail west, upended", "fence", "fence", 3, 0, "grass", true),
];

/** How big each strip is, in tiles, so a mistyped position fails the suite. */
export const COAST_SHEET_SIZE: Record<CoastSheetId, { cols: number; rows: number }> = {
  shore: { cols: 3, rows: 5 },
  cliff: { cols: 3, rows: 4 },
  lip: { cols: 1, rows: 1 },
  lipCorner: { cols: 2, rows: 1 },
  fence: { cols: 4, rows: 1 },
  grassSand: { cols: 4, rows: 1 },
  grassEdge: { cols: 4, rows: 1 },
  sandDeco: { cols: 3, rows: 1 },
};

const BY_CODE = new Map(COAST_TILES.map((t) => [t.code, t]));

/** The tile a character stands for, or open water if the character is not one. */
export const coastTile = (code: string): CoastTile => BY_CODE.get(code) ?? COAST_TILES[0]!;

export const isCoastCode = (code: string): boolean => BY_CODE.has(code);

export const coastTilesIn = (group: CoastGroupId): CoastTile[] =>
  COAST_TILES.filter((t) => t.group === group);
