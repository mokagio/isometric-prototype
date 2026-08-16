import { CELL, type Origin } from "../grid";

// Where the board sits under the canvas, and how far in.
//
// Fitting the whole board is the way to see its shape; zooming in is the way to
// judge a 4px lip, which is what the tile editor is for. Zoom steps are whole
// numbers because pixel art at 1.5 is mush.

/** Zoom in whole steps, plus the fitted view that comes before them. */
export const ZOOM_STEPS = [1, 2, 3, 4] as const;

export interface View {
  /** Null fits the whole board; a number is that many screen pixels per sheet pixel. */
  zoom: number | null;
  /** Top-left cell of the view, in whole cells. Ignored while fitted. */
  col: number;
  row: number;
}

export const FITTED: View = { zoom: null, col: 0, row: 0 };

export interface Board {
  cols: number;
  rows: number;
}

/** The whole board at once, shrunk to fit and centred. */
export function fitBoard(
  board: Board,
  viewW: number,
  viewH: number,
): { scale: number; origin: Origin } {
  const scale = Math.min(1, viewW / (board.cols * CELL), viewH / (board.rows * CELL));
  const w = viewW / scale;
  const h = viewH / scale;
  return {
    scale,
    origin: {
      x: Math.round(w / 2 - (board.cols * CELL) / 2),
      y: Math.round(h / 2 - (board.rows * CELL) / 2),
    },
  };
}

/** How many whole cells of the board the canvas can show at this zoom. */
export function roomFor(zoom: number, viewW: number, viewH: number): { cols: number; rows: number } {
  return {
    cols: Math.max(1, Math.floor(viewW / (CELL * zoom))),
    rows: Math.max(1, Math.floor(viewH / (CELL * zoom))),
  };
}

/** Keep the view on the board, and centred on whichever axis the board is smaller than. */
export function clampView(view: View, board: Board, viewW: number, viewH: number): View {
  if (view.zoom === null) return FITTED;
  const room = roomFor(view.zoom, viewW, viewH);
  const stop = (at: number, cells: number, showing: number): number =>
    showing >= cells ? Math.floor((cells - showing) / 2) : Math.max(0, Math.min(cells - showing, at));
  return {
    zoom: view.zoom,
    col: stop(view.col, board.cols, room.cols),
    row: stop(view.row, board.rows, room.rows),
  };
}

/** The next zoom in or out, fitted being the step below the first one. */
export function stepZoom(view: View, by: 1 | -1): View {
  if (view.zoom === null) return by > 0 ? { ...view, zoom: ZOOM_STEPS[0] } : view;
  const at = ZOOM_STEPS.indexOf(view.zoom as (typeof ZOOM_STEPS)[number]);
  const next = at + by;
  if (next < 0) return { ...view, zoom: null };
  return { ...view, zoom: ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, next)]! };
}

export type PanDir = "up" | "down" | "left" | "right";

/** How far one press of an arrow moves, in cells. */
export const PAN_STEP = 4;

export function pan(view: View, dir: PanDir, board: Board, viewW: number, viewH: number): View {
  if (view.zoom === null) return view;
  const moved: View = {
    zoom: view.zoom,
    col: view.col + (dir === "left" ? -PAN_STEP : dir === "right" ? PAN_STEP : 0),
    row: view.row + (dir === "up" ? -PAN_STEP : dir === "down" ? PAN_STEP : 0),
  };
  return clampView(moved, board, viewW, viewH);
}

/** Which ways there is still board to go, for greying out the arrows. */
export function roomToPan(
  view: View,
  board: Board,
  viewW: number,
  viewH: number,
): Record<PanDir, boolean> {
  const dirs: PanDir[] = ["up", "down", "left", "right"];
  const here = clampView(view, board, viewW, viewH);
  const room = {} as Record<PanDir, boolean>;
  for (const dir of dirs) {
    const there = pan(here, dir, board, viewW, viewH);
    room[dir] = there.col !== here.col || there.row !== here.row;
  }
  return room;
}

/** Where the board's top-left corner lands on the canvas, and how big a cell is. */
export function placement(
  view: View,
  board: Board,
  viewW: number,
  viewH: number,
): { scale: number; origin: Origin } {
  if (view.zoom === null) return fitBoard(board, viewW, viewH);
  const at = clampView(view, board, viewW, viewH);
  return { scale: view.zoom, origin: { x: -at.col * CELL, y: -at.row * CELL } };
}
