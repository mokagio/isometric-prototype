import { TILE_FPS, type Category, type Ground, type Prop, type StampTile } from "./library";
import type { SheetId } from "./sheets";

// The Sunnyside pack, named. Every entry addresses a cell of a vendored sheet,
// so this file is the whole library: nothing is re-cut, and a wrong tile is a
// number to change rather than a PNG to re-export.
//
// Coordinates are (col, row) on `tileset.png` unless a sheet is named. They come
// from the pack's own GameMaker project where it says anything — the autotile
// sets, the tile animations and the example room's assembled buildings are all
// read out of it — and from measuring the sheet where it does not.

export const CATEGORIES: Category[] = [
  { id: "ground", label: "Ground" },
  { id: "paths", label: "Paths & Water" },
  { id: "trees", label: "Trees" },
  { id: "flowers", label: "Flowers & Rocks" },
  { id: "houses", label: "Houses" },
  { id: "village", label: "Village" },
  { id: "fences", label: "Fences" },
  { id: "farm", label: "Garden" },
  { id: "animals", label: "Animals" },
  { id: "props", label: "Things" },
];

// Ground ---------------------------------------------------------------------

export const GROUND: Ground[] = [
  {
    id: "grass",
    label: "Grass",
    category: "ground",
    kind: "tile",
    sheet: "tileset",
    // The four the game already paints its field with: plain, then three sprinklings.
    variants: [
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 3, row: 2 },
      { col: 5, row: 2 },
    ],
  },
  {
    id: "grass-clover",
    label: "Clover",
    category: "ground",
    kind: "tile",
    sheet: "tileset",
    variants: [
      { col: 2, row: 1 },
      { col: 2, row: 2 },
      { col: 4, row: 2 },
      { col: 6, row: 2 },
    ],
  },
  {
    id: "sand",
    label: "Sand",
    category: "ground",
    kind: "tile",
    sheet: "tileset",
    variants: [
      { col: 5, row: 1 },
      { col: 7, row: 1 },
      { col: 8, row: 1 },
      { col: 9, row: 1 },
    ],
  },
  {
    id: "dirt",
    label: "Dirt",
    category: "ground",
    kind: "tile",
    sheet: "tileset",
    variants: [
      { col: 1, row: 7 },
      { col: 9, row: 7 },
      { col: 10, row: 7 },
      { col: 11, row: 7 },
    ],
  },
  {
    id: "pale-ground",
    label: "Pale Earth",
    category: "ground",
    kind: "tile",
    sheet: "tileset",
    variants: [
      { col: 34, row: 7 },
      { col: 42, row: 7 },
      { col: 43, row: 7 },
      { col: 42, row: 8 },
    ],
  },
  {
    id: "floor-wood",
    label: "Floorboards",
    category: "ground",
    kind: "tile",
    sheet: "tileset",
    variants: [{ col: 1, row: 9 }],
  },
  {
    id: "floor-stone",
    label: "Flagstones",
    category: "ground",
    kind: "tile",
    sheet: "tileset",
    variants: [{ col: 1, row: 15 }],
  },
  {
    id: "dark-earth",
    label: "Dark Earth",
    category: "ground",
    kind: "tile",
    sheet: "tileset",
    variants: [{ col: 6, row: 1 }],
  },
];

// Paths and water.
//
// Plain fills, not the pack's autotile sets. Those sets are decoded and named in
// `ASSETS.md`, but their edge tiles are cut for the cells *outside* the path,
// feathering inwards over it, so laying one on the path itself puts the grass
// fringe on the wrong side of the boundary. Square edges until that is worth
// doing properly.
export const TERRAIN: Ground[] = [
  {
    id: "path",
    label: "Dirt Path",
    category: "paths",
    kind: "tile",
    sheet: "tileset",
    variants: [
      { col: 1, row: 7 },
      { col: 9, row: 7 },
      { col: 10, row: 7 },
      { col: 11, row: 7 },
    ],
  },
  {
    id: "path-brown",
    label: "Bare Path",
    category: "paths",
    kind: "tile",
    sheet: "tileset",
    variants: [
      { col: 12, row: 7 },
      { col: 20, row: 7 },
      { col: 21, row: 7 },
      { col: 20, row: 8 },
    ],
  },
  {
    id: "path-pale",
    label: "Pale Path",
    category: "paths",
    kind: "tile",
    sheet: "tileset",
    variants: [
      { col: 34, row: 7 },
      { col: 42, row: 7 },
      { col: 43, row: 7 },
      { col: 42, row: 8 },
    ],
  },
  {
    id: "river",
    label: "Water",
    category: "paths",
    kind: "tile",
    sheet: "tileset",
    variants: [{ col: 22, row: 7 }],
    solid: true, // water you cannot wade, same as the sea round the island
  },
  {
    id: "sea",
    label: "Deep Water",
    category: "paths",
    kind: "tile",
    sheet: "tileset",
    variants: [
      { col: 11, row: 18 },
      { col: 12, row: 18 },
      { col: 11, row: 19 },
      { col: 12, row: 19 },
    ],
    solid: true,
  },
];

