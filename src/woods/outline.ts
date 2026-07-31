import {
  chamferTile,
  fenceTile,
  isCliffFace,
  isLip,
  lipCornerTile,
  ringOf,
  shoreTile,
  type Tile,
} from "./coast";
import { COAST_TILES, GRASS_CODE, isCoastCode, SEA_CODE, type CoastSheetId } from "./coastTiles";
import { FENCE_RING, FIELD } from "./field";
import { isLand } from "./shape";

// An island's outline, drawn by hand: one of the pack's coast tiles per cell,
// placed rather than worked out. `coast.ts` still grows a coastline when nobody
// has drawn one, and `grownOutline` is that coastline written down — so the
// editor opens on the island as it stands and the drawing starts from there.
//
// A cell is one character, a row to a line. It reads as a little map in the
// file, survives a diff, and can be pasted straight into the source the day a
// drawn island becomes the built-in one.

export const MAP_NAME = "whispering-woods-outline";
// 1 was land-or-sea booleans, autotiled on the way in. Nothing reads those now.
export const VERSION = 2;

/** One tile code per cell, row-major. */
export type Outline = string[];

export const index = (col: number, row: number): number => row * FIELD + col;

export const inBounds = (col: number, row: number): boolean =>
  col >= 0 && row >= 0 && col < FIELD && row < FIELD;

/**
 * Whether a cell is the outline's to draw.
 *
 * Everything from the fence inwards belongs to the game: it is where the walker
 * is held and where the island editor paints, and neither asks the outline's
 * permission. So the drawing is the band outside the fence — which is the whole
 * of what anybody looking at the island calls its outline.
 */
export const editable = (col: number, row: number): boolean =>
  inBounds(col, row) && ringOf(col, row) < FENCE_RING;

// The way back: a sheet position to the character that stands for it, so the
// autotiler's choices can be written down as placed tiles.
const CODE_AT = new Map(
  COAST_TILES.filter((t) => t.sheet && !t.flipV).map((t) => [`${t.sheet!}:${t.col!}:${t.row!}`, t.code]),
);

const codeOf = (sheet: CoastSheetId, tile: Tile): string =>
  CODE_AT.get(`${sheet}:${tile.col}:${tile.row}`) ?? SEA_CODE;

/**
 * The coastline `coast.ts` grows, written down as tiles: what the editor opens
 * on. A cell carries one tile, so where the autotiler stacks a face over ground
 * the face is what gets written — it is the tile you would place there.
 */
export function grownOutline(): Outline {
  const cells: Outline = new Array<string>(FIELD * FIELD).fill(SEA_CODE);
  for (let row = 0; row < FIELD; row++) {
    for (let col = 0; col < FIELD; col++) {
      cells[index(col, row)] = grownCode(col, row);
    }
  }
  return cells;
}

function grownCode(col: number, row: number): string {
  const shore = shoreTile(col, row);
  if (shore) return codeOf("shore", shore);
  const chamfer = chamferTile(col, row);
  if (chamfer) return codeOf("shore", chamfer);
  if (isCliffFace(col, row)) return codeOf("cliff", { col: col % 3, row: 1 });
  if (isLip(col, row)) {
    const corner = lipCornerTile(col, row);
    return corner ? codeOf("lipCorner", corner) : "_";
  }
  if (fenceTile(col, row)) return GRASS_CODE; // the fence is drawn standing, not as ground
  return isLand(col, row) ? GRASS_CODE : SEA_CODE;
}

export const codeAt = (outline: Outline, col: number, row: number): string =>
  inBounds(col, row) ? (outline[index(col, row)] ?? SEA_CODE) : SEA_CODE;

/** Lay a tile in a cell. Refuses anything the outline does not own. */
export function draw(outline: Outline, col: number, row: number, code: string): void {
  if (!editable(col, row) || !isCoastCode(code)) return;
  outline[index(col, row)] = code;
}

/** The outline as rows of characters, which is how it is written down. */
export function toRows(outline: Outline): string[] {
  const rows: string[] = [];
  for (let row = 0; row < FIELD; row++) {
    let line = "";
    for (let col = 0; col < FIELD; col++) line += outline[index(col, row)] ?? SEA_CODE;
    rows.push(line);
  }
  return rows;
}

/**
 * Rows back to cells. A character nobody recognises reads as open water, and
 * whatever the file says about the fenced square is dropped: that is the game's
 * ground, and a file is not the place to find out it has been flooded.
 */
export function fromRows(rows: readonly string[]): Outline {
  const cells: Outline = new Array<string>(FIELD * FIELD).fill(SEA_CODE);
  for (let row = 0; row < FIELD; row++) {
    const line = rows[row] ?? "";
    for (let col = 0; col < FIELD; col++) {
      if (!editable(col, row)) {
        cells[index(col, row)] = GRASS_CODE;
        continue;
      }
      const code = line[col] ?? SEA_CODE;
      cells[index(col, row)] = isCoastCode(code) ? code : SEA_CODE;
    }
  }
  return cells;
}

interface OutlineFile {
  name: string;
  version: number;
  writtenBy: string;
  size: number;
  rows: string[];
}

/**
 * The outline as a file. Every file records the commit that wrote it, so
 * `git show <commit>:src/woods/outline.ts` is the code that understood it.
 */
export function encodeOutline(outline: Outline): string {
  const file: OutlineFile = {
    name: MAP_NAME,
    version: VERSION,
    writtenBy: __BUILD_COMMIT__,
    size: FIELD,
    rows: toRows(outline),
  };
  // Pretty-printed on purpose: the rows are meant to be read, and a wall of one
  // line would defeat the point of writing them as characters.
  return JSON.stringify(file, null, 1);
}

const fail = (why: string): never => {
  throw new Error(why);
};

/**
 * Read a file back. Refuses anything it cannot be sure of by name, version and
 * size — half-reading someone's island is worse than declining it.
 */
export function decodeOutline(text: string): Outline {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("That file is not an outline — it is not even JSON.");
  }
  if (typeof raw !== "object" || raw === null) return fail("That file is not an outline.");
  const file = raw as Partial<OutlineFile>;
  if (file.name !== MAP_NAME) return fail("That file was not made by the outline editor.");
  if (file.version !== VERSION) {
    return fail(`That outline was made by version ${String(file.version)}, and this is ${VERSION}.`);
  }
  if (file.size !== FIELD) return fail(`That outline is ${String(file.size)} tiles across, and this one is ${FIELD}.`);
  if (!Array.isArray(file.rows) || file.rows.length !== FIELD) return fail("That outline's rows are damaged.");
  if (file.rows.some((line) => typeof line !== "string" || line.length !== FIELD)) {
    return fail("That outline's rows are damaged.");
  }
  return fromRows(file.rows);
}

// The outline in play, if one has been drawn. `ground.ts` asks for it every
// frame: with one set it draws the cells as they were placed instead of working
// the coastline out, which is the whole point of having drawn it.
let current: Outline | null = null;

export function setDrawnOutline(outline: Outline | null): void {
  current = outline && outline.length === FIELD * FIELD ? outline : null;
}

export const drawnOutline = (): Outline | null => current;

const pad = (n: number): string => String(n).padStart(2, "0");

/** Local date, not UTC — an outline saved in the evening is not filed under tomorrow. */
export const outlineFilename = (now: Date): string =>
  `outline-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
