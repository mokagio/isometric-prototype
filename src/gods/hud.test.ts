import { describe, expect, it } from "vitest";
import { heartFills, HEART_HP } from "./hud";

describe("the hearts", () => {
  it("fill whole, then part, then empty", () => {
    const fills = heartFills(HEART_HP * 2.5);
    expect(fills.slice(0, 4)).toEqual([1, 1, 0.5, 0]);
  });
});