// Props ----------------------------------------------------------------------

/** `[dx, dy, col, row]`, plus the pack's own vertical flip where it uses one. */
type StampSpec = [number, number, number, number] | [number, number, number, number, "v"];

const tiles = (spec: StampSpec[], rowOffset = 0): StampTile[] =>
  spec.map(([dx, dy, col, row, flip]) =>
    flip ? { dx, dy, col, row: row + rowOffset, flip } : { dx, dy, col, row: row + rowOffset },
  );

/** A single tile standing on its own cell. */
function one(
  id: string,
  label: string,
  category: Prop["category"],
  col: number,
  row: number,
  solid: Prop["solid"] = "none",
): Prop {
  return {
    id,
    label,
    category,
    w: 1,
    h: 1,
    base: { dx: 0, dy: 0 },
    art: { kind: "tiles", sheet: "tileset", tiles: [{ dx: 0, dy: 0, col, row }] },
    solid,
  };
}

/** A block of tiles standing on its bottom-left cell. */
function block(
  id: string,
  label: string,
  category: Prop["category"],
  col: number,
  row: number,
  w: number,
  h: number,
  solid: Prop["solid"] = "base",
): Prop {
  const spec: StampTile[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) spec.push({ dx, dy, col: col + dx, row: row + dy });
  return { id, label, category, w, h, base: { dx: 0, dy: h - 1 }, art: { kind: "tiles", sheet: "tileset", tiles: spec }, solid };
}

/** Marks a thing as lying flat on the ground, so others can stand on top of it. */
const flat = (prop: Prop): Prop => ({ ...prop, layer: "flat", solid: "none" });

/** A tile that sways on the spot, from the tileset's own animation frames. */
function swaying(
  id: string,
  label: string,
  category: Prop["category"],
  col: number,
  row: number,
  frames = 4,
): Prop {
  return {
    id,
    label,
    category,
    w: 1,
    h: 1,
    base: { dx: 0, dy: 0 },
    art: { kind: "tileStrip", sheet: "tileset", col, row, frames, fps: TILE_FPS },
    solid: "none",
  };
}

