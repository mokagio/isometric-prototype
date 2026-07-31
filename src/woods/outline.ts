import { FENCE_RING, FIELD } from "./field";
import { grownLand } from "./shape";

// An island's outline, drawn by hand. `shape.ts` grows one when nobody has drawn
// anything; this is the file that overrides it.
//
// The cells are kept as one character each — `.` for land, `~` for sea — a row to
// a line. It reads as a little map in the file, survives a diff, and can be
// pasted straight into the source the day a drawn island becomes the built-in
// one. A thousand-odd JSON booleans would do none of that.

export const MAP_NAME = "whispering-woods-outline";
export const VERSION = 1;

export const LAND = ".";
export const SEA = "~";

/** One flag per cell, row-major. */
export type Outline = boolean[];

export const index = (col: number, row: number): number => row * FIELD + col;

export const inBounds = (col: number, row: number): boolean =>
  col >= 0 && row >= 0 && col < FIELD && row < FIELD;

/** The outline the island grows for itself: what the editor opens on. */
export function grownOutline(): Outline {
  const cells: Outline = new Array<boolean>(FIELD * FIELD).fill(false);
  for (let row = 0; row < FIELD; row++) {
    for (let col = 0; col < FIELD; col++) cells[index(col, row)] = grownLand(col, row);
  }
  return cells;
}

/**
 * Whether a cell may be drawn as sea.
 *
 * Everything from the fence inwards has to stay land: it is where the walker is
 * held and where the island editor paints, and neither asks the outline's
 * permission. Drawing the sea in there would put the ground under someone's feet
 * out at sea. The mirror of `island.ts`'s `buildable`.
 */
export function floodable(col: number, row: number): boolean {
  if (!inBounds(col, row)) return false;
  const ring = Math.min(col, row, FIELD - 1 - col, FIELD - 1 - row);
  return ring < FENCE_RING;
}

/** Draw one cell, land or sea. Refuses to flood the fenced square. */
export function draw(outline: Outline, col: number, row: number, land: boolean): void {
  if (!inBounds(col, row)) return;
  if (!land && !floodable(col, row)) return;
  outline[index(col, row)] = land;
}

export const landAt = (outline: Outline, col: number, row: number): boolean =>
  inBounds(col, row) && outline[index(col, row)] === true;

/** The outline as rows of `.` and `~`, which is how it is written down. */
export function toRows(outline: Outline): string[] {
  const rows: string[] = [];
  for (let row = 0; row < FIELD; row++) {
    let line = "";
    for (let col = 0; col < FIELD; col++) line += outline[index(col, row)] ? LAND : SEA;
    rows.push(line);
  }
  return rows;
}

/** Rows back to cells. Anything that is not land reads as sea. */
export function fromRows(rows: readonly string[]): Outline {
  const cells: Outline = new Array<boolean>(FIELD * FIELD).fill(false);
  rows.forEach((line, row) => {
    for (let col = 0; col < FIELD; col++) cells[index(col, row)] = line[col] === LAND;
  });
  // Whatever the file says, the fenced square is land: an outline that floods it
  // would strand the walker, and a file is not the place to find that out.
  for (let row = 0; row < FIELD; row++) {
    for (let col = 0; col < FIELD; col++) {
      if (!floodable(col, row)) cells[index(col, row)] = true;
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

const pad = (n: number): string => String(n).padStart(2, "0");

/** Local date, not UTC — an outline saved in the evening is not filed under tomorrow. */
export const outlineFilename = (now: Date): string =>
  `outline-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
