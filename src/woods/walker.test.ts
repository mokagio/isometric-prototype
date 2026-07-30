import { describe, expect, it } from "vitest";
import { facingFrom, screenAxis, SPEED, walk, type Bounds } from "./walker";

// The axes each control writes, as `input.ts` and `stick.ts` produce them.
const UP = { dc: -1, dr: -1 };
const DOWN = { dc: 1, dr: 1 };
const LEFT = { dc: -1, dr: 1 };
const RIGHT = { dc: 1, dr: -1 };
const UP_RIGHT = { dc: 0, dr: -1 };
const STILL = { dc: 0, dr: 0 };

const ROOM: Bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
const MIDDLE = { x: 50, y: 50 };

describe("screenAxis", () => {
  it("sends each key the way its name says, on screen", () => {
    expect(screenAxis(UP)).toEqual({ x: 0, y: -1 });
    expect(screenAxis(DOWN)).toEqual({ x: 0, y: 1 });
    expect(screenAxis(LEFT)).toEqual({ x: -1, y: 0 });
    expect(screenAxis(RIGHT)).toEqual({ x: 1, y: 0 });
  });

  it("stands still for a centred stick", () => {
    expect(screenAxis(STILL)).toEqual({ x: 0, y: 0 });
  });

  it("holds a diagonal to the same length as a straight line", () => {
    const d = screenAxis(UP_RIGHT);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    expect(d.x).toBeCloseTo(Math.SQRT1_2);
    expect(d.y).toBeCloseTo(-Math.SQRT1_2);
  });

  it("reads a part-deflected stick as a direction, not a slower walk", () => {
    // `axisFromDrag` hands back fractions; only the heading matters here, since
    // `walk` supplies the speed.
    expect(Math.hypot(...Object.values(screenAxis({ dc: 0.1, dr: -0.1 })))).toBeCloseTo(1);
  });
});

describe("walk", () => {
  it("covers SPEED pixels in a second", () => {
    const field: Bounds = { minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
    expect(walk(MIDDLE, RIGHT, 1, field).x).toBeCloseTo(50 + SPEED);
  });

  it("covers as much ground on a diagonal as in a straight line", () => {
    const straight = walk(MIDDLE, RIGHT, 0.1, ROOM);
    const diagonal = walk(MIDDLE, UP_RIGHT, 0.1, ROOM);
    const far = (p: { x: number; y: number }): number => Math.hypot(p.x - MIDDLE.x, p.y - MIDDLE.y);
    expect(far(diagonal)).toBeCloseTo(far(straight));
  });

  it("stays put when nothing is held", () => {
    expect(walk(MIDDLE, STILL, 1, ROOM)).toEqual(MIDDLE);
  });

  it("stops at each edge rather than walking off the field", () => {
    expect(walk({ x: 99, y: 50 }, RIGHT, 1, ROOM).x).toBe(ROOM.maxX);
    expect(walk({ x: 1, y: 50 }, LEFT, 1, ROOM).x).toBe(ROOM.minX);
    expect(walk({ x: 50, y: 1 }, UP, 1, ROOM).y).toBe(ROOM.minY);
    expect(walk({ x: 50, y: 99 }, DOWN, 1, ROOM).y).toBe(ROOM.maxY);
  });
});

describe("walk past something solid", () => {
  // A trunk-sized box to the east of the walker.
  const trunk = { x0: 60, x1: 76, y0: 42, y1: 58 };
  const blocked = (at: { x: number; y: number }): boolean =>
    at.x > trunk.x0 && at.x < trunk.x1 && at.y > trunk.y0 && at.y < trunk.y1;

  it("stops rather than walking into it", () => {
    let pos = MIDDLE;
    for (let i = 0; i < 40; i++) pos = walk(pos, RIGHT, 0.1, ROOM, blocked);
    expect(pos.x).toBeLessThanOrEqual(trunk.x0);
    expect(pos.y).toBe(MIDDLE.y);
  });

  it("slides along it when pushed in at an angle", () => {
    // Down-and-right into the trunk's left face: the x move is refused while the
    // y move is not, so the walker slips round it instead of sticking.
    const downRight = { dc: 1, dr: 0 };
    let pos = { x: 58, y: 50 };
    for (let i = 0; i < 20; i++) {
      pos = walk(pos, downRight, 0.05, ROOM, blocked);
      expect(blocked(pos), `step ${i} at ${pos.x},${pos.y}`).toBe(false);
    }
    expect(pos.y).toBeGreaterThan(trunk.y1); // got round it
    expect(pos.x).toBeGreaterThan(trunk.x1); // and carried on east once clear
  });

  it("goes where it likes with nothing in the way", () => {
    const open = walk(MIDDLE, RIGHT, 0.1, ROOM);
    expect(walk(MIDDLE, RIGHT, 0.1, ROOM, () => false)).toEqual(open);
  });
});

describe("facingFrom", () => {
  it("faces the way it is travelling across the screen", () => {
    expect(facingFrom(1, "left")).toBe("right");
    expect(facingFrom(-1, "right")).toBe("left");
  });

  it("keeps the last facing while walking straight up or down", () => {
    expect(facingFrom(0, "left")).toBe("left");
    expect(facingFrom(0, "right")).toBe("right");
  });
});

describe("walking out of somewhere blocked", () => {
  const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
  const wall = (at: { x: number; y: number }): boolean => at.x < 20;

  it("refuses a step that walks into something solid", () => {
    const next = walk({ x: 30, y: 50 }, { dc: -1, dr: 1 }, 1, bounds, wall);
    expect(next.x).toBe(30);
  });

  it("lets a walker who started inside it get out", () => {
    // An island can be saved with a house on the spot the walker arrives at.
    // Refusing every step there would leave them stuck for good.
    const next = walk({ x: 10, y: 50 }, { dc: 1, dr: -1 }, 1, bounds, wall);
    expect(next.x).toBeGreaterThan(10);
  });
});