const TREES: Prop[] = [
  {
    id: "tree",
    label: "Tree",
    category: "trees",
    w: 1,
    h: 2,
    base: { dx: 0, dy: 1 },
    // The game's own tree, so a placed one is the one you can chop.
    art: { kind: "sprite", sheet: "tree", frames: 4, fps: 4, anchorX: 16, anchorY: 32 },
    solid: "base",
  },
  {
    id: "tree-tall",
    label: "Tall Tree",
    category: "trees",
    w: 1,
    h: 3,
    base: { dx: 0, dy: 2 },
    art: { kind: "sprite", sheet: "treeTall", frames: 4, fps: 4, anchorX: 14, anchorY: 40 },
    solid: "base",
  },
  block("pine", "Pine", "trees", 52, 3, 1, 3),
  block("pine-big", "Big Pine", "trees", 52, 6, 1, 3),
  block("tree-round", "Round Tree", "trees", 51, 1, 2, 2),
  {
    id: "forest-pine",
    label: "Forest Pine",
    category: "trees",
    w: 2,
    h: 4,
    base: { dx: 0, dy: 3 },
    art: { kind: "tiles", sheet: "forest", tiles: tiles([[0, 0, 8, 2], [0, 1, 8, 3]]) },
    solid: "base",
  },
  {
    id: "forest-patch",
    label: "Forest Patch",
    category: "trees",
    w: 2,
    h: 2,
    base: { dx: 0, dy: 1 },
    art: { kind: "tiles", sheet: "forest", tiles: tiles([[0, 0, 1, 1]]) },
    solid: "base",
  },
  block("bush-berry", "Berry Bush", "trees", 49, 1, 2, 2),
  block("bush-berry-red", "Red Berry Bush", "trees", 49, 3, 2, 2),
  block("bush-berry-orange", "Orange Berry Bush", "trees", 49, 5, 2, 2),
  swaying("bush", "Bush", "trees", 27, 1),
  swaying("bush-small", "Small Bush", "trees", 27, 2),
  swaying("bush-tall", "Tall Bush", "trees", 27, 3),
  swaying("bush-wide", "Wide Bush", "trees", 27, 4),
  one("bush-round", "Round Bush", "trees", 51, 4),
  one("stump", "Stump", "trees", 32, 5, "base"),
  one("stump-dark", "Old Stump", "trees", 31, 5, "base"),
  {
    id: "log",
    label: "Log",
    category: "trees",
    w: 1,
    h: 1,
    base: { dx: 0, dy: 0 },
    art: { kind: "sprite", sheet: "log", frames: 1, fps: 0, anchorX: 5.5, anchorY: 11 },
    solid: "none",
  },
  {
    id: "mushroom-red",
    label: "Red Mushroom",
    category: "trees",
    w: 1,
    h: 1,
    base: { dx: 0, dy: 0 },
    art: { kind: "sprite", sheet: "mushroomRed", frames: 4, fps: 4, anchorX: 10, anchorY: 14 },
    solid: "none",
  },
  {
    id: "mushroom-blue",
    label: "Blue Mushroom",
    category: "trees",
    w: 1,
    h: 1,
    base: { dx: 0, dy: 0 },
    art: { kind: "sprite", sheet: "mushroomBlue", frames: 4, fps: 4, anchorX: 6, anchorY: 16 },
    solid: "none",
  },
];

const FLOWERS: Prop[] = [
  one("flower-blue", "Blue Flower", "flowers", 31, 1),
  one("flowers-blue", "Blue Flowers", "flowers", 33, 1),
  one("flower-blue-big", "Big Blue Flower", "flowers", 34, 1),
  one("flower-red", "Red Flower", "flowers", 31, 2),
  one("flowers-red", "Red Flowers", "flowers", 33, 2),
  one("flower-red-big", "Big Red Flower", "flowers", 34, 2),
  one("flower-white", "Daisy", "flowers", 31, 3),
  one("flowers-white", "Daisies", "flowers", 33, 3),
  one("flower-white-big", "Big Daisy", "flowers", 34, 3),
  one("flower-patch", "Daisy Patch", "flowers", 35, 3),
  one("rock", "Rock", "flowers", 31, 4, "base"),
  one("rocks", "Rocks", "flowers", 32, 4, "base"),
  one("rock-small", "Small Rock", "flowers", 33, 4),
  one("pebble", "Pebble", "flowers", 34, 4),
  one("berry-red", "Red Berry", "flowers", 48, 2),
  one("berries-red", "Red Berries", "flowers", 48, 3),
  one("berries-orange", "Orange Berries", "flowers", 48, 4),
  one("berry-orange", "Orange Berry", "flowers", 48, 5),
  one("crystal", "Crystal", "flowers", 49, 7, "base"),
  one("crystals", "Crystals", "flowers", 50, 7, "base"),
  one("crystal-small", "Small Crystal", "flowers", 50, 8),
  block("boulder-stone", "Boulder", "flowers", 49, 23, 2, 2, "all"),
  block("boulder-silver", "Silver Rock", "flowers", 49, 21, 2, 2, "all"),
  block("boulder-crystal", "Crystal Rock", "flowers", 49, 25, 2, 2, "all"),
  block("boulder-gold", "Gold Rock", "flowers", 49, 27, 2, 2, "all"),
  one("stone", "Stone", "flowers", 55, 24, "base"),
  one("stone-crystal", "Crystal Stone", "flowers", 55, 26, "base"),
  one("stone-gold", "Gold Stone", "flowers", 55, 28, "base"),
  one("shell", "Shell", "flowers", 59, 19),
  one("starfish", "Starfish", "flowers", 58, 19),
  one("coral", "Coral", "flowers", 57, 19),
  one("sea-stone", "Sea Stone", "flowers", 56, 19),
  swaying("crab", "Crab", "flowers", 60, 19, 2),
];

