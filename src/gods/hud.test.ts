import { describe, expect, it } from "vitest";
import { compassAt, heartFills, HEART_HP } from "./hud";

describe("the hearts", () => {
  it("fill whole, then part, then empty", () => {
    const fills = heartFills(HEART_HP * 2.5);
    expect(fills.slice(0, 4)).toEqual([1, 1, 0.5, 0]);
  });
});

describe("the compass", () => {
  it("centres what is straight ahead", () => {
    expect(compassAt(1, 1)).toBeCloseTo(0.5);
  });

  it("puts what is to the camera's right on the right", () => {
    // Facing +z, the right is -x, which is a yaw of -π/2.
    expect(compassAt(0, -0.5)!).toBeGreaterThan(0.5);
  });

  it("drops what is behind", () => {
    expect(compassAt(0, Math.PI)).toBeNull();
  });

  it("wraps the short way round", () => {
    expect(compassAt(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.5 - 0.2 / (Math.PI * 0.9));
  });
});
