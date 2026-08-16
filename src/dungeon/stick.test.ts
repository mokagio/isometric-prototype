import { describe, expect, it } from "vitest";
import { steppedCircle, steppedRing } from "./stick";

const points = (polygon: string): Array<[number, number]> =>
  polygon
    .slice("polygon(".length, -1)
    .split(", ")
    .map((pair) => {
      const [x, y] = pair.split(" ").map((v) => Number(v.replace("%", "")));
      return [x!, y!];
    });

describe("steppedCircle", () => {
  it("is a closed polygon of whole-cell steps", () => {
    const pts = points(steppedCircle(16));
    expect(pts.length).toBe(16 * 4);
    for (const [x, y] of pts) {
      expect((x / 100) * 16).toBeCloseTo(Math.round((x / 100) * 16), 2);
      expect((y / 100) * 16).toBeCloseTo(Math.round((y / 100) * 16), 2);
    }
  });

  it("stays inside the square", () => {
    for (const [x, y] of points(steppedCircle(16))) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it("is widest across the middle", () => {
    const pts = points(steppedCircle(16));
    const xs = pts.filter(([, y]) => Math.abs(y - 50) < 4).map(([x]) => x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 0);
  });
});

describe("steppedRing", () => {
  it("carries the hole as a second, reversed loop", () => {
    expect(points(steppedRing(16, 1))).toHaveLength(points(steppedCircle(16)).length * 2);
  });

  it("leaves the outer edge where the solid circle put it", () => {
    const ring = points(steppedRing(16, 1));
    const solid = points(steppedCircle(16));
    expect(ring.slice(0, solid.length)).toEqual(solid);
  });
});
