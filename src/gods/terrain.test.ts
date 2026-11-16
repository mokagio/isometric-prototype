import { describe, expect, it } from "vitest";
import { GRID, groundY, heightAt, HILL_HEIGHT } from "./terrain";
import { CAMPS, CITY, COLOSSEUM, HAMLETS, OPEN, VILLAGE } from "./world";
import { VOLCANO } from "./volcano";
import { OLYMPUS, ZEUS_RING } from "./zeus";

describe("the lie of the land", () => {
  it("is level wherever something stands", () => {
    const level = [CITY, COLOSSEUM, VILLAGE, ZEUS_RING, ...HAMLETS, ...CAMPS, { x: VOLCANO.x + VOLCANO.r, z: VOLCANO.z }, { x: OLYMPUS.x, z: OLYMPUS.z - OLYMPUS.r }];
    for (const p of level) expect(groundY(p.x, p.z), `${p.x},${p.z}`).toBeCloseTo(0, 3);
  });

  it("rolls into real hills out in the open country, never higher than the limit", () => {
    let highest = 0;
    for (let x = OPEN.x0; x < OPEN.x1; x += 13) {
      for (let z = OPEN.z0; z < OPEN.z1; z += 13) {
        const h = heightAt(x, z);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(HILL_HEIGHT + 1e-9);
        highest = Math.max(highest, h);
      }
    }
    expect(highest).toBeGreaterThan(HILL_HEIGHT / 2);
  });

  it("puts feet on the drawn ground: the same height at every mesh corner, and no step between", () => {
    for (const [x, z] of [[200, -304], [-312, 104], [96, 456]] as const) {
      expect(groundY(x, z)).toBeCloseTo(heightAt(x, z), 9);
      for (let d = 0; d < GRID * 3; d += 0.5) expect(Math.abs(groundY(x + d + 0.5, z) - groundY(x + d, z))).toBeLessThan(0.5);
    }
  });
});