// Houses. Each stamp is one of the buildings standing in the pack's own example
// room, trimmed to the tiles inside its colour block. The block repeats every
// eight rows in five colours, its shapes pixel-identical throughout, so a stamp
// is drawn once and its colours come from an offset.
const HOUSE_COLOURS: Array<{ id: string; label: string; row: number }> = [
  { id: "blue", label: "Blue", row: 9 },
  { id: "green", label: "Green", row: 17 },
  { id: "orange", label: "Orange", row: 25 },
  { id: "red", label: "Red", row: 33 },
  { id: "purple", label: "Purple", row: 41 },
];

interface HouseStamp {
  id: string;
  label: string;
  w: number;
  h: number;
  /** Rows are within the eight-row colour block, so a colour is an offset. */
  tiles: StampSpec[];
}

const HOUSE_STAMPS: HouseStamp[] = [
  {
    id: "hut-tiny",
    label: "Tiny Hut",
    w: 3,
    h: 2,
    tiles: [
      [0, 0, 29, 3], [0, 1, 29, 4], [1, 0, 30, 3], [1, 1, 30, 4], [2, 0, 31, 3], [2, 1, 31, 4],
    ],
  },
  {
    id: "hut",
    label: "Hut",
    w: 3,
    h: 3,
    tiles: [
      [0, 0, 32, 0], [0, 1, 32, 3], [0, 2, 32, 4], [1, 0, 33, 0], [1, 1, 33, 3], [1, 2, 33, 4],
      [2, 0, 34, 0], [2, 1, 34, 3], [2, 2, 34, 4],
    ],
  },
  {
    id: "stall-small",
    label: "Small Stall",
    w: 3,
    h: 3,
    tiles: [
      [0, 0, 32, 0], [0, 1, 32, 3], [0, 2, 32, 4], [1, 0, 33, 0], [1, 1, 33, 3], [2, 0, 34, 0],
      [2, 1, 34, 3], [2, 2, 34, 4],
    ],
  },
  {
    id: "stall",
    label: "Market Stall",
    w: 4,
    h: 3,
    tiles: [
      [0, 0, 32, 0], [0, 1, 32, 3], [0, 2, 32, 4], [1, 0, 33, 0], [1, 1, 33, 3], [2, 0, 33, 0],
      [2, 1, 33, 3], [3, 0, 34, 0], [3, 1, 34, 3], [3, 2, 34, 4],
    ],
  },
  {
    id: "tower-small",
    label: "Turret",
    w: 2,
    h: 5,
    tiles: [
      [0, 0, 33, 0], [0, 1, 33, 2], [0, 2, 33, 3], [0, 3, 33, 4], [0, 4, 25, 6], [1, 0, 34, 0],
      [1, 1, 34, 2], [1, 2, 34, 3], [1, 3, 34, 4], [1, 4, 28, 5],
    ],
  },
  {
    id: "shop",
    label: "Shop",
    w: 4,
    h: 4,
    tiles: [
      [0, 0, 17, 0, "v"], [0, 1, 15, 2], [0, 2, 15, 3], [0, 3, 15, 4], [1, 0, 16, 0], [1, 1, 18, 1],
      [1, 2, 16, 3], [1, 3, 16, 5], [2, 0, 16, 0], [2, 1, 18, 1], [2, 2, 16, 3], [2, 3, 16, 6],
      [3, 0, 17, 0], [3, 1, 17, 1], [3, 2, 17, 3], [3, 3, 17, 4],
    ],
  },
  {
    id: "tower",
    label: "Tower",
    w: 3,
    h: 6,
    tiles: [
      [0, 0, 32, 0], [0, 1, 32, 3], [0, 2, 32, 4], [0, 3, 17, 4, "v"], [0, 4, 17, 4, "v"], [0, 5, 15, 5],
      [1, 0, 33, 0], [1, 1, 33, 3], [1, 2, 33, 4], [1, 3, 33, 4], [1, 4, 33, 4], [2, 0, 34, 0],
      [2, 1, 34, 3], [2, 2, 34, 4], [2, 3, 17, 4], [2, 4, 17, 4], [2, 5, 17, 5],
    ],
  },
  {
    id: "house-two-storey",
    label: "Two Storeys",
    w: 4,
    h: 5,
    tiles: [
      [0, 0, 15, 0], [0, 1, 15, 3], [0, 2, 15, 4], [0, 3, 15, 5], [0, 4, 15, 5], [1, 0, 16, 0],
      [1, 1, 16, 3], [1, 2, 16, 5], [1, 3, 33, 4], [1, 4, 16, 6], [2, 0, 17, 0], [2, 1, 17, 3],
      [2, 2, 33, 1], [2, 3, 33, 3], [2, 4, 33, 4], [3, 2, 34, 1], [3, 3, 34, 3], [3, 4, 34, 4],
    ],
  },
  {
    id: "cottage",
    label: "Cottage",
    w: 5,
    h: 4,
    tiles: [
      [0, 0, 15, 0], [0, 1, 15, 2], [0, 2, 15, 3], [0, 3, 15, 4], [1, 0, 16, 0], [1, 1, 18, 1],
      [1, 2, 20, 1, "v"], [1, 3, 16, 5], [2, 0, 16, 0], [2, 1, 18, 1], [2, 2, 16, 3, "v"], [2, 3, 16, 6],
      [3, 0, 16, 0], [3, 1, 18, 1], [3, 2, 16, 3], [3, 3, 16, 5], [4, 0, 17, 0], [4, 1, 17, 2],
      [4, 2, 15, 3, "v"], [4, 3, 15, 4, "v"],
    ],
  },
  {
    id: "house",
    label: "House",
    w: 5,
    h: 5,
    tiles: [
      [0, 0, 17, 0, "v"], [0, 1, 15, 3], [0, 2, 15, 3], [0, 3, 15, 4], [0, 4, 15, 5], [1, 0, 16, 0],
      [1, 1, 16, 3], [1, 2, 16, 3], [1, 3, 16, 5], [2, 0, 16, 0], [2, 1, 20, 1], [2, 2, 16, 3],
      [2, 3, 16, 5], [2, 4, 33, 4], [3, 0, 16, 0], [3, 1, 16, 3], [3, 2, 16, 3], [3, 3, 16, 5],
      [3, 4, 33, 4], [4, 0, 17, 0], [4, 1, 17, 3], [4, 2, 17, 3], [4, 3, 17, 4], [4, 4, 15, 5, "v"],
    ],
  },
  {
    id: "house-gabled",
    label: "Gabled House",
    w: 5,
    h: 5,
    tiles: [
      [0, 0, 28, 6, "v"], [0, 1, 28, 2, "v"], [0, 2, 28, 2, "v"], [0, 3, 28, 3, "v"], [0, 4, 28, 4, "v"],
      [1, 0, 27, 1, "v"], [1, 1, 21, 2], [1, 2, 27, 2, "v"], [1, 3, 27, 3, "v"], [1, 4, 33, 4],
      [2, 0, 18, 1], [2, 1, 18, 1], [2, 2, 18, 1], [2, 3, 24, 4], [2, 4, 33, 4], [3, 0, 27, 1],
      [3, 1, 21, 2, "v"], [3, 2, 27, 2], [3, 3, 27, 3], [3, 4, 33, 4], [4, 0, 28, 6], [4, 1, 28, 2],
      [4, 2, 28, 2], [4, 3, 28, 3], [4, 4, 28, 4],
    ],
  },
  {
    id: "house-big",
    label: "Big House",
    w: 6,
    h: 6,
    tiles: [
      [0, 0, 15, 0], [0, 1, 15, 2], [0, 2, 17, 3, "v"], [0, 3, 15, 3], [0, 4, 15, 4], [1, 0, 16, 0],
      [1, 1, 18, 1], [1, 2, 16, 3], [1, 3, 16, 3], [1, 4, 16, 4], [2, 0, 16, 0], [2, 1, 18, 1],
      [2, 2, 16, 3], [2, 3, 16, 3], [2, 4, 16, 3], [2, 5, 16, 5], [3, 0, 16, 0], [3, 1, 18, 1],
      [3, 2, 16, 3], [3, 3, 16, 3], [3, 4, 16, 3], [3, 5, 16, 6], [4, 0, 16, 0, "v"], [4, 1, 18, 1],
      [4, 2, 16, 3], [4, 3, 16, 3], [4, 4, 16, 4], [5, 0, 15, 0, "v"], [5, 1, 17, 1], [5, 2, 17, 3],
      [5, 3, 15, 3, "v"], [5, 4, 15, 4, "v"],
    ],
  },
];

