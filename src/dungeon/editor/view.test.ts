import { describe, expect, it } from "vitest";
import { CELL } from "../grid";
import {
  FITTED,
  PAN_STEP,
  ZOOM_STEPS,
  clampView,
  fitBoard,
  pan,
  placement,
  roomFor,
  roomToPan,
  stepZoom,
  type View,
} from "./view";

const board = { cols: 40, rows: 30 };
const zoomed = (col: number, row: number, zoom = 2): View => ({ zoom, col, row });

describe("fitBoard", () => {
  it("shrinks a board bigger than the canvas until it fits", () => {
    const { scale } = fitBoard(board, 800, 600);
    expect(scale).toBeLessThan(1);
    expect(board.cols * CELL * scale).toBeLessThanOrEqual(800.001);
    expect(board.rows * CELL * scale).toBeLessThanOrEqual(600.001);
  });

  it("never blows a small board up past its own pixels", () => {
    expect(fitBoard({ cols: 2, rows: 2 }, 4000, 4000).scale).toBe(1);
  });

  it("centres what it fits", () => {
    const { scale, origin } = fitBoard(board, 800, 600);
    const left = origin.x;
    const right = 800 / scale - (origin.x + board.cols * CELL);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });
});

describe("stepZoom", () => {
  it("steps up from fitted into the first whole zoom", () => {
    expect(stepZoom(FITTED, 1).zoom).toBe(ZOOM_STEPS[0]);
  });

  it("has nowhere further out than fitted", () => {
    expect(stepZoom(FITTED, -1)).toEqual(FITTED);
    expect(stepZoom(zoomed(0, 0, ZOOM_STEPS[0]), -1).zoom).toBeNull();
  });

  it("stops at the closest step in", () => {
    const last = ZOOM_STEPS[ZOOM_STEPS.length - 1];
    expect(stepZoom(zoomed(0, 0, last), 1).zoom).toBe(last);
  });

  it("only ever zooms by whole pixels, so the art stays crisp", () => {
    let view: View = FITTED;
    for (let i = 0; i < ZOOM_STEPS.length + 2; i++) {
      view = stepZoom(view, 1);
      expect(Number.isInteger(view.zoom)).toBe(true);
    }
  });

  it("keeps where you were looking when the zoom changes", () => {
    expect(stepZoom(zoomed(7, 5), 1)).toMatchObject({ col: 7, row: 5 });
  });
});

describe("clampView", () => {
  it("keeps the view on the board", () => {
    const off = clampView(zoomed(500, 500), board, 800, 600);
    const room = roomFor(2, 800, 600);
    expect(off.col).toBe(board.cols - room.cols);
    expect(off.row).toBe(board.rows - room.rows);
  });

  it("does not go past the top-left corner", () => {
    expect(clampView(zoomed(-9, -9), board, 800, 600)).toMatchObject({ col: 0, row: 0 });
  });

  it("centres an axis the canvas has more room than board on", () => {
    const wide = clampView(zoomed(0, 0, 1), { cols: 2, rows: 2 }, 4000, 4000);
    expect(wide.col).toBeLessThan(0);
    expect(wide.row).toBeLessThan(0);
  });

  it("leaves the fitted view alone", () => {
    expect(clampView(FITTED, board, 800, 600)).toEqual(FITTED);
  });
});

describe("pan", () => {
  it("moves by a step in the direction pressed", () => {
    expect(pan(zoomed(10, 10), "left", board, 400, 300).col).toBe(10 - PAN_STEP);
    expect(pan(zoomed(10, 10), "right", board, 400, 300).col).toBe(10 + PAN_STEP);
    expect(pan(zoomed(10, 10), "up", board, 400, 300).row).toBe(10 - PAN_STEP);
    expect(pan(zoomed(10, 10), "down", board, 400, 300).row).toBe(10 + PAN_STEP);
  });

  it("stops at the edge rather than sliding off", () => {
    const atEdge = pan(zoomed(0, 0), "left", board, 400, 300);
    expect(atEdge.col).toBe(0);
  });

  it("does nothing while the whole board is fitted", () => {
    expect(pan(FITTED, "left", board, 400, 300)).toEqual(FITTED);
  });

  it("still slides along an edge it is already pinned to", () => {
    const alongTop = pan(zoomed(10, 0), "up", board, 400, 300);
    expect(alongTop.row).toBe(0);
    expect(pan(alongTop, "right", board, 400, 300).col).toBe(10 + PAN_STEP);
  });
});

describe("roomToPan", () => {
  it("says there is nowhere left to go at a corner", () => {
    const room = roomToPan(zoomed(0, 0), board, 400, 300);
    expect(room.up).toBe(false);
    expect(room.left).toBe(false);
    expect(room.right).toBe(true);
    expect(room.down).toBe(true);
  });

  it("says there is nowhere to go at all when the board fits the canvas", () => {
    const room = roomToPan(zoomed(0, 0, 1), { cols: 3, rows: 3 }, 4000, 4000);
    expect(Object.values(room)).toEqual([false, false, false, false]);
  });
});

describe("placement", () => {
  it("hands the fitted view back to fitBoard", () => {
    expect(placement(FITTED, board, 800, 600)).toEqual(fitBoard(board, 800, 600));
  });

  it("puts the top-left cell of a zoomed view under the canvas corner", () => {
    const { scale, origin } = placement(zoomed(3, 2), board, 400, 300);
    expect(scale).toBe(2);
    expect(origin.x + 3 * CELL).toBe(0);
    expect(origin.y + 2 * CELL).toBe(0);
  });
});
