import { describe, expect, it } from "vitest";
import {
  cameraAt,
  FIELD,
  FIELD_PX,
  fieldBounds,
  GRASS_VARIANTS,
  screenAt,
  TILE,
  tileVariant,
  visibleTiles,
} from "./field";
import { walk } from "./walker";

const ZOOM = 4;
const VIEW = { w: 800, h: 600 };
const MIDDLE = { x: FIELD_PX / 2, y: FIELD_PX / 2 };

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
