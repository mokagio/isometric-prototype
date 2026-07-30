import { describe, expect, it } from "vitest";
import { hazardToll, inHazard } from "./hazard";
import { INVULN, Lives, MAX_LIVES } from "./lives";
import type { World } from "./world";

/** Everything from column 6 on is hazard. */
const shore = { isHazard: (col: number) => col >= 6 } as unknown as Pick<World, "isHazard">;

describe("inHazard", () => {
  it("reads the cell the feet are nearest", () => {
    expect(inHazard(shore, { col: 5.4, row: 0 })).toBe(false);
    expect(inHazard(shore, { col: 5.6, row: 0 })).toBe(true);
  });
});

describe("hazardToll", () => {
  it("leaves the bar alone on dry land", () => {
    const lives = new Lives();
    expect(hazardToll(shore, { col: 2, row: 2 }, lives)).toBe(false);
    expect(lives.lives).toBe(MAX_LIVES);
  });

  it("spends a heart for standing in it", () => {
    const lives = new Lives();
    expect(hazardToll(shore, { col: 7, row: 2 }, lives)).toBe(true);
    expect(lives.lives).toBe(MAX_LIVES - 1);
  });

  it("charges a heart a second, not a heart a frame", () => {
    // Wading is meant to be a price you can pay, not a bar emptied in ten frames.
    const lives = new Lives();
    let spent = 0;
    for (let t = 0; t < 3; t += 1 / 60) {
      lives.update(1 / 60);
      if (hazardToll(shore, { col: 7, row: 2 }, lives)) spent++;
    }
    expect(spent).toBe(1 + 3 / INVULN); // one on wading in, then one a second
  });

  it("does not spend the immunity a monster just bought", () => {
    // The toll runs after a bump in the same frame; both should not land.
    const lives = new Lives();
    expect(lives.hit()).toBe(true);
    expect(hazardToll(shore, { col: 7, row: 2 }, lives)).toBe(false);
    expect(lives.lives).toBe(MAX_LIVES - 1);
  });
});
