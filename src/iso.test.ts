import { describe, expect, it } from "vitest";
import { project, SX, SY, SZ, unproject } from "./iso";

const O = { x: 0, y: 0 };

describe("project", () => {
  it("puts the reference cell at the origin", () => {
    expect(project(0, 0, 0, O)).toEqual({ x: 0, y: 0 });
  });

  it("tessellates neighbours by one half-step", () => {
    // +col goes down-right, +row goes down-left, by (SX, SY) each.
    expect(project(1, 0, 0, O)).toEqual({ x: SX, y: SY });
    expect(project(0, 1, 0, O)).toEqual({ x: -SX, y: SY });
  });

  it("raises elevation straight up by one level step", () => {
    const ground = project(3, 2, 0, O);
    const raised = project(3, 2, 1, O);
    expect(raised.x).toBe(ground.x);
    expect(ground.y - raised.y).toBe(SZ);
  });
});

describe("unproject", () => {
  const origin = { x: 137, y: -42 };

  it("recovers the cell from its diamond centre (round-trips project)", () => {
    for (let col = 0; col < 20; col += 3) {
      for (let row = 0; row < 20; row += 3) {
        const apex = project(col, row, 0, origin);
        const centre = { x: apex.x, y: apex.y + SY };
        expect(unproject(centre.x, centre.y, origin)).toEqual({ col, row });
      }
    }
  });

  it("snaps points near a cell centre to that cell", () => {
    const apex = project(5, 8, 0, origin);
    expect(unproject(apex.x + 3, apex.y + SY - 2, origin)).toEqual({ col: 5, row: 8 });
  });
});
