import { describe, expect, it } from "vitest";
import { project, SX, SY } from "./iso";
import { axisFromDrag, steppedCircle, steppedRing } from "./stick";

/** The polygon's points as numeric percentages. */
const points = (cells: number): Array<[number, number]> => {
  const inner = steppedCircle(cells).replace(/^polygon\(|\)$/g, "");
  return inner.split(", ").map((p): [number, number] => {
    const [x, y] = p.split(" ").map((v) => Number(v.replace("%", "")));
    return [x!, y!];
  });
};

const O = { x: 0, y: 0 };

/** Where a step along `axis` from the origin cell lands on screen. */
const screenStep = (axis: { dc: number; dr: number }): { x: number; y: number } =>
  project(axis.dc, axis.dr, 0, O);

/** Angle of a screen vector, for comparing headings without caring about length. */
const heading = (x: number, y: number): number => Math.atan2(y, x);

describe("axisFromDrag", () => {
  it("holds still inside the centre", () => {
    expect(axisFromDrag(0, 0)).toEqual({ dc: 0, dr: 0 });
  });

  it("matches the four screen directions the arrow keys give", () => {
    // Same (dc, dr) signs as Input's key mapping, up to scale.
    expect(axisFromDrag(0, -SY * 2)).toEqual({ dc: -1, dr: -1 }); // up
    expect(axisFromDrag(0, SY * 2)).toEqual({ dc: 1, dr: 1 }); // down
    expect(axisFromDrag(-SX * 2, 0)).toEqual({ dc: -1, dr: 1 }); // left
    expect(axisFromDrag(SX * 2, 0)).toEqual({ dc: 1, dr: -1 }); // right
  });

  it("walks a single grid axis on the screen diagonals", () => {
    // The headings a four-button pad can only reach by holding two keys.
    expect(axisFromDrag(SX, -SY)).toEqual({ dc: 0, dr: -1 });
    expect(axisFromDrag(-SX, SY)).toEqual({ dc: 0, dr: 1 });
    expect(axisFromDrag(SX, SY)).toEqual({ dc: 1, dr: 0 });
    expect(axisFromDrag(-SX, -SY)).toEqual({ dc: -1, dr: 0 });
  });

  it("steers where the thumb points, at any angle", () => {
    // The property that makes it analog: projecting the result back to screen
    // reproduces the drag heading, not one of eight fixed ones.
    for (let deg = 0; deg < 360; deg += 7) {
      const rad = (deg * Math.PI) / 180;
      const dx = Math.cos(rad) * 40;
      const dy = Math.sin(rad) * 40;
      const back = screenStep(axisFromDrag(dx, dy));
      expect(heading(back.x, back.y)).toBeCloseTo(heading(dx, dy), 10);
    }
  });
});

describe("steppedCircle", () => {
  it("stays inside the box", () => {
    for (const [x, y] of points(16)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it("is symmetric about both midlines", () => {
    const seen = points(16).map(([x, y]) => `${x},${y}`).sort();
    const mirrored = points(16)
      .map(([x, y]) => `${Number((100 - x).toFixed(3))},${Number((100 - y).toFixed(3))}`)
      .sort();
    expect(mirrored).toEqual(seen);
  });

  it("steps rather than curving: every edge is axis-aligned", () => {
    const p = points(24);
    for (let i = 0; i < p.length; i++) {
      const [x1, y1] = p[i]!;
      const [x2, y2] = p[(i + 1) % p.length]!;
      // A smooth curve would need edges that move in x and y at once.
      expect(x1 === x2 || y1 === y2).toBe(true);
    }
  });

  it("rounds off the corners a square would have", () => {
    // The top row is inset from the full width, unlike a square's.
    const top = points(16).filter(([, y]) => y === 0).map(([x]) => x);
    const widest = points(16).map(([x]) => x);
    expect(Math.max(...top)).toBeLessThan(Math.max(...widest));
    expect(Math.min(...top)).toBeGreaterThan(Math.min(...widest));
  });

  it("gets finer as the grid does", () => {
    const distinctX = (cells: number): number => new Set(points(cells).map(([x]) => x)).size;
    expect(distinctX(24)).toBeGreaterThan(distinctX(8));
  });
});

describe("steppedRing", () => {
  const ringPoints = (cells: number, thickness: number): Array<[number, number]> =>
    steppedRing(cells, thickness)
      .replace(/^polygon\(|\)$/g, "")
      .split(", ")
      .map((p): [number, number] => {
        const [x, y] = p.split(" ").map((v) => Number(v.replace("%", "")));
        return [x!, y!];
      });

  it("traces an inner outline as well as an outer one", () => {
    // Without the hole the fill would be a solid disc, which is what blotted
    // out the terrain behind the translucent well.
    expect(ringPoints(16, 1)).toHaveLength(points(16).length * 2);
  });

  it("keeps the hole clear of the rim", () => {
    const widestOuter = Math.max(...points(16).map(([x]) => x));
    const widestInner = Math.max(...ringPoints(16, 1).slice(points(16).length).map(([x]) => x));
    expect(widestInner).toBeLessThan(widestOuter);
  });

  it("thickens the rim by shrinking the hole", () => {
    const innerWidth = (thickness: number): number =>
      Math.max(...ringPoints(16, thickness).slice(points(16).length).map(([x]) => x));
    expect(innerWidth(3)).toBeLessThan(innerWidth(1));
  });
});
