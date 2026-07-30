import { describe, expect, it } from "vitest";
import { centreView, clampView, panView, PAN_STEP, viewOrigin, type PanDir } from "./view";
import { unproject } from "../iso";

const SIZE = 56;
const CANVAS = { w: 800, h: 600 };

/** The cell the canvas centre lands on, which is what the view is supposed to control. */
const cellAtCentre = (view: { col: number; row: number }): { col: number; row: number } =>
  unproject(CANVAS.w / 2, CANVAS.h / 2, viewOrigin(view, CANVAS.w, CANVAS.h));

describe("editor view", () => {
  it("starts looking at the middle of the board", () => {
    // An even board has two middle cells; either will do, a corner will not.
    const view = centreView(SIZE);
    expect(Math.abs(view.col - (SIZE - 1) / 2)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(view.row - (SIZE - 1) / 2)).toBeLessThanOrEqual(0.5);
  });

  it("keeps the view on whole cells, so tiles never land on half-pixels", () => {
    // An odd board has no exact middle cell; the view still has to pick one.
    const view = centreView(11);
    expect(Number.isInteger(view.col)).toBe(true);
    expect(Number.isInteger(view.row)).toBe(true);
  });

  it("parks the view's cell under the centre of the canvas", () => {
    expect(cellAtCentre({ col: 10, row: 40 })).toEqual({ col: 10, row: 40 });
  });

  it("pans up and down the screen, not along a grid axis", () => {
    // Screen-up on an iso grid is a step along both axes at once.
    const up = panView({ col: 20, row: 20 }, "up", SIZE);
    expect(up).toEqual({ col: 20 - PAN_STEP, row: 20 - PAN_STEP });
    const down = panView({ col: 20, row: 20 }, "down", SIZE);
    expect(down).toEqual({ col: 20 + PAN_STEP, row: 20 + PAN_STEP });
  });

  it("pans left and right across the screen", () => {
    expect(panView({ col: 20, row: 20 }, "left", SIZE)).toEqual({ col: 20 - PAN_STEP, row: 20 + PAN_STEP });
    expect(panView({ col: 20, row: 20 }, "right", SIZE)).toEqual({ col: 20 + PAN_STEP, row: 20 - PAN_STEP });
  });

  it("moves the view the way the screen moves", () => {
    // Panning right has to bring cells on the right into the middle, or the
    // arrows fight the hand holding them.
    const before = viewOrigin({ col: 20, row: 20 }, CANVAS.w, CANVAS.h);
    const after = viewOrigin(panView({ col: 20, row: 20 }, "right", SIZE), CANVAS.w, CANVAS.h);
    expect(after.x).toBeLessThan(before.x); // the board slides left, revealing the right
    expect(after.y).toBe(before.y); // and stays level

    const up = viewOrigin(panView({ col: 20, row: 20 }, "up", SIZE), CANVAS.w, CANVAS.h);
    expect(up.y).toBeGreaterThan(before.y); // the board slides down, revealing the top
    expect(up.x).toBe(before.x);
  });

  it("stops at the edges instead of drifting off the board", () => {
    let view = { col: 2, row: 2 };
    for (let i = 0; i < 50; i++) view = panView(view, "up", SIZE);
    expect(view).toEqual({ col: 0, row: 0 });

    view = { col: SIZE - 3, row: SIZE - 3 };
    for (let i = 0; i < 50; i++) view = panView(view, "down", SIZE);
    expect(view).toEqual({ col: SIZE - 1, row: SIZE - 1 });
  });

  it("still slides along an edge once it is pinned against it", () => {
    // Pinned at the top corner, panning right must still travel — otherwise the
    // whole top edge of the board is unreachable.
    const pinned = { col: 0, row: 0 };
    expect(panView(pinned, "right", SIZE)).toEqual({ col: PAN_STEP, row: 0 });
    expect(panView(pinned, "left", SIZE)).toEqual({ col: 0, row: PAN_STEP });
  });

  it("can bring every corner of the board to the centre", () => {
    for (const corner of [
      { col: 0, row: 0 },
      { col: SIZE - 1, row: 0 },
      { col: 0, row: SIZE - 1 },
      { col: SIZE - 1, row: SIZE - 1 },
    ]) {
      expect(clampView(corner, SIZE)).toEqual(corner);
      expect(cellAtCentre(corner)).toEqual(corner);
    }
  });

  it("hauls a view from outside the board back onto it", () => {
    expect(clampView({ col: -9, row: 900 }, SIZE)).toEqual({ col: 0, row: SIZE - 1 });
  });

  it("takes every direction somewhere", () => {
    const dirs: PanDir[] = ["up", "down", "left", "right"];
    const from = { col: 20, row: 20 };
    const seen = new Set(dirs.map((d) => JSON.stringify(panView(from, d, SIZE))));
    expect(seen.size).toBe(4);
  });
});
