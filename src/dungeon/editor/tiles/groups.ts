import { TILES, type TileName } from "../../tiles";

// Which of the sheet's tiles the palette offers, and under which tab.
//
// The sheet is mostly characters — a hero or a monster per prefix, eight frames
// each — and those are entities the game places, not cells a map is built from.
// What is left is small enough to name by prefix.

export type GroupId = "walls" | "floors" | "doors" | "decor" | "props";

export interface Group {
  id: GroupId;
  label: string;
}

export const GROUPS: readonly Group[] = [
  { id: "walls", label: "Walls" },
  { id: "floors", label: "Floors" },
  { id: "doors", label: "Doors" },
  { id: "decor", label: "Décor" },
  { id: "props", label: "Props" },
];

// Décor is tested before walls, because the banners and fountains hanging on a
// wall share its prefix without being part of its geometry.
const RULES: { id: GroupId; match: (name: string) => boolean }[] = [
  {
    id: "decor",
    match: (n) =>
      n.startsWith("wall_banner_") ||
      n.startsWith("wall_fountain_") ||
      n.startsWith("wall_goo") ||
      n.startsWith("wall_hole_"),
  },
  { id: "walls", match: (n) => n.startsWith("wall_") || n.startsWith("column") || n === "edge_down" || n === "hole" },
  { id: "floors", match: (n) => n.startsWith("floor_") },
  { id: "doors", match: (n) => n.startsWith("doors_") },
  {
    id: "props",
    match: (n) =>
      n.startsWith("chest_") ||
      n.startsWith("flask_") ||
      n.startsWith("coin_") ||
      n.startsWith("bomb_") ||
      n.startsWith("button_") ||
      n.startsWith("lever_") ||
      n === "crate" ||
      n === "skull",
  },
];

/** Which tab a tile belongs under, or null for the entities the palette leaves alone. */
export function groupOf(name: string): GroupId | null {
  return RULES.find((rule) => rule.match(name))?.id ?? null;
}

/**
 * Whether this is a tile in its own right rather than a later frame of one. An
 * animated fountain is one swatch, not three.
 */
export const stillFrame = (name: string): boolean => !/_(?:anim_)?f[1-9]\d*$/.test(name);

const names = (): TileName[] => Object.keys(TILES) as TileName[];

/** Where a tile sits on the sheet, so a group reads in the order it was drawn. */
function bySheetPosition(a: TileName, b: TileName): number {
  const [ax, ay] = TILES[a];
  const [bx, by] = TILES[b];
  return ay - by || ax - bx;
}

/** What the palette offers under one tab. */
export function tilesIn(id: GroupId): TileName[] {
  return names()
    .filter((name) => stillFrame(name) && groupOf(name) === id)
    .sort(bySheetPosition);
}

/** The entities the palette leaves alone — characters, weapons, the heart pips. */
export function excluded(): TileName[] {
  return names().filter((name) => groupOf(name) === null);
}

/** The side of the square a swatch is drawn into, in CSS pixels. */
export const SWATCH_PX = 44;

export interface SwatchFit {
  zoom: number;
  x: number;
  y: number;
}

/**
 * A tile centred in a swatch. Whole zooms while it fits, because a wall lip at a
 * fractional one is mush; a shrink only for the few tiles taller than the box.
 */
export function swatchFit(w: number, h: number, box: number = SWATCH_PX): SwatchFit {
  const longest = Math.max(w, h);
  const zoom = longest <= box ? Math.max(1, Math.floor(box / longest)) : box / longest;
  return { zoom, x: (box - w * zoom) / 2, y: (box - h * zoom) / 2 };
}
