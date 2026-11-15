import { describe, expect, it } from "vitest";
import { dist } from "./bearing";
import { ZEUS_RING } from "./zeus";
import {
  ARENA_R,
  BLACKSMITH,
  BOUNDS,
  EAST_ROAD_END,
  EAST_ROAD_Z,
  huts,
  onIsland,
  PIER_LENGTH,
  PIERS,
  SEA_ARENA,
  SEA_ISLANDS,
  SHORE_X,
  VILLAGE,
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

  it("walks the road east from the fork to Poseidon's gate", () => {
    for (let x = 4; x < EAST_ROAD_END; x += 1) {
      expect(pushOut(world, x, EAST_ROAD_Z, 0.45, false)).toEqual({ x, z: EAST_ROAD_Z });
    }
  });

  it("walks out to the end of every pier, but not into the sea beside it", () => {
    for (const z of PIERS) {
      const end = { x: SHORE_X + PIER_LENGTH - 1, z };
      expect(pushOut(world, end.x, end.z, 0.45, false)).toEqual(end);
      expect(pushOut(world, end.x, z + 5, 0.45, false).z).toBeLessThan(z + 5);
    }
  });

  it("stops at the water's edge", () => {
    expect(pushOut(world, SHORE_X + 6, VILLAGE.z + 10, 0.45, false).x).toBeLessThanOrEqual(SHORE_X);
  });

  it("lets a body through Poseidon's open gate, and not the closed one", () => {
    const gateway = { x: SEA_ARENA.x - SEA_ARENA.r - 1, z: SEA_ARENA.z };
    expect(pushOut(world, gateway.x, gateway.z, 0.45, false, false)).toEqual(gateway);
    expect(pushOut(world, gateway.x, gateway.z, 0.45, false, true)).not.toEqual(gateway);
  });

  it("stops a body at Poseidon's wall away from the gate", () => {
    const p = pushOut(world, SEA_ARENA.x + SEA_ARENA.r + 0.5, SEA_ARENA.z, 0.45, false);
    expect(dist(p.x, p.z, SEA_ARENA.x, SEA_ARENA.z)).toBeCloseTo(SEA_ARENA.r - 0.45);
  });

  it("keeps the flood islands inside Poseidon's arena", () => {
    for (const c of SEA_ISLANDS) expect(dist(c.x, c.z, SEA_ARENA.x, SEA_ARENA.z) + c.r).toBeLessThan(SEA_ARENA.r);
    expect(onIsland(SEA_ISLANDS[0]!.x, SEA_ISLANDS[0]!.z)).toBe(true);
    expect(onIsland(SEA_ARENA.x, SEA_ARENA.z)).toBe(false);
  });

  it("keeps the huts and camps off the road east and clear of Poseidon's wall", () => {
    for (const h of huts()) {
      expect(Math.abs(h.z - EAST_ROAD_Z) > 4 || h.x > EAST_ROAD_END).toBe(true);
      expect(dist(h.x, h.z, SEA_ARENA.x, SEA_ARENA.z) - Math.max(h.w, h.d) / 2).toBeGreaterThan(SEA_ARENA.r + SEA_ARENA.thick);
    }
    for (const c of CAMPS) expect(Math.abs(c.z - EAST_ROAD_Z)).toBeGreaterThan(6);
  });

  it("keeps Zeus's back wall shut until it breaks, then lets you through to the stairs", () => {
    const back = { x: ZEUS_RING.x, z: ZEUS_RING.z + ZEUS_RING.r + 1 };
    expect(pushOut(world, back.x, back.z, 0.45, false, false, false, false, false)).not.toEqual(back);
    expect(pushOut(world, back.x, back.z, 0.45, false, false, false, false, true)).toEqual(back);
  });
});
