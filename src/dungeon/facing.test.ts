import { describe, expect, it } from "vitest";
import { DOWN, facingFromAxis, LEFT, RIGHT, UP } from "./facing";

describe("facingFromAxis", () => {
  it("is null when standing still, so the caller keeps its last heading", () => {
    expect(facingFromAxis(0, 0)).toBeNull();
  });

  it("maps the four straight headings", () => {
    expect(facingFromAxis(0, -1)).toBe(UP);
    expect(facingFromAxis(0, 1)).toBe(DOWN);
    expect(facingFromAxis(-1, 0)).toBe(LEFT);
    expect(facingFromAxis(1, 0)).toBe(RIGHT);
  });

  it("takes the larger component on a slanted heading", () => {
    expect(facingFromAxis(0.3, -1)).toBe(UP);
    expect(facingFromAxis(1, -0.3)).toBe(RIGHT);
  });

  // A tie that flipped on rounding noise would flicker between two sheets.
  it("settles an exact diagonal on the vertical", () => {
    expect(facingFromAxis(1, 1)).toBe(DOWN);
    expect(facingFromAxis(-1, -1)).toBe(UP);
    expect(facingFromAxis(1, -1)).toBe(UP);
  });

  it("reads the stick's raw magnitudes the same as a key's", () => {
    expect(facingFromAxis(40, -3)).toBe(RIGHT);
    expect(facingFromAxis(-2, 30)).toBe(DOWN);
  });
});