const HOUSES: Prop[] = HOUSE_STAMPS.flatMap((stamp) =>
  HOUSE_COLOURS.map((colour) => ({
    id: `${stamp.id}-${colour.id}`,
    label: `${colour.label} ${stamp.label}`,
    category: "houses" as const,
    w: stamp.w,
    h: stamp.h,
    base: { dx: 0, dy: stamp.h - 1 },
    art: { kind: "tiles" as const, sheet: "tileset" as const, tiles: tiles(stamp.tiles, colour.row) },
    solid: "all" as const,
  })),
);

const VILLAGE: Prop[] = [
  block("well", "Well", "village", 37, 19, 2, 2, "all"),
  block("fountain", "Fountain", "village", 40, 19, 2, 2, "all"),
  block("fire-pit", "Fire Pit", "village", 37, 21, 2, 2, "base"),
  {
    id: "campfire",
    label: "Campfire",
    category: "village",
    w: 1,
    h: 1,
    base: { dx: 0, dy: 0 },
    art: { kind: "sprite", sheet: "fire", frames: 4, fps: 10, anchorX: 4, anchorY: 12 },
    solid: "none",
  },
  block("statue-knight", "Knight Statue", "village", 44, 18, 2, 4, "all"),
  block("statue", "Statue", "village", 46, 19, 2, 3, "all"),
  block("grave-cross", "Cross Grave", "village", 43, 16, 1, 2),
  block("grave-round", "Round Grave", "village", 44, 16, 1, 2),
  block("grave-small", "Small Grave", "village", 45, 16, 1, 2),
  block("grave-broken", "Broken Grave", "village", 46, 16, 1, 2),
  block("grave-old", "Old Grave", "village", 47, 16, 1, 2),
  one("sword", "Sword", "village", 36, 16),
  block("forge", "Forge", "village", 37, 29, 1, 2, "all"),
  block("furnace", "Furnace", "village", 39, 29, 1, 2, "all"),
  one("ore-pile", "Ore Pile", "village", 40, 30),
  one("ore", "Ore", "village", 41, 30),
  {
    id: "windmill",
    label: "Windmill",
    category: "village",
    w: 6,
    h: 7,
    base: { dx: 3, dy: 6 },
    art: { kind: "sprite", sheet: "windmill", frames: 9, fps: 6, anchorX: 55.5, anchorY: 111 },
    solid: "all",
  },
  {
    id: "coracle",
    label: "Coracle",
    category: "village",
    w: 3,
    h: 3,
    base: { dx: 1, dy: 2 },
    art: { kind: "sprite", sheet: "coracle", frames: 4, fps: 5, anchorX: 21.5, anchorY: 36 },
    solid: "base",
  },
];

