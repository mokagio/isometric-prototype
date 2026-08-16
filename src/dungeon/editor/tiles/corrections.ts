import { wallPieces, type FloorAt, type Piece } from "../../dungeonTiles";
import type { TileName } from "../../tiles";
import { around } from "./around";

// What somebody decided a cell should be built from, against what the autotiler
// gave them. Only touched cells are kept: every other cell is still the
// autotiler's, so digging re-flows the geometry nobody has ruled on.
//
// `around` and `auto` are held alongside `fixed` rather than worked out again on
// demand. They are what lets a correction be spotted as stale once the floor
// around it moves, and they are what keeps the record standing on its own after
// `wallPieces` is rewritten and would no longer give the same `auto`.

export interface Correction {
  /** The window this was decided against. */
  around: string;
  /** What the autotiler gave the cell at the time. */
  auto: Piece[];
  /** What it should be. */
  fixed: Piece[];
}

/** Keyed `"col,row"`, so it survives a round trip through JSON. */
export type Corrections = Record<string, Correction>;

/** The deepest stack the autotiler emits, for the tip of a rock finger. */
export const MAX_STACK = 4;

/** The lit lip is 4px, and both offsets the autotiler uses are multiples of it. */
export const NUDGE_PX = 4;

export const cellKey = (col: number, row: number): string => `${col},${row}`;

export function parseKey(key: string): { col: number; row: number } | null {
  const [col, row] = key.split(",").map(Number);
  if (col === undefined || row === undefined || !Number.isInteger(col) || !Number.isInteger(row)) {
    return null;
  }
  return { col, row };
}

const clone = (pieces: Piece[]): Piece[] => pieces.map((piece) => ({ ...piece }));

