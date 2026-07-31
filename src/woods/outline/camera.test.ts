import { describe, expect, it } from "vitest";
import { FIELD_PX, TILE } from "../field";
import { cameraFor, cellAt, clampOrigin, stepZoom, zoomAbout, zoomLadder, ZOOM_STEPS } from "./camera";

describe("zoomLadder", () => {
  it("starts at whatever shows the whole island", () => {
    const ladder = zoomLadder(FIELD_PX * 2, FIELD_PX * 2);
    expect(ladder[0]).toBe(2);
    expect(ladder).toEqual([2, 3, 4]);
  });

  it("shrinks below life size rather than cropping a short window", () => {
    expect(zoomLadder(FIELD_PX, FIELD_PX / 2)[0]).toBe(0.5);
  });

  it("never goes below half, however small the window", () => {
    expect(zoomLadder(10, 10)[0]).toBe(0.5);
  });

  it("climbs to the same cap wherever it starts", () => {
    for (const size of [FIELD_PX / 2, FIELD_PX, FIELD_PX * 3]) {
      const ladder = zoomLadder(size, size);
      expect(ladder[ladder.length - 1]).toBe(ZOOM_STEPS[ZOOM_STEPS.length - 1]);
    }
  });

  it("only ever climbs", () => {
    const ladder = zoomLadder(FIELD_PX, FIELD_PX);
    for (let i = 1; i < ladder.length; i++) expect(ladder[i]!).toBeGreaterThan(ladder[i - 1]!);
  });
});

describe("stepZoom", () => {
  const ladder = [0.5, 1, 2, 3, 4];

  it("moves a rung at a time", () => {
    expect(stepZoom(ladder, 1, 1)).toBe(2);
    expect(stepZoom(ladder, 2, -1)).toBe(1);
  });

  it("stops at either end rather than falling off", () => {
    expect(stepZoom(ladder, 0.5, -1)).toBe(0.5);
    expect(stepZoom(ladder, 4, 1)).toBe(4);
  });

  it("finds its footing from a zoom no longer on the ladder", () => {
    // The window resized under it, so the loosest rung moved.
    expect(stepZoom([1.5, 2, 3, 4], 0.5, 1)).toBe(2);
  });
});

describe("zoomAbout", () => {
  it("keeps the point under the pointer where it was", () => {
    const origin = { x: -100, y: -40 };
    const anchor = { x: 300, y: 200 };
    const before = cellAt(anchor, { zoom: 1, origin });
    const after = cellAt(anchor, { zoom: 2, origin: zoomAbout(origin, 1, 2, anchor) });
    expect(after).toEqual(before);
  });

  it("leaves the view alone when the zoom does not change", () => {
    const origin = { x: -7, y: 3 };
    expect(zoomAbout(origin, 2, 2, { x: 100, y: 100 })).toEqual(origin);
  });
});

describe("clampOrigin", () => {
  it("centres the island on an axis it fits", () => {
    const w = FIELD_PX + 200;
    const at = clampOrigin({ x: -500, y: -500 }, 1, w, w);
    expect(at).toEqual({ x: 100, y: 100 });
  });

  it("never lets the island's edge come inside the canvas", () => {
    const w = 400;
    const span = FIELD_PX * 2;
    expect(clampOrigin({ x: 50, y: 50 }, 2, w, w)).toEqual({ x: 0, y: 0 });
    expect(clampOrigin({ x: -9999, y: -9999 }, 2, w, w)).toEqual({ x: w - span, y: w - span });
  });

  it("leaves a view already inside its bounds alone", () => {
    expect(clampOrigin({ x: -100, y: -100 }, 2, 400, 400)).toEqual({ x: -100, y: -100 });
  });
});

describe("cellAt", () => {
  it("reads the cell under a point", () => {
    const view = { zoom: 2, origin: { x: 10, y: 20 } };
    expect(cellAt({ x: 10, y: 20 }, view)).toEqual({ col: 0, row: 0 });
    expect(cellAt({ x: 10 + TILE * 2 * 3.5, y: 20 + TILE * 2 * 1.5 }, view)).toEqual({ col: 3, row: 1 });
  });

  it("reads off the island as out of bounds rather than clamping", () => {
    expect(cellAt({ x: -1, y: -1 }, { zoom: 1, origin: { x: 0, y: 0 } })).toEqual({ col: -1, row: -1 });
  });
});

describe("cameraFor", () => {
  it("puts the field's corner where the origin says", () => {
    expect(cameraFor({ zoom: 2, origin: { x: -40, y: 60 } })).toEqual({ x: 20, y: -30 });
  });
});