const FENCES: Prop[] = [
  one("fence-rail", "Fence", "fences", 39, 2, "base"),
  one("fence-left", "Fence End", "fences", 38, 2, "base"),
  one("fence-right", "Fence End (right)", "fences", 42, 2, "base"),
  one("fence-cross", "Fence Junction", "fences", 40, 2, "base"),
  one("fence-post", "Fence Post", "fences", 39, 3, "base"),
  one("fence-broken", "Broken Fence", "fences", 37, 5, "base"),
  block("fence-gate", "Gate", "fences", 38, 5, 1, 2, "base"),
  block("ladder", "Ladder", "fences", 40, 5, 1, 2, "none"),
  one("wall-stone", "Stone Wall", "fences", 45, 3, "base"),
  one("wall-stone-top", "Stone Wall Top", "fences", 45, 1, "base"),
  one("wall-gate", "Walled Gate", "fences", 46, 2, "base"),
  one("wall-door", "Stone Doorway", "fences", 44, 6, "base"),
  block("post", "Mooring Post", "fences", 15, 21, 1, 4, "base"),
];

// The pack grows eleven crops. These are their last two stages: the row the
// plant is worth placing at, and the one before it.
const CROPS: Array<[string, string, number]> = [
  ["carrot", "Carrot", 51],
  ["cauliflower", "Cauliflower", 52],
  ["pumpkin", "Pumpkin", 53],
  ["sunflower", "Sunflower", 54],
  ["radish", "Radish", 55],
  ["parsnip", "Parsnip", 56],
  ["potato", "Potato", 57],
  ["cabbage", "Cabbage", 58],
  ["beetroot", "Beetroot", 59],
  ["wheat", "Wheat", 60],
  ["kale", "Kale", 61],
];

