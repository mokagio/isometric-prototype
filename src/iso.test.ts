import { describe, expect, it } from "vitest";
import { project, SX, SY, SZ } from "./iso";

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
