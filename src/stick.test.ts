import { describe, expect, it } from "vitest";
import { project, SX, SY } from "./iso";
import { axisFromDrag } from "./stick";

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
