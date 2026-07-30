import { footprint, solidCells, type Prop } from "../sunnyside/library";
import { groundById, propById } from "../sunnyside/manifest";
import { chamferTile, fenceTile, isCliffFace, isLip, ringOf } from "./coast";
import { CLEARING, COAST_RINGS, FIELD, MIDDLE, TILE } from "./field";
import type { Pos } from "./walker";

// A built island: what someone painted on the inside of Whispering Woods.
//
// The island's own shape is not stored. The sea, the water's edge, the bank and
// its lip are the same on every map — `coast.ts` draws them from the field's
// size alone — so a map is only ever the ground inside them and the things
// standing on it.

export const MAP_NAME = "whispering-woods-island";
export const VERSION = 1;
/** Painted where nobody painted anything, so a half-built island is playable. */
export const DEFAULT_GROUND = "grass";

export interface PlacedProp {
  id: string;
  col: number;
  row: number;
}

export interface Island {
  /** One brush id per cell, or null where nothing was painted. */
  ground: (string | null)[];
  /** In the order they were placed, which is the order they draw within a row. */
  props: PlacedProp[];
}

export const emptyIsland = (): Island => ({ ground: new Array<string | null>(FIELD * FIELD).fill(null), props: [] });

const index = (col: number, row: number): number => row * FIELD + col;

export const inBounds = (col: number, row: number): boolean => col >= 0 && row >= 0 && col < FIELD && row < FIELD;

/**
 * Whether a cell can be built on: the island's inside, and none of the ring the
 * coast owns. The water's edge, the bank's face, the lip cut into it and the
 * fence that rings the lot are all drawn from the field's size alone, so anything
 * painted on them would only be painted over.
 *
 * The clearing in the middle is out too. That is where the walker arrives, and a
 * house built on the spot would have them standing inside a wall — the same
 * reason the grown wood keeps its trees off it.
 */
export function buildable(col: number, row: number): boolean {
  if (!inBounds(col, row)) return false;
  if (ringOf(col, row) < COAST_RINGS) return false;
  if (chamferTile(col, row) !== null) return false;
  if (fenceTile(col, row) !== null) return false;
  if (inClearing(col, row)) return false;
  return !isCliffFace(col, row) && !isLip(col, row);
}

/** The few cells around where the walker arrives, which stay bare. */
export function inClearing(col: number, row: number): boolean {
  const mid = { col: Math.floor(MIDDLE.x / TILE), row: Math.floor(MIDDLE.y / TILE) };
  return Math.abs(col - mid.col) <= CLEARING && Math.abs(row - mid.row) <= CLEARING;
}

export function groundAt(island: Island, col: number, row: number): string | null {
  return inBounds(col, row) ? (island.ground[index(col, row)] ?? null) : null;
}

/** The brush a cell draws with once the island is played: never null. */
export const playedGroundAt = (island: Island, col: number, row: number): string =>
  groundAt(island, col, row) ?? DEFAULT_GROUND;

export function paint(island: Island, col: number, row: number, brush: string | null): void {
  if (!buildable(col, row)) return;
  island.ground[index(col, row)] = brush;
}

/** The props on a cell, latest first — what a click picks up or rubs out. */
export function propsCovering(island: Island, col: number, row: number): PlacedProp[] {
  const hits: PlacedProp[] = [];
  for (const placed of island.props) {
    const prop = propById(placed.id);
    if (!prop) continue;
    if (footprint(prop, placed.col, placed.row).some((c) => c.col === col && c.row === row)) hits.push(placed);
  }
  return hits.reverse();
}

const layerOf = (id: string): Prop["layer"] => propById(id)?.layer;

/**
 * Whether a prop may stand here: every cell of its footprint has to be on the
 * island, and free of anything on the same layer. Flat things — dug soil, a rug —
 * are a layer of their own, so a carrot goes in the soil rather than beside it.
 */
export function canPlace(island: Island, prop: Prop, col: number, row: number): boolean {
  const cells = footprint(prop, col, row);
  if (!cells.every((c) => buildable(c.col, c.row))) return false;
  return !cells.some((c) => propsCovering(island, c.col, c.row).some((p) => layerOf(p.id) === prop.layer));
}

export function place(island: Island, prop: Prop, col: number, row: number): boolean {
  if (!canPlace(island, prop, col, row)) return false;
  island.props.push({ id: prop.id, col, row });
  return true;
}

/**
 * Take away whatever is on a cell, topmost first: a carrot before the soil it is
 * planted in, so rubbing out twice clears both.
 */
