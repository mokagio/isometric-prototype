import { describe, expect, it } from "vitest";
import { FIELD, FIELD_PX, TILE } from "../field";
import { cameraFor, cellAtPoint, fitZoom, islandOrigin, MIN_ZOOM, onIsland } from "./view";

describe("fitZoom", () => {
  it("fits the whole island in the canvas", () => {
    const zoom = fitZoom(1400, 900);
    expect(FIELD_PX * zoom).toBeLessThanOrEqual(900);
  });

  it("grows with the canvas", () => {
    expect(fitZoom(2000, 2000)).toBeGreaterThan(fitZoom(1000, 1000));
  });

  it("never shrinks below one, so a small window shows tiles rather than mush", () => {
    expect(fitZoom(200, 120)).toBe(MIN_ZOOM);
  });

  it("stays on half-steps, so tiles land on whole pixels either side of the halves", () => {
    for (const [w, h] of [[900, 700] as const, [1280, 1024] as const, [1600, 999] as const]) {
      expect((fitZoom(w, h) * 2) % 1).toBe(0);
    }
  });
});

describe("islandOrigin", () => {
  it("centres the island in the canvas", () => {
    const zoom = fitZoom(1400, 900);
    const origin = islandOrigin(1400, 900, zoom);
    expect(origin.x).toBe(Math.round((1400 - FIELD_PX * zoom) / 2));
    expect(origin.y).toBe(Math.round((900 - FIELD_PX * zoom) / 2));
  });

  it("agrees with the camera the ground is drawn through", () => {
    const zoom = 2;
    const origin = islandOrigin(1000, 800, zoom);
    const camera = cameraFor(1000, 800, zoom);
    // `screenAt` puts world 0,0 at -camera * zoom, which has to be the origin.
    expect(-camera.x * zoom).toBeCloseTo(origin.x);
    expect(-camera.y * zoom).toBeCloseTo(origin.y);
  });
});

describe("cellAtPoint", () => {
  it("finds the cell a click landed on", () => {
    const zoom = 2;
    const origin = islandOrigin(1000, 800, zoom);
    const point = { x: origin.x + 5 * TILE * zoom + 3, y: origin.y + 7 * TILE * zoom + 3 };
    expect(cellAtPoint(point.x, point.y, 1000, 800, zoom)).toEqual({ col: 5, row: 7 });
  });

  it("reads a click off the island as off the island", () => {
    const zoom = 2;
    const origin = islandOrigin(1000, 800, zoom);
    expect(onIsland(cellAtPoint(origin.x - 4, origin.y + 4, 1000, 800, zoom))).toBe(false);
    expect(onIsland(cellAtPoint(origin.x + 4, origin.y - 4, 1000, 800, zoom))).toBe(false);
  });

  it("holds the far corner of the island on the island", () => {
    const zoom = 2;
    const origin = islandOrigin(1000, 800, zoom);
    const last = { x: origin.x + (FIELD * TILE - 1) * zoom, y: origin.y + (FIELD * TILE - 1) * zoom };
    expect(cellAtPoint(last.x, last.y, 1000, 800, zoom)).toEqual({ col: FIELD - 1, row: FIELD - 1 });
    expect(onIsland(cellAtPoint(last.x + zoom, last.y, 1000, 800, zoom))).toBe(false);
  });
});