const FARM: Prop[] = [
  flat(one("soil", "Dug Soil", "farm", 50, 17)),
  ...CROPS.map(([id, label, col]) => one(id, label, "farm", col, 17)),
  ...CROPS.map(([id, label, col]) => one(`${id}-young`, `Young ${label}`, "farm", col, 15)),
];

const animal = (
  id: string,
  label: string,
  sheet: SheetId,
  w: number,
  h: number,
  fps: number,
  anchorX: number,
  anchorY: number,
): Prop => ({
  id,
  label,
  category: "animals",
  w,
  h,
  base: { dx: 0, dy: h - 1 },
  art: { kind: "sprite", sheet, frames: 4, fps, anchorX, anchorY },
  solid: "none",
});

const ANIMALS: Prop[] = [
  animal("cow", "Cow", "cow", 2, 2, 10, 16, 29),
  animal("pig", "Pig", "pig", 2, 2, 10, 16, 27),
  animal("sheep", "Sheep", "sheep", 2, 2, 8, 16, 27),
  animal("chicken", "Chicken", "chicken", 1, 2, 10, 15, 26),
  animal("duck", "Duck", "duck", 1, 1, 4, 8, 16),
  animal("bird", "Bird", "bird", 1, 1, 8, 8.5, 16),
];

const THINGS: Prop[] = [
  one("barrel", "Barrel", "props", 37, 16, "base"),
  one("barrel-water", "Water Barrel", "props", 38, 16, "base"),
  one("barrel-wood", "Log Barrel", "props", 39, 16, "base"),
  one("barrel-open", "Open Barrel", "props", 40, 16, "base"),
  one("barrel-tools", "Tool Barrel", "props", 41, 16, "base"),
  block("crate", "Crate", "props", 38, 9, 1, 2, "base"),
  block("cabinet", "Cabinet", "props", 36, 9, 1, 2, "base"),
  block("crate-stack", "Crate Stack", "props", 40, 9, 1, 2, "base"),
  block("bed-wood", "Wooden Bed", "props", 43, 9, 1, 2, "base"),
  block("chest", "Chest", "props", 45, 12, 1, 2, "base"),
  block("bed-blue", "Blue Bed", "props", 37, 17, 2, 1, "base"),
  block("bed-red", "Red Bed", "props", 39, 33, 2, 2, "base"),
  block("table", "Table", "props", 50, 36, 2, 2, "base"),
  block("table-set", "Laid Table", "props", 38, 37, 2, 2, "base"),
  block("bench", "Bench", "props", 44, 21, 2, 1, "base"),
  flat(block("rug", "Rug", "props", 40, 35, 3, 3, "none")),
  flat(block("rug-small", "Small Rug", "props", 44, 35, 2, 3, "none")),
  one("pot", "Pot", "props", 48, 32, "base"),
  one("bucket", "Bucket", "props", 49, 32, "base"),
  one("bucket-blue", "Blue Bucket", "props", 50, 32, "base"),
  one("sack", "Sack", "props", 48, 33, "base"),
  one("potted-sunflower", "Potted Sunflower", "props", 51, 32, "base"),
  one("potted-daisies", "Potted Daisies", "props", 53, 32, "base"),
  one("potion-blue", "Blue Potion", "props", 49, 19),
  one("potion-orange", "Orange Potion", "props", 50, 19),
  one("lamp", "Lamp", "props", 51, 34, "base"),
];

export const PROPS: Prop[] = [...TREES, ...FLOWERS, ...HOUSES, ...VILLAGE, ...FENCES, ...FARM, ...ANIMALS, ...THINGS];

export const BRUSHES: Ground[] = [...GROUND, ...TERRAIN];

const byId = new Map<string, Ground | Prop>();
for (const a of [...BRUSHES, ...PROPS]) byId.set(a.id, a);

export const assetById = (id: string): Ground | Prop | undefined => byId.get(id);

export const groundById = (id: string): Ground | undefined => {
  const a = byId.get(id);
  return a && !("w" in a) ? a : undefined;
};

export const propById = (id: string): Prop | undefined => {
  const a = byId.get(id);
  return a && "w" in a ? a : undefined;
};