export function erase(island: Island, col: number, row: number): boolean {
  const covering = propsCovering(island, col, row);
  const top = covering.find((p) => layerOf(p.id) !== "flat") ?? covering[0];
  if (!top) return false;
  island.props.splice(island.props.indexOf(top), 1);
  return true;
}

/** Whether anything has been built — 0 means there is nothing to lose. */
export const isEmpty = (island: Island): boolean =>
  island.props.length === 0 && island.ground.every((g) => g === null);

// Walking -------------------------------------------------------------------

/** The things on the island, flat ones first, then in the order they stand. */
export function drawOrder(island: Island): PlacedProp[] {
  const flat = island.props.filter((p) => layerOf(p.id) === "flat");
  const standing = island.props.filter((p) => layerOf(p.id) !== "flat");
  standing.sort((a, b) => a.row - b.row || island.props.indexOf(a) - island.props.indexOf(b));
  return [...flat, ...standing];
}

/** The cells a played island will not let the walker into. */
export function solidGrid(island: Island): Set<number> {
  const solid = new Set<number>();
  for (let row = 0; row < FIELD; row++) {
    for (let col = 0; col < FIELD; col++) {
      const brush = groundById(playedGroundAt(island, col, row));
      if (brush?.solid) solid.add(index(col, row));
    }
  }
  for (const placed of island.props) {
    const prop = propById(placed.id);
    if (!prop) continue;
    for (const cell of solidCells(prop, placed.col, placed.row)) {
      if (inBounds(cell.col, cell.row)) solid.add(index(cell.col, cell.row));
    }
  }
  return solid;
}

/**
 * What blocks the walker on a built island, in the shape `walk` wants.
 *
 * A solid cell stops the feet, not the whole figure: standing a step below a
 * house and having its wall push you back a tile reads as a bug, so the test is
 * the cell the feet are in and nothing wider.
 */
export function blockedOn(island: Island): (feet: Pos) => boolean {
  const solid = solidGrid(island);
  return (feet: Pos): boolean => {
    const col = Math.floor(feet.x / TILE);
    const row = Math.floor(feet.y / TILE);
    return inBounds(col, row) && solid.has(index(col, row));
  };
}

// Files ---------------------------------------------------------------------

interface IslandFile {
  name: string;
  version: number;
  writtenBy: string;
  size: number;
  ground: (string | null)[];
  props: PlacedProp[];
}

/**
 * The island as a file. Every file records the commit that wrote it, so
 * `git show <commit>:src/woods/island.ts` is the code that understood it.
 */
export function encodeIsland(island: Island): string {
  const file: IslandFile = {
    name: MAP_NAME,
    version: VERSION,
    writtenBy: __BUILD_COMMIT__,
    size: FIELD,
    ground: island.ground,
    props: island.props,
  };
  return JSON.stringify(file);
}

const fail = (why: string): never => {
  throw new Error(why);
};

/**
 * Read a file back. Refuses anything it cannot be sure of by name, version and
 * size — half-reading someone's island is worse than declining it — but drops
 * brushes and props it does not recognise, so a map outlives a renamed asset.
 */
export function decodeIsland(text: string): Island {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("That file is not an island — it is not even JSON.");
  }
  if (typeof raw !== "object" || raw === null) return fail("That file is not an island.");
  const file = raw as Partial<IslandFile>;
  if (file.name !== MAP_NAME) return fail("That file was not made by the island editor.");
  if (file.version !== VERSION) return fail(`That island was made by version ${String(file.version)}, and this is ${VERSION}.`);
  if (file.size !== FIELD) return fail(`That island is ${String(file.size)} tiles across, and this one is ${FIELD}.`);
  if (!Array.isArray(file.ground) || file.ground.length !== FIELD * FIELD) return fail("That island's ground is damaged.");
  if (!Array.isArray(file.props)) return fail("That island's things are damaged.");

  const island = emptyIsland();
  file.ground.forEach((brush, i) => {
    if (typeof brush !== "string" || !groundById(brush)) return;
    const col = i % FIELD;
    const row = Math.floor(i / FIELD);
    if (buildable(col, row)) island.ground[i] = brush;
  });
  for (const placed of file.props) {
    if (typeof placed?.id !== "string" || !Number.isInteger(placed.col) || !Number.isInteger(placed.row)) continue;
    const prop = propById(placed.id);
    if (prop) place(island, prop, placed.col, placed.row);
  }
  return island;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** Local date, not UTC — an island saved in the evening is not filed under tomorrow. */
export const islandFilename = (now: Date): string =>
  `island-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
