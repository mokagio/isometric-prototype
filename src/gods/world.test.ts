import { describe, expect, it } from "vitest";
import { dist } from "./bearing";
import {
  ARENA_R,
  BLACKSMITH,
  BOUNDS,
  CAMPS,
  CITY,
  COLOSSEUM,
  FOUNTAIN,
  houses,
  layoutWorld,
  pushOut,
  trees,
  WALL_THICK,
} from "./world";

const world = layoutWorld();

describe("the world", () => {
  it("keeps the road clear of trees from the city gate to the colosseum", () => {
    for (const t of trees()) expect(Math.abs(t.x) < 4 && t.z < -24 && t.z > COLOSSEUM.z, `${t.x},${t.z}`).toBe(false);
  });

  it("leaves room around each camp to fight in", () => {
    for (const camp of CAMPS) for (const t of trees()) expect(dist(t.x, t.z, camp.x, camp.z)).toBeGreaterThan(8);
  });

  it("keeps the counter and the road out of town free of houses", () => {
    for (const h of houses()) {
      expect(dist(h.x, h.z, BLACKSMITH.x, BLACKSMITH.z)).toBeGreaterThan(6);
      expect(Math.abs(h.x) < 6 && h.z < 0).toBe(false);
    }
  });

  it("puts everything inside the bounds", () => {
    for (const c of CAMPS) {
      expect(c.x).toBeGreaterThan(BOUNDS.x0);
      expect(c.z).toBeGreaterThan(BOUNDS.z0);
    }
    expect(COLOSSEUM.z - ARENA_R - WALL_THICK).toBeGreaterThan(BOUNDS.z0);
    expect(CITY.z + CITY.r).toBeLessThan(BOUNDS.z1);
  });

  it("pushes a body out of the fountain", () => {
    const p = pushOut(world, 0.5, 0, 0.45, false);
    expect(dist(p.x, p.z, FOUNTAIN.x, FOUNTAIN.z)).toBeCloseTo(FOUNTAIN.r + 0.45);
  });

  it("stops a body at the colosseum wall", () => {
    const p = pushOut(world, COLOSSEUM.x + ARENA_R + 0.5, COLOSSEUM.z, 0.45, false);
    expect(dist(p.x, p.z, COLOSSEUM.x, COLOSSEUM.z)).toBeCloseTo(ARENA_R - 0.45);
  });

  it("lets a body through the open gate, and not the closed one", () => {
    const gateway = { x: COLOSSEUM.x, z: COLOSSEUM.z + ARENA_R + 1 };
    expect(pushOut(world, gateway.x, gateway.z, 0.45, false)).toEqual(gateway);
    expect(pushOut(world, gateway.x, gateway.z, 0.45, true)).not.toEqual(gateway);
  });

  it("walks the whole road without being pushed off it", () => {
    for (let z = -26; z > COLOSSEUM.z + ARENA_R + WALL_THICK; z -= 1) {
      expect(pushOut(world, 0, z, 0.45, false)).toEqual({ x: 0, z });
    }
  });
});
