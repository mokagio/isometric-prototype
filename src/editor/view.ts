import { SX, SY, type Origin } from "../iso";
import type { PanDir, PanRoom } from "../panPad";

// A board wider than the canvas needs a view: the cell held at the centre of the
// screen. Panning moves that cell; the origin is derived from it.
export const PAN_STEP = 4; // cells per press — a few, so crossing the board is a handful

/** The cell parked at the centre of the canvas. Whole cells only, or tiles land on half-pixels. */
export interface View {
  col: number;
  row: number;
}

// Screen directions, not grid ones: on an iso grid, straight up the screen is a
// step along both axes at once.
const STEPS: Record<PanDir, View> = {
  up: { col: -1, row: -1 },
  down: { col: 1, row: 1 },
  left: { col: -1, row: 1 },
  right: { col: 1, row: -1 },
};

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** Holds the view over the board, so panning can never leave you looking at nothing. */
export const clampView = (view: View, size: number): View => ({
  col: clamp(Math.round(view.col), 0, size - 1),
  row: clamp(Math.round(view.row), 0, size - 1),
});

export const centreView = (size: number): View => clampView({ col: (size - 1) / 2, row: (size - 1) / 2 }, size);

export const panView = (view: View, dir: PanDir, size: number, step = PAN_STEP): View =>
  clampView({ col: view.col + STEPS[dir].col * step, row: view.row + STEPS[dir].row * step }, size);

/**
 * Which ways there is any board left to go — what greys an arrow out. A pan that
 * lands you back where you were had nowhere to go, which `clampView` already
 * decides, so this asks it rather than repeating the arithmetic.
 */
export function panRoom(view: View, size: number): PanRoom {
  const room: PanRoom = {};
  for (const dir of ["up", "down", "left", "right"] as PanDir[]) {
    const to = panView(view, dir, size);
    room[dir] = to.col !== view.col || to.row !== view.row;
  }
  return room;
}

/** Screen origin that parks `view` at the centre of a `viewW` x `viewH` canvas. */
export const viewOrigin = (view: View, viewW: number, viewH: number): Origin => ({
  x: viewW / 2 - (view.col - view.row) * SX,
  y: viewH / 2 - (view.col + view.row) * SY - SY,
});