export const samePieces = (a: Piece[], b: Piece[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** The correction for a cell, or null where the autotiler still has it. */
export const correctionAt = (corrections: Corrections, col: number, row: number): Correction | null =>
  corrections[cellKey(col, row)] ?? null;

/**
 * What a cell should draw: the pieces somebody chose, or null to leave it to the
 * autotiler. This is the shape `render` wants, and the null is what tells a
 * hand-drawn cell from one that simply has nothing on it.
 */
export const drawnAt = (corrections: Corrections, col: number, row: number): Piece[] | null =>
  correctionAt(corrections, col, row)?.fixed ?? null;

/**
 * The floor as drawn, whether it was dug or laid down as tiles. A stack's
 * bottom tile is what the cell is made of — a lip or a banner over a floor
 * leaves it floor — so somebody who starts from nothing and fills it in gets
 * the same windows as somebody who dug first.
 */
export function floorWith(isFloor: FloorAt, corrections: Corrections): FloorAt {
  return (col, row) => {
    const bottom = correctionAt(corrections, col, row)?.fixed[0];
    return bottom ? bottom.tile.startsWith("floor_") : isFloor(col, row);
  };
}

/**
 * Read every correction's window and the autotiler's answer again from the floor
 * as it stands now, keeping what was drawn. Filling a room in moves the ground
 * under the cells already placed; this is how they are told about it at once
 * rather than one at a time.
 */
export function reread(isFloor: FloorAt, corrections: Corrections): Corrections {
  const next: Corrections = {};
  for (const [key, correction] of Object.entries(corrections)) {
    const at = parseKey(key);
    next[key] = at
      ? { around: around(isFloor, at.col, at.row), auto: wallPieces(isFloor, at.col, at.row), fixed: clone(correction.fixed) }
      : correction;
  }
  return next;
}

/** What a cell is built from now, whoever decided it. */
export function stackAt(
  isFloor: FloorAt,
  corrections: Corrections,
  col: number,
  row: number,
): Piece[] {
  return drawnAt(corrections, col, row) ?? wallPieces(isFloor, col, row);
}

/** A cell's correction, started from the autotiler's own answer if it has none yet. */
function open(isFloor: FloorAt, corrections: Corrections, col: number, row: number): Correction {
  const held = correctionAt(corrections, col, row);
  if (held) return { around: held.around, auto: clone(held.auto), fixed: clone(held.fixed) };
  const auto = wallPieces(isFloor, col, row);
  return { around: around(isFloor, col, row), auto, fixed: clone(auto) };
}

/** Every edit goes through here, so a snapshot taken before one is untouched by it. */
function withCell(
  isFloor: FloorAt,
  corrections: Corrections,
  col: number,
  row: number,
  edit: (correction: Correction) => void,
): Corrections {
  const correction = open(isFloor, corrections, col, row);
  edit(correction);
  return { ...corrections, [cellKey(col, row)]: correction };
}

/** Make the cell this one tile and nothing else. */
export const stamp = (
  isFloor: FloorAt,
  corrections: Corrections,
  col: number,
  row: number,
  tile: TileName,
): Corrections =>
  withCell(isFloor, corrections, col, row, (c) => {
    c.fixed = [{ tile, dx: 0, dy: 0 }];
  });

/** Lay another tile over the ones already there, up to `MAX_STACK`. */
export const add = (
  isFloor: FloorAt,
  corrections: Corrections,
  col: number,
  row: number,
  tile: TileName,
): Corrections =>
  withCell(isFloor, corrections, col, row, (c) => {
    if (c.fixed.length < MAX_STACK) c.fixed = [...c.fixed, { tile, dx: 0, dy: 0 }];
  });

/** Take one tile out of the stack, counting from the bottom. */
export const removeAt = (
  isFloor: FloorAt,
  corrections: Corrections,
  col: number,
  row: number,
  index: number,
): Corrections =>
  withCell(isFloor, corrections, col, row, (c) => {
    c.fixed = c.fixed.filter((_, i) => i !== index);
  });

/** Shift the topmost tile by whole lips, which is the only offset that means anything. */
export const nudge = (
  isFloor: FloorAt,
  corrections: Corrections,
  col: number,
  row: number,
  dx: number,
  dy: number,
): Corrections =>
  withCell(isFloor, corrections, col, row, (c) => {
    const top = c.fixed[c.fixed.length - 1];
    if (!top) return;
    c.fixed = [
      ...c.fixed.slice(0, -1),
      { ...top, dx: top.dx + dx * NUDGE_PX, dy: top.dy + dy * NUDGE_PX },
    ];
  });

/** Say whether the topmost tile is the head-on brick a banner may hang on. */
export const setFace = (
  isFloor: FloorAt,
  corrections: Corrections,
  col: number,
  row: number,
  face: boolean,
): Corrections =>
  withCell(isFloor, corrections, col, row, (c) => {
    const top = c.fixed[c.fixed.length - 1];
    if (!top) return;
    const marked: Piece = face ? { ...top, face: true } : { tile: top.tile, dx: top.dx, dy: top.dy };
    c.fixed = [...c.fixed.slice(0, -1), marked];
  });

/**
 * Looked at, and the autotiler had it right. Worth keeping: a file of nothing but
 * corrections reads as though the autotiler is wrong everywhere.
 */
export const confirm = (
  isFloor: FloorAt,
  corrections: Corrections,
  col: number,
  row: number,
): Corrections => withCell(isFloor, corrections, col, row, () => {});

/** Hand the cell back to the autotiler. */
export function revert(corrections: Corrections, col: number, row: number): Corrections {
  const next = { ...corrections };
  delete next[cellKey(col, row)];
  return next;
}

/** Whether a correction still agrees with the autotiler, rather than overriding it. */
export const agrees = (correction: Correction): boolean =>
  samePieces(correction.fixed, correction.auto);

/**
 * Whether the floor has moved under a correction since it was made. Its window is
 * the whole of what it was decided against, so a window that no longer matches
 * means the decision was about a different cell than the one there now.
 */
export function isStale(isFloor: FloorAt, correction: Correction, col: number, row: number): boolean {
  return around(isFloor, col, row) !== correction.around;
}

export interface Counts {
  corrected: number;
  confirmed: number;
  stale: number;
}

export function counts(isFloor: FloorAt, corrections: Corrections): Counts {
  const tally: Counts = { corrected: 0, confirmed: 0, stale: 0 };
  for (const [key, correction] of Object.entries(corrections)) {
    const at = parseKey(key);
    if (agrees(correction)) tally.confirmed++;
    else tally.corrected++;
    if (at && isStale(isFloor, correction, at.col, at.row)) tally.stale++;
  }
  return tally;
}
