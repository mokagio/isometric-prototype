import { footprint, solidCells } from "../sunnyside/library";
import { groundById, propById } from "../sunnyside/manifest";
import type { Pos } from "../woods/walker";

/**
 * The seaside town, laid out in 16px cells: grass and the kid's cottage to the
 * west, a beach down the middle, the sea to the east with a dock out into it.
 * The ground is a library brush per cell and everything standing on it a
 * library prop, so it draws through the same painter as the island editor.
 */
export const TILE = 16;
export const COLS = 48;
export const ROWS = 32;

/** Where the beach starts and where the sea does, by column. */
export const BEACH_COL = 30;
export const SEA_COL = 36;
/** The dock: two cells wide, out over the water from the beach. */
export const DOCK = { col0: SEA_COL - 2, col1: SEA_COL + 8, row0: 15, row1: 16 };
/** The garden patch beside the cottage, where things grow. */
export const GARDEN = { col0: 15, col1: 20, row0: 13, row1: 15 };
/** The chickens' pen; its gate is a gap in the bottom fence. */
export const PEN = { col0: 3, col1: 10, row0: 20, row1: 26, gateCol: 7 };
/** The market stall, and the cell in front of it you trade from. */
export const STALL = { col: 24, row: 21 };
export const COUNTER = { col: 25, row: 22 };
export const START: Pos = { x: 12 * TILE + TILE / 2, y: 12 * TILE + TILE / 2 };

export interface PlacedProp {
  id: string;
  col: number;
  row: number;
}

export const inGarden = (col: number, row: number): boolean =>
  col >= GARDEN.col0 && col <= GARDEN.col1 && row >= GARDEN.row0 && row <= GARDEN.row1;

export const onDock = (col: number, row: number): boolean =>
  col >= DOCK.col0 && col <= DOCK.col1 && row >= DOCK.row0 && row <= DOCK.row1;

/** The library brush painted on a cell. */
export function groundAt(col: number, row: number): string {
  if (onDock(col, row)) return "path-pale";
  if (col >= SEA_COL + 4) return "sea";
  if (col >= SEA_COL) return "river";
  if (col >= BEACH_COL) return "sand";
  if (inGarden(col, row)) return "dirt";
  // A dirt path from the cottage door down to the market and out to the beach.
  if (row === 18 && col >= 8 && col < BEACH_COL) return "path";
  if (col === 12 && row >= 12 && row <= 18) return "path";
  return (col * 7 + row * 13) % 11 === 0 ? "grass-clover" : "grass";
}

/** Everything standing in town. */
export function townProps(): PlacedProp[] {
  const out: PlacedProp[] = [
    { id: "cottage-blue", col: 10, row: 11 },
    { id: "well", col: 15, row: 10 },
    { id: "bench", col: 21, row: 16 },
    { id: "stall-red", col: STALL.col, row: STALL.row },
    { id: "barrel", col: 22, row: 21 },
    { id: "crate", col: 28, row: 21 },
    { id: "coracle", col: 32, row: 22 },
    { id: "barrel-water", col: 33, row: 13 },
    { id: "crate-stack", col: 33, row: 18 },
    { id: "post", col: DOCK.col1, row: DOCK.row0 - 1 },
    { id: "potted-sunflower", col: 7, row: 11 },
    { id: "potted-daisies", col: 14, row: 12 },
  ];
  // Seaside finds on the beach.
  for (const [id, col, row] of [
    ["shell", 31, 6],
    ["starfish", 34, 9],
    ["shell", 33, 26],
    ["coral", 35, 29],
    ["sea-stone", 30, 28],
    ["starfish", 31, 12],
  ] as const) out.push({ id, col, row });
  // Flowers by the cottage and along the path.
  for (const [id, col, row] of [
    ["flowers-red", 6, 14],
    ["flowers-white", 8, 15],
    ["flowers-blue", 19, 17],
    ["flower-patch", 22, 13],
    ["flowers-red", 27, 16],
    ["flowers-white", 18, 24],
    ["flowers-blue", 14, 27],
  ] as const) out.push({ id, col, row });
  // Trees round the town's edge, leaving the beach open.
  for (let col = 1; col < BEACH_COL - 1; col += 3) {
    out.push({ id: col % 2 ? "tree-round" : "pine", col, row: 3 });
    out.push({ id: col % 2 ? "pine" : "tree-round", col, row: ROWS - 2 });
  }
  for (let row = 6; row < ROWS - 3; row += 4) if (row < PEN.row0 - 1 || row > PEN.row1 + 1) out.push({ id: "tree-round", col: 1, row });
  // The pen's fence, with its gate left open.
  for (let col = PEN.col0; col <= PEN.col1; col++) {
    out.push({ id: "fence-rail", col, row: PEN.row0 });
    if (col !== PEN.gateCol) out.push({ id: "fence-rail", col, row: PEN.row1 });
  }
  for (let row = PEN.row0 + 1; row < PEN.row1; row++) {
    out.push({ id: "fence-post", col: PEN.col0, row });
    out.push({ id: "fence-post", col: PEN.col1, row });
  }
  return out;
}

/** The cells the kid cannot walk into: the sea (but not the dock), walls, fences and trunks. */
export function solidGrid(props: readonly PlacedProp[] = townProps()): Set<number> {
  const solid = new Set<number>();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (groundById(groundAt(col, row))?.solid) solid.add(row * COLS + col);
    }
  }
  for (const p of props) {
    const prop = propById(p.id);
    if (!prop) continue;
    for (const c of solidCells(prop, p.col, p.row)) solid.add(c.row * COLS + c.col);
  }
  return solid;
}

export function blocker(solid: Set<number>): (feet: Pos) => boolean {
  return (feet) => {
    const col = Math.floor(feet.x / TILE);
    const row = Math.floor(feet.y / TILE);
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
    return solid.has(row * COLS + col);
  };
}

export const cellOf = (p: Pos): { col: number; row: number } => ({ col: Math.floor(p.x / TILE), row: Math.floor(p.y / TILE) });

/** Whether there is water a short cast away from where the kid stands, facing that way. */
export function canFish(feet: Pos, facing: "left" | "right"): boolean {
  const dir = facing === "right" ? 1 : -1;
  for (const reach of [1, 2]) {
    const col = Math.floor(feet.x / TILE) + dir * reach;
    const row = Math.floor(feet.y / TILE);
    if (col >= SEA_COL && !onDock(col, row)) return true;
  }
  return false;
}

export function atCounter(feet: Pos): boolean {
  const c = cellOf(feet);
  return Math.abs(c.col - COUNTER.col) <= 1 && Math.abs(c.row - COUNTER.row) <= 1;
}

/** Every prop's footprint, for checking nothing overlaps the garden, the pen or another prop. */
export function footprints(props: readonly PlacedProp[]): Array<{ col: number; row: number; id: string }> {
  return props.flatMap((p) => {
    const prop = propById(p.id);
    return prop ? footprint(prop, p.col, p.row).map((c) => ({ ...c, id: p.id })) : [];
  });
}
