import type { SheetId } from "./sheets";

// What a Sunnyside asset is, for anything that wants to paint one: the shapes
// here, the data in `manifest.ts`. Nothing in this file knows about a canvas.

/** A cell of a sheet. `flip` is the pack's own vertical flip, used by some roofs. */
export interface TileRef {
  col: number;
  row: number;
  flip?: "v";
}

/** A tile of a multi-tile stamp, offset from the stamp's top-left cell. */
export interface StampTile extends TileRef {
  dx: number;
  dy: number;
}

/**
 * How a thing is drawn: as 16px tiles laid on the grid, or as one sprite whose
 * anchor sits on the cell it stands on.
 *
 * The pack's own sprite origins are not to be trusted — several deco sprites
 * record a frame centre and `tree_01` records (0, 0) — so every anchor here is
 * measured off the union of the strip's frames instead.
 */
export type Art =
  | { kind: "tiles"; sheet: SheetId; tiles: StampTile[] }
  /** A tile that animates along its row, as the pack's own tile animations do. */
  | { kind: "tileStrip"; sheet: SheetId; col: number; row: number; frames: number; fps: number }
  | { kind: "sprite"; sheet: SheetId; frames: number; fps: number; anchorX: number; anchorY: number };

/** What the pack plays its tileset animations at, from the tileset's own metadata. */
export const TILE_FPS = 5;

export type CategoryId =
  | "ground"
  | "paths"
  | "trees"
  | "flowers"
  | "houses"
  | "village"
  | "fences"
  | "farm"
  | "animals"
  | "props";

export interface Category {
  id: CategoryId;
  label: string;
}

/** A brush that paints one cell of ground. */
export interface Ground {
  id: string;
  label: string;
  category: CategoryId;
  kind: "tile";
  sheet: SheetId;
  /** One is picked per cell, so the ground does not read as a pattern. */
  variants: TileRef[];
  /** Whether the walker is kept off it — true for water. */
  solid?: boolean;
}

/** A thing that stands on the ground and occupies a footprint of cells. */
export interface Prop {
  id: string;
  label: string;
  category: CategoryId;
  /** Footprint in 16px cells. */
  w: number;
  h: number;
  /** The footprint cell the thing stands on, and which the cursor holds it by. */
  base: { dx: number; dy: number };
  art: Art;
  /** Which footprint cells the walker cannot enter. */
  solid: "base" | "all" | "none";
  /**
   * Things that lie flat — dug soil, a rug — take a cell without filling it, so
   * something else can stand on top. Everything else stands up and takes the
   * cell to itself.
   */
  layer?: "flat";
}

export type Asset = Ground | Prop;

export const isProp = (a: Asset): a is Prop => "w" in a;

/** The cells a prop covers when its base cell is `(col, row)`. */
export function footprint(prop: Prop, col: number, row: number): Array<{ col: number; row: number }> {
  const cells: Array<{ col: number; row: number }> = [];
  for (let dy = 0; dy < prop.h; dy++) {
    for (let dx = 0; dx < prop.w; dx++) {
      cells.push({ col: col - prop.base.dx + dx, row: row - prop.base.dy + dy });
    }
  }
  return cells;
}

/** The cells a prop blocks when its base cell is `(col, row)`. */
export function solidCells(prop: Prop, col: number, row: number): Array<{ col: number; row: number }> {
  if (prop.solid === "none") return [];
  const all = footprint(prop, col, row);
  if (prop.solid === "all") return all;
  const baseRow = row - prop.base.dy + (prop.h - 1);
  return all.filter((c) => c.row === baseRow);
}

// Value noise, the same one `field.ts` paints grass with: a cell always takes the
// same variant, with no array to store.
export function tileHash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const VARIANT_SEED = 6421;
// Keeps the first tile in the majority, so the sprinkled ones read as detail
// rather than as a pattern.
const PLAIN_SHARE = 0.72;

/**
 * Which variant of a plain-tile brush a cell takes. The editor and the game both
 * go through here, so a painted cell draws the same tile in both.
 */
export function variantAt(count: number, col: number, row: number): number {
  if (count <= 1) return 0;
  const v = tileHash(col, row, VARIANT_SEED);
  if (v < PLAIN_SHARE) return 0;
  const rest = (v - PLAIN_SHARE) / (1 - PLAIN_SHARE);
  return 1 + Math.min(count - 2, Math.floor(rest * (count - 1)));
}
