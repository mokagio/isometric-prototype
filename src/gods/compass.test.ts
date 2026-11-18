import { describe, expect, it } from "vitest";
import { bearing, dialMarks, fitMap, GOD_PLACES, headingOf } from "./compass";
import { COLOSSEUM, SEA_ARENA } from "./world";

describe("bearings", () => {
  it("call the road to Ares north and the sea east", () => {
    expect(bearing(COLOSSEUM.x, COLOSSEUM.z)).toBeCloseTo(0);
    expect(Math.abs(bearing(SEA_ARENA.x, SEA_ARENA.z) - Math.PI / 2)).toBeLessThan(0.1);
  });

  it("turn clockwise, so south is half a turn and west three quarters", () => {
    expect(Math.abs(bearing(0, 10))).toBeCloseTo(Math.PI);
    expect(bearing(-10, 0)).toBeCloseTo(-Math.PI / 2);
  });

  it("point the arrow the way the hero faces", () => {
    // Yaw π faces -z, which is up the road.
    expect(headingOf(Math.PI)).toBeCloseTo(0);
    expect(headingOf(Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });
});

describe("the dial", () => {
  it("marks every god once", () => {
    const marks = dialMarks(0, 0, []);
    expect(marks).toHaveLength(GOD_PLACES.length);
    expect(new Set(marks.map((m) => m.id)).size).toBe(GOD_PLACES.length);
  });

  it("dims the gods already beaten", () => {
    const marks = dialMarks(0, 0, ["ares"]);
    expect(marks.find((m) => m.id === "ares")!.beaten).toBe(true);
    expect(marks.find((m) => m.id === "zeus")!.beaten).toBe(false);
  });

  it("reads each mark from where the hero stands", () => {
    // Standing east of Ares's colosseum, it lies to the west.
    const ares = dialMarks(COLOSSEUM.x + 100, COLOSSEUM.z, []).find((m) => m.id === "ares")!;
    expect(ares.bearing).toBeCloseTo(-Math.PI / 2);
  });
});

describe("the map", () => {
  it("fits the box inside the screen with north up", () => {
    const fit = fitMap({ x0: -100, z0: -200, x1: 100, z1: 200 }, 400, 400, 20);
    const nw = fit.toScreen(-100, -200);
    const se = fit.toScreen(100, 200);
    expect(nw.y).toBeCloseTo(20);
    expect(se.y).toBeCloseTo(380);
    expect(nw.x).toBeGreaterThanOrEqual(20);
    expect(se.x).toBeLessThanOrEqual(380);
    expect(nw.x).toBeLessThan(se.x);
  });
});
