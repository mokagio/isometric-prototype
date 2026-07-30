import { describe, expect, it } from "vitest";
import {
  cameraAt,
  FIELD,
  FIELD_PX,
  fieldBounds,
  GRASS_VARIANTS,
  MIDDLE,
  screenAt,
  TILE,
  tileVariant,
  treeAt,
  treePhase,
  visibleTiles,
} from "./field";
import { walk } from "./walker";

const ZOOM = 4;
const VIEW = { w: 800, h: 600 };

describe("tileVariant", () => {
  it("paints a cell the same way every time", () => {
    expect(tileVariant(3, 7)).toBe(tileVariant(3, 7));
  });

  it("only ever names a frame the strip has", () => {
    for (let row = 0; row < FIELD; row++) {
      for (let col = 0; col < FIELD; col++) {
        const v = tileVariant(col, row);
        expect(v, `${col},${row}`).toBeGreaterThanOrEqual(0);
        expect(v, `${col},${row}`).toBeLessThan(GRASS_VARIANTS);
      }
    }
  });

  it("uses every frame, with plain grass the most of them", () => {
    const count = new Array<number>(GRASS_VARIANTS).fill(0);
    for (let row = 0; row < FIELD; row++) {
      for (let col = 0; col < FIELD; col++) count[tileVariant(col, row)]!++;
    }
    for (const n of count) expect(n).toBeGreaterThan(0);
    expect(Math.max(...count)).toBe(count[0]);
  });
});

describe("treeAt", () => {
  const all = (): Array<[number, number]> => {
    const found: Array<[number, number]> = [];
    for (let row = 0; row < FIELD; row++) {
      for (let col = 0; col < FIELD; col++) if (treeAt(col, row)) found.push([col, row]);
    }
    return found;
  };

  it("stands the same trees in the same places every time", () => {
    expect(all()).toEqual(all());
  });

  it("scatters a wood you can still walk through", () => {
    // Thin enough to leave gaps, thick enough to be a wood: a handful per screen.
    const share = all().length / (FIELD * FIELD);
    expect(share).toBeGreaterThan(0.02);
    expect(share).toBeLessThan(0.1);
  });

  it("leaves the middle clear, so nobody starts inside a trunk", () => {
    const mid = FIELD / 2;
    for (let row = mid - 2; row <= mid + 2; row++) {
      for (let col = mid - 2; col <= mid + 2; col++) expect(treeAt(col, row), `${col},${row}`).toBe(false);
    }
    expect(treeAt(MIDDLE.x / TILE, MIDDLE.y / TILE)).toBe(false);
  });

  it("plants nothing out in the void", () => {
    expect(treeAt(-1, 5)).toBe(false);
    expect(treeAt(5, -1)).toBe(false);
    expect(treeAt(FIELD, 5)).toBe(false);
    expect(treeAt(5, FIELD)).toBe(false);
  });

  it("gives each tree its own place in the sway", () => {
    const phases = new Set(all().map(([col, row]) => treePhase(col, row).toFixed(3)));
    expect(phases.size).toBeGreaterThan(10); // not one wood breathing in unison
    for (const [col, row] of all()) {
      expect(treePhase(col, row)).toBeGreaterThanOrEqual(0);
      expect(treePhase(col, row)).toBeLessThan(1);
    }
  });
});

describe("visibleTiles padding", () => {
  it("reaches beyond the screen for sprites taller than a tile", () => {
    const camera = cameraAt(MIDDLE, VIEW.w, VIEW.h, ZOOM);
    const tight = visibleTiles(camera, VIEW.w, VIEW.h, ZOOM);
    const padded = visibleTiles(camera, VIEW.w, VIEW.h, ZOOM, 3);
    expect(padded.minRow).toBe(tight.minRow - 3);
    expect(padded.maxCol).toBe(tight.maxCol + 3);
  });

  it("still stops at the edge of the field", () => {
    const camera = cameraAt({ x: 0, y: 0 }, VIEW.w, VIEW.h, ZOOM);
    const padded = visibleTiles(camera, VIEW.w, VIEW.h, ZOOM, 3);
    expect(padded.minCol).toBe(0);
    expect(padded.minRow).toBe(0);
  });
});

describe("cameraAt", () => {
  it("holds the character in the middle of the screen", () => {
    const camera = cameraAt(MIDDLE, VIEW.w, VIEW.h, ZOOM);
    expect(screenAt(MIDDLE, camera, ZOOM)).toEqual({ x: VIEW.w / 2, y: VIEW.h / 2 });
  });

  it("keeps them there at the very edge of the field, showing the void instead", () => {
    // Peaceful Plains does the same: the map runs out before the camera does.
    const corner = { x: 0, y: 0 };
    const camera = cameraAt(corner, VIEW.w, VIEW.h, ZOOM);
    expect(screenAt(corner, camera, ZOOM)).toEqual({ x: VIEW.w / 2, y: VIEW.h / 2 });
    expect(camera.x).toBeLessThan(0); // the field's top-left is on screen, with room to spare
  });
});

describe("visibleTiles", () => {
  const inField = (r: ReturnType<typeof visibleTiles>): boolean =>
    r.minCol >= 0 && r.minRow >= 0 && r.maxCol < FIELD && r.maxRow < FIELD;

  it("covers the whole screen when the camera is inside the field", () => {
    const camera = cameraAt(MIDDLE, VIEW.w, VIEW.h, ZOOM);
    const r = visibleTiles(camera, VIEW.w, VIEW.h, ZOOM);
    // The first drawn tile must start at or before the screen's left edge, and
    // the last must finish at or after its right edge.
    expect(screenAt({ x: r.minCol * TILE, y: r.minRow * TILE }, camera, ZOOM).x).toBeLessThanOrEqual(0);
    const end = screenAt({ x: (r.maxCol + 1) * TILE, y: (r.maxRow + 1) * TILE }, camera, ZOOM);
    expect(end.x).toBeGreaterThanOrEqual(VIEW.w);
    expect(end.y).toBeGreaterThanOrEqual(VIEW.h);
    expect(inField(r)).toBe(true);
  });

  it("never asks for a cell off the edge of the field", () => {
    for (const corner of [
      { x: 0, y: 0 },
      { x: FIELD_PX, y: 0 },
      { x: 0, y: FIELD_PX },
      { x: FIELD_PX, y: FIELD_PX },
    ]) {
      const camera = cameraAt(corner, VIEW.w, VIEW.h, ZOOM);
      expect(inField(visibleTiles(camera, VIEW.w, VIEW.h, ZOOM)), `${corner.x},${corner.y}`).toBe(true);
    }
  });
});

describe("fieldBounds", () => {
  it("stops the walker inside the field, not at the void", () => {
    const bounds = fieldBounds(4);
    const east = { dc: 1, dr: -1 };
    let pos = MIDDLE;
    for (let i = 0; i < 200; i++) pos = walk(pos, east, 0.5, bounds);
    expect(pos.x).toBe(FIELD_PX - 4);
    expect(pos.x).toBeLessThan(FIELD_PX);
  });
});
