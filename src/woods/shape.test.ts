import { describe, expect, it } from "vitest";
import { FENCE_RING, FIELD } from "./field";
import { grownLand, hasOutline, isLand, JAG, neighbours, setOutline, shoreDepth } from "./shape";

const SIDES = ["north", "east", "south", "west"] as const;

describe("shoreDepth", () => {
  it("keeps every shore between the border and the deepest bay", () => {
    for (const side of SIDES) {
      for (let along = 0; along < FIELD; along++) {
        const depth = shoreDepth(side, along);
        expect(depth, `${side} ${along}`).toBeGreaterThanOrEqual(0);
        expect(depth, `${side} ${along}`).toBeLessThanOrEqual(JAG);
      }
    }
  });

  it("steps by at most a cell at a time, so the corner tiles can turn it", () => {
    // A step of two would leave a two-cell cliff in the coastline, and the pack
    // has no tile that joins one.
    for (const side of SIDES) {
      for (let along = 1; along < FIELD; along++) {
        const step = Math.abs(shoreDepth(side, along) - shoreDepth(side, along - 1));
        expect(step, `${side} at ${along}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("wanders rather than running straight", () => {
    for (const side of SIDES) {
      const depths = new Set(Array.from({ length: FIELD }, (_, i) => shoreDepth(side, i)));
      expect(depths.size, side).toBeGreaterThan(1);
    }
  });

  it("draws the same island every time", () => {
    for (const side of SIDES) expect(shoreDepth(side, 7)).toBe(shoreDepth(side, 7));
  });
});

describe("isLand", () => {
  it("is all sea beyond the field", () => {
    expect(isLand(-1, 10)).toBe(false);
    expect(isLand(FIELD, 10)).toBe(false);
    expect(isLand(10, -1)).toBe(false);
    expect(isLand(10, FIELD)).toBe(false);
  });

  it("is one island, not an archipelago", () => {
    // Flood fill from the middle: every land cell has to be reachable, or the
    // wander has bitten a piece off.
    const seen = new Set<number>();
    const stack = [{ col: Math.floor(FIELD / 2), row: Math.floor(FIELD / 2) }];
    while (stack.length) {
      const { col, row } = stack.pop()!;
      const key = row * FIELD + col;
      if (seen.has(key) || !isLand(col, row)) continue;
      seen.add(key);
      stack.push({ col: col + 1, row }, { col: col - 1, row }, { col, row: row + 1 }, { col, row: row - 1 });
    }
    let land = 0;
    for (let row = 0; row < FIELD; row++) {
      for (let col = 0; col < FIELD; col++) if (isLand(col, row)) land++;
    }
    expect(seen.size).toBe(land);
  });

  it("leaves the fenced rectangle wholly dry, with room outside it for the coast", () => {
    // This is what lets the coast wander at all: the walker and the editor are
    // held inside the fence, so nothing out there is ever stood on.
    for (let row = FENCE_RING; row <= FIELD - 1 - FENCE_RING; row++) {
      for (let col = FENCE_RING; col <= FIELD - 1 - FENCE_RING; col++) {
        expect(isLand(col, row), `${col},${row}`).toBe(true);
      }
    }
  });
});

describe("neighbours", () => {
  it("reports the land on each side", () => {
    const middle = Math.floor(FIELD / 2);
    expect(neighbours(middle, middle)).toEqual({ north: true, east: true, south: true, west: true });
    expect(neighbours(-1, -1)).toEqual({ north: false, east: false, south: false, west: false });
  });
});

describe("a drawn outline", () => {
  const blank = (): boolean[] => new Array<boolean>(FIELD * FIELD).fill(false);

  it("stands in for the grown one, cell for cell", () => {
    const drawn = blank();
    drawn[5 * FIELD + 5] = true;
    setOutline(drawn);
    try {
      expect(hasOutline()).toBe(true);
      expect(isLand(5, 5)).toBe(true);
      expect(isLand(6, 5)).toBe(false);
    } finally {
      setOutline(null);
    }
  });

  it("hands back to the grown island when it is cleared", () => {
    setOutline(blank());
    setOutline(null);
    expect(hasOutline()).toBe(false);
    let same = true;
    for (let row = 0; row < FIELD; row++) {
      for (let col = 0; col < FIELD; col++) same &&= isLand(col, row) === grownLand(col, row);
    }
    expect(same).toBe(true);
  });

  it("refuses an outline of the wrong size rather than drawing half an island", () => {
    setOutline([true, false]);
    expect(hasOutline()).toBe(false);
    setOutline(null);
  });

  it("is still the sea beyond the field, whatever was drawn", () => {
    setOutline(new Array<boolean>(FIELD * FIELD).fill(true));
    try {
      expect(isLand(-1, 0)).toBe(false);
      expect(isLand(FIELD, 0)).toBe(false);
    } finally {
      setOutline(null);
    }
  });
});
