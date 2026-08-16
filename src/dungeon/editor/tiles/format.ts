import type { FloorAt, Piece } from "../../dungeonTiles";
import { TILES, type TileName } from "../../tiles";
import { agrees, cellKey, isStale, parseKey, type Corrections } from "./corrections";
import { floorRows } from "./around";
import { rulesFrom } from "./rules";

// The file the corrections leave in, meant to be read by whoever rewrites
// `wallPieces` as much as by the editor that wrote it. Pretty-printed, and in a
// fixed order, so two exports of the same work are the same bytes and a changed
// piece is a changed line.

export const FORMAT = "amelias-dungeon-wall-tiles";
export const VERSION = 1;

/** What stops a typo'd header asking for a million cells. */
export const MAX_SIDE = 256;

const PIECE = /^([a-z0-9_]+)@(-?\d+),(-?\d+)( face)?$/;

export const encodePiece = (piece: Piece): string =>
  `${piece.tile}@${piece.dx},${piece.dy}${piece.face ? " face" : ""}`;

export function decodePiece(text: string): Piece {
  const found = PIECE.exec(text);
  if (!found) throw new Error(`"${text}" is not a tile and an offset.`);
  const [, tile, dx, dy, face] = found;
  if (!(tile! in TILES)) throw new Error(`The sheet has no tile called "${tile}".`);
  const piece: Piece = { tile: tile as TileName, dx: Number(dx), dy: Number(dy) };
  return face ? { ...piece, face: true } : piece;
}

export interface FileCell {
  col: number;
  row: number;
  around: string;
  auto: string[];
  fixed: string[];
  /** Whether the correction is what the autotiler already does. */
  agrees: boolean;
  /** Present only when the floor has moved since the cell was ruled on. */
  stale?: true;
}

/** A rule with its pieces written the same compact way a cell's are. */
export interface FileRule {
  around: string;
  cells: number;
  conflict: boolean;
  drawnAs: { cells: number; fixed: string[]; agrees: boolean }[];
}

export interface TilesFile {
  format: string;
  version: number;
  savedAt: string;
  cols: number;
  rows: number;
  legend: Record<string, string>;
  floor: string[];
  counts: { corrected: number; confirmed: number; stale: number; conflicts: number };
  cells: FileCell[];
  rules: FileRule[];
}

const LEGEND: Record<string, string> = {
  ".": "floor",
  "#": "rock",
  around:
    "Three rows of three, top to bottom. The middle character is the cell itself, and off the map reads as rock. " +
    "It is the whole of what the autotiler is given, so the same window must always draw the same way.",
  piece:
    "<tile>@<dx>,<dy> — the sheet tile, then its offset in sheet pixels from the cell's top-left corner. " +
    '" face" marks the head-on brick a banner may hang on.',
  auto: "What the autotiler drew when the cell was ruled on.",
  fixed: "What it should draw.",
};

export interface Size {
  cols: number;
  rows: number;
}

export function buildFile(
  isFloor: FloorAt,
  size: Size,
  corrections: Corrections,
  savedAt: string,
): TilesFile {
  const cells: FileCell[] = [];
  for (const [key, correction] of Object.entries(corrections)) {
    const at = parseKey(key);
    if (!at) continue;
    const stale = isStale(isFloor, correction, at.col, at.row);
    cells.push({
      col: at.col,
      row: at.row,
      around: correction.around,
      auto: correction.auto.map(encodePiece),
      fixed: correction.fixed.map(encodePiece),
      agrees: agrees(correction),
      ...(stale ? { stale: true as const } : {}),
    });
  }
  cells.sort((a, b) => a.row - b.row || a.col - b.col);

  const rules: FileRule[] = rulesFrom(corrections).map((rule) => ({
    around: rule.around,
    cells: rule.cells,
    conflict: rule.conflict,
    drawnAs: rule.drawnAs.map((variant) => ({
      cells: variant.cells,
      fixed: variant.fixed.map(encodePiece),
      agrees: variant.agrees,
    })),
  }));
  return {
    format: FORMAT,
    version: VERSION,
    savedAt,
    cols: size.cols,
    rows: size.rows,
    legend: LEGEND,
    floor: floorRows(isFloor, size.cols, size.rows),
    counts: {
      corrected: cells.filter((c) => !c.agrees).length,
      confirmed: cells.filter((c) => c.agrees).length,
      stale: cells.filter((c) => c.stale).length,
      conflicts: rules.filter((r) => r.conflict).length,
    },
    cells,
    rules,
  };
}

/** Indented on purpose: the rows and the pieces are meant to be read. */
export const encodeTiles = (file: TilesFile): string => JSON.stringify(file, null, 1);

export interface Opened {
  cols: number;
  rows: number;
  corrections: Corrections;
}

const isSide = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0 && (n as number) <= MAX_SIDE;

export function decodeTiles(text: string): Opened {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not JSON at all.");
  }
  const file = raw as Partial<TilesFile>;
  if (file?.format !== FORMAT) throw new Error("That file was not made by the tile editor.");
  if (file.version !== VERSION) {
    throw new Error(`That file is version ${String(file.version)}, and this editor reads version ${VERSION}.`);
  }
  if (!isSide(file.cols) || !isSide(file.rows)) {
    throw new Error(`A map has to be between 1 and ${MAX_SIDE} cells on a side.`);
  }
  if (!Array.isArray(file.cells)) throw new Error("That file has no cells in it.");

  const corrections: Corrections = {};
  for (const cell of file.cells as FileCell[]) {
    if (!Number.isInteger(cell?.col) || !Number.isInteger(cell?.row)) {
      throw new Error("A cell in that file is not at a whole position.");
    }
    if (typeof cell.around !== "string" || !Array.isArray(cell.auto) || !Array.isArray(cell.fixed)) {
      throw new Error(`The cell at ${cell.col},${cell.row} is missing what it was decided against.`);
    }
    corrections[cellKey(cell.col, cell.row)] = {
      around: cell.around,
      auto: cell.auto.map(decodePiece),
      fixed: cell.fixed.map(decodePiece),
    };
  }
  return { cols: file.cols, rows: file.rows, corrections };
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** Local date, not UTC: a file saved late in the evening belongs to that evening. */
export const tilesFilename = (now: Date): string =>
  `amelias-dungeon-tiles-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
