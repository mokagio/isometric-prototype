import { dist } from "./bearing";
import { inTartarus, TARTARUS } from "./hades";
import { inVolcano, VOLCANO } from "./volcano";

/**
 * Where everything stands, in metres. The city sits at the origin and the road
 * runs north (toward -z) out of its gate to Ares's colosseum, whose own gate
 * faces back down the road.
 */

export interface Circle {
  x: number;
  z: number;
  r: number;
}
export interface Box {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export const CITY: Circle = { x: 0, z: 0, r: 24 };
export const PLAZA_R = 12;
export const FOUNTAIN: Circle = { x: 0, z: 0, r: 2.4 };
export const CITY_GATE_Z = -24;
export const BLACKSMITH = { x: 11, z: 5 };
/** How close to the blacksmith counts as being at the counter. */
export const SHOP_RANGE = 4.2;

export const COLOSSEUM = { x: 0, z: -150 };
export const ARENA_R = 20;
export const WALL_THICK = 4;
export const GATE_HALF = 3.2;
/** Step this far inside the wall and the gate drops behind you. */
export const FIGHT_TRIGGER = ARENA_R - 5;

export const ROAD_HALF = 3.5;
export const ROAD_START = CITY_GATE_Z;
export const ROAD_END = COLOSSEUM.z + ARENA_R + WALL_THICK;

export const BOUNDS: Box = { x0: -62, z0: -192, x1: 62, z1: 42 };

/** The fishing village, east of the city on the coast, round Poseidon's colosseum. */
export const VILLAGE: Circle = { x: 122, z: -40, r: 30 };
/** Poseidon's colosseum, at the heart of the village. Its gate faces west, down the road. */
export const SEA_ARENA = { x: 122, z: -40, r: 16, thick: 3.5, yaw: -Math.PI / 2 };
/** Past this the land shelves into the sea. */
export const SHORE_X = 162;
/** The road east branches off the road to Ares here and runs straight to Poseidon's gate. */
export const EAST_ROAD_Z = VILLAGE.z;
export const EAST_ROAD_END = SEA_ARENA.x - SEA_ARENA.r - SEA_ARENA.thick;
/** Wooden piers out into the sea: where each one runs, and how far. */
export const PIERS: readonly number[] = [-60, -40, -20];
export const PIER_HALF = 1.3;
export const PIER_LENGTH = 18;
export const LIGHTHOUSE = { x: SHORE_X + PIER_LENGTH + 3, z: -40, r: 2.4 };
/** Stone islands in Poseidon's arena: the only dry footing when he floods it. */
export const ISLAND_H = 0.8;
export const SEA_ISLANDS: readonly Circle[] = [0, 1, 2, 3].map((k) => {
  const a = Math.PI / 4 + (k * Math.PI) / 2;
  return { x: SEA_ARENA.x + Math.sin(a) * (SEA_ARENA.r - 5), z: SEA_ARENA.z + Math.cos(a) * (SEA_ARENA.r - 5), r: 1.9 };
});

export function onIsland(x: number, z: number): boolean {
  return SEA_ISLANDS.some((c) => dist(x, z, c.x, c.z) < c.r);
}

/** The statue of Poseidon, outside his gate. */
export const SEA_STATUE = { x: EAST_ROAD_END - 5, z: VILLAGE.z + 7 };

/** Everywhere the hero can walk: the meadow, the road east, the village, and out along the piers. */
export const REGIONS: readonly Box[] = [
  BOUNDS,
  // The path west to the foot of the volcano's stairs.
  { x0: VOLCANO.x + VOLCANO.r - 1, z0: VOLCANO.z - 6, x1: BOUNDS.x0 + 2, z1: VOLCANO.z + 6 },
  { x0: BOUNDS.x1 - 2, z0: EAST_ROAD_Z - 8, x1: VILLAGE.x - VILLAGE.r + 4, z1: EAST_ROAD_Z + 8 },
  { x0: VILLAGE.x - VILLAGE.r - 2, z0: VILLAGE.z - 34, x1: SHORE_X, z1: VILLAGE.z + 34 },
  ...PIERS.map((z) => ({ x0: SHORE_X - 2, z0: z - PIER_HALF, x1: SHORE_X + PIER_LENGTH, z1: z + PIER_HALF })),
  { x0: LIGHTHOUSE.x - 3.4, z0: LIGHTHOUSE.z - 3.4, x1: LIGHTHOUSE.x + 3.4, z1: LIGHTHOUSE.z + 3.4 },
];

export function inRegions(x: number, z: number): boolean {
  return REGIONS.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
}

/** How far `(x, z)` is from anywhere walkable: 0 inside. */
export function outside(x: number, z: number): number {
  let best = Infinity;
  for (const b of REGIONS) {
    const dx = Math.max(b.x0 - x, 0, x - b.x1);
    const dz = Math.max(b.z0 - z, 0, z - b.z1);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}

/** Pull a body of radius `r` back onto the nearest walkable ground. */
function clampToRegions(x: number, z: number, r: number): { x: number; z: number } {
  let best = { x, z };
  let bestD = Infinity;
  for (const b of REGIONS) {
    const cx = Math.min(b.x1 - r, Math.max(b.x0 + r, x));
    const cz = Math.min(b.z1 - r, Math.max(b.z0 + r, z));
    const d = Math.hypot(cx - x, cz - z);
    if (d === 0) return { x, z };
    if (d < bestD) {
      bestD = d;
      best = { x: cx, z: cz };
    }
  }
  return best;
}

export interface Camp {
  x: number;
  z: number;
  count: number;
}

/** Bandit camps along the roads: one, then the rest in threes, and one on the way to the sea. */
export const CAMPS: readonly Camp[] = [
  { x: -4, z: -50, count: 2 },
  { x: 48, z: EAST_ROAD_Z + 9, count: 2 },
  { x: 6, z: -68, count: 3 },
  { x: -6, z: -90, count: 3 },
  { x: 4, z: -110, count: 3 },
];

export interface World {
  circles: Circle[];
  boxes: Box[];
}

export interface House {
  x: number;
  z: number;
  /** Footprint, already turned to face the plaza. */
  w: number;
  d: number;
  /** Which way the door faces. */
  yaw: number;
  dome: boolean;
}

/** Houses ring the plaza, leaving the north clear for the road and the east for the blacksmith. */
export function houses(): House[] {
  const out: House[] = [];
  const angles = [200, 230, 260, 290, 320, 340, 160, 130, 100, 75, 45];
  angles.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    // x = sin, z = cos, so 180° is due south (+z).
    const r = 18 + (i % 2) * 1.5;
    const x = Math.round(Math.sin(a) * r);
    const z = Math.round(Math.cos(a) * r);
    // Snap the door to whichever axis points back at the plaza.
    const back = Math.atan2(-x, -z);
    const yaw = Math.round(back / (Math.PI / 2)) * (Math.PI / 2);
    const big = i % 3 === 0;
    const w = big ? 6 : 5;
    const d = big ? 5 : 4.5;
    const across = Math.abs(Math.sin(yaw)) > 0.5;
    out.push({ x, z, w: across ? d : w, d: across ? w : d, yaw, dome: i % 4 === 1 });
  });
  return out.filter((h) => dist(h.x, h.z, BLACKSMITH.x, BLACKSMITH.z) > 7 && !(Math.abs(h.x) < 6 && h.z < 0));
}

/** A value hash: the same cell always gives the same number in [0, 1). */
export function hash(x: number, z: number, salt = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(salt | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function nearRoad(x: number, z: number, margin: number): boolean {
  if (z < ROAD_START + margin && z > ROAD_END - margin && Math.abs(x) < ROAD_HALF + margin) return true;
  return Math.abs(z - EAST_ROAD_Z) < ROAD_HALF + margin && x > -margin && x < EAST_ROAD_END + margin;
}

export function inVillage(x: number, z: number, within = VILLAGE.r): boolean {
  return dist(x, z, VILLAGE.x, VILLAGE.z) < within;
}

/** Fishermen's huts in a ring round the colosseum, leaving the west open for the road and the east for the docks. */
export function huts(): House[] {
  const out: House[] = [];
  const angles = [0, 28, 56, 124, 152, 180, 208, 236, 304, 332];
  angles.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const r = 24 + (i % 2) * 2.5;
    const x = Math.round(VILLAGE.x + Math.sin(a) * r);
    const z = Math.round(VILLAGE.z + Math.cos(a) * r);
    const back = Math.atan2(VILLAGE.x - x, VILLAGE.z - z);
    const yaw = Math.round(back / (Math.PI / 2)) * (Math.PI / 2);
    const across = Math.abs(Math.sin(yaw)) > 0.5;
    const w = 4.6;
    const d = 4;
    out.push({ x, z, w: across ? d : w, d: across ? w : d, yaw, dome: false });
  });
  return out;
}

/** Fishermen about the village and the docks: where each stands and which way they face. */
export const FISHERS: ReadonlyArray<{ x: number; z: number; yaw: number }> = [
  { x: SHORE_X + 6, z: PIERS[0]! + 0.4, yaw: Math.PI / 2 },
  { x: SHORE_X + 11, z: PIERS[2]! - 0.3, yaw: 0 },
  { x: SHORE_X - 7, z: VILLAGE.z + 5, yaw: Math.PI / 2 },
  { x: SEA_ARENA.x + SEA_ARENA.r + SEA_ARENA.thick + 2.7, z: VILLAGE.z - 8, yaw: Math.PI / 2 },
];

export function nearColosseum(x: number, z: number, margin: number): boolean {
  return dist(x, z, COLOSSEUM.x, COLOSSEUM.z) < ARENA_R + WALL_THICK + margin;
}

export interface Tree {
  x: number;
  z: number;
  size: number;
}

/** Trees on a jittered grid, kept off the roads, out of town, clear of the colosseums and back from the beach. */
export function trees(): Tree[] {
  const out: Tree[] = [];
  const step = 7;
  for (let gz = BOUNDS.z0 - 40; gz <= BOUNDS.z1 + 40; gz += step) {
    for (let gx = BOUNDS.x0 - 40; gx <= SHORE_X - 14; gx += step) {
      const keep = hash(gx, gz, 1);
      const x = gx + (hash(gx, gz, 2) - 0.5) * step * 0.8;
      const z = gz + (hash(gx, gz, 3) - 0.5) * step * 0.8;
      if (x > SHORE_X - 16) continue;
      const inside = inRegions(x, z);
      // Thick forest past the edge of the world, open meadow with copses inside it.
      if (keep > (inside ? 0.28 : 0.75)) continue;
      if (dist(x, z, CITY.x, CITY.z) < CITY.r + 6) continue;
      if (nearRoad(x, z, 5)) continue;
      if (nearColosseum(x, z, 8)) continue;
      if (inVillage(x, z, VILLAGE.r + 5)) continue;
      if (dist(x, z, VOLCANO.x, VOLCANO.z) < VOLCANO.r + 8) continue;
      if (x < BOUNDS.x0 + 6 && Math.abs(z - VOLCANO.z) < 8) continue;
      if (CAMPS.some((c) => dist(x, z, c.x, c.z) < 9)) continue;
      out.push({ x, z, size: 0.8 + hash(gx, gz, 4) * 0.7 });
    }
  }
  return out;
}

export const TRUNK_R = 0.5;

export function layoutWorld(): World {
  const boxes: Box[] = [...houses(), ...huts()].map((h) => ({ x0: h.x - h.w / 2, z0: h.z - h.d / 2, x1: h.x + h.w / 2, z1: h.z + h.d / 2 }));
  // The forge and counter, with the smith behind them.
  boxes.push({ x0: BLACKSMITH.x - 0.5, z0: BLACKSMITH.z - 3, x1: BLACKSMITH.x + 3.5, z1: BLACKSMITH.z + 3 });
  const circles: Circle[] = [
    FOUNTAIN,
    { x: -4.5, z: CITY_GATE_Z, r: 1 },
    { x: 4.5, z: CITY_GATE_Z, r: 1 },
    { x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, r: LIGHTHOUSE.r },
    { x: SEA_STATUE.x, z: SEA_STATUE.z, r: 1.4 },
    ...trees()
      .filter((t) => outside(t.x, t.z) < 2)
      .map((t) => ({ x: t.x, z: t.z, r: TRUNK_R * t.size })),
  ];
  return { circles, boxes };
}

export interface Ring {
  x: number;
  z: number;
  r: number;
  thick: number;
  /** Which way the gate faces. */
  yaw: number;
}

export const ARES_RING: Ring = { ...COLOSSEUM, r: ARENA_R, thick: WALL_THICK, yaw: 0 };

/** Whether `(x, z)` is in a colosseum's gateway, where the wall has its gap. */
export function inGateway(x: number, z: number, ring: Ring = ARES_RING): boolean {
  const dx = x - ring.x;
  const dz = z - ring.z;
  const across = dx * Math.cos(ring.yaw) - dz * Math.sin(ring.yaw);
  const along = dx * Math.sin(ring.yaw) + dz * Math.cos(ring.yaw);
  return Math.abs(across) < GATE_HALF && along > 0;
}

/** Keep a body of radius `r` on one side of a colosseum's wall, or let it through the open gate. */
function wall(ring: Ring, x: number, z: number, r: number, closed: boolean): { x: number; z: number } {
  const dc = dist(x, z, ring.x, ring.z);
  const inner = ring.r - r;
  const outer = ring.r + ring.thick + r;
  if (dc > inner && dc < outer && dc > 1e-6 && (closed || !inGateway(x, z, ring))) {
    const to = dc < ring.r + ring.thick / 2 ? inner : outer;
    return { x: ring.x + ((x - ring.x) / dc) * to, z: ring.z + ((z - ring.z) / dc) * to };
  }
  return { x, z };
}

/** Slide a body of radius `r` back out of whatever it walked into. */
export function pushOut(world: World, x: number, z: number, r: number, gateClosed: boolean, seaGateClosed = false): { x: number; z: number } {
  // Up on the volcano nothing holds you in: stepping off the path is a fall.
  if (inVolcano(x, z)) return { x, z };
  // Tartarus is one round floor with nothing round it.
  if (inTartarus(x, z)) {
    const d = dist(x, z, TARTARUS.x, TARTARUS.z);
    const limit = TARTARUS.r - r;
    return d > limit ? { x: TARTARUS.x + ((x - TARTARUS.x) / d) * limit, z: TARTARUS.z + ((z - TARTARUS.z) / d) * limit } : { x, z };
  }
  ({ x, z } = clampToRegions(x, z, r));

  for (const c of world.circles) {
    const d = dist(x, z, c.x, c.z);
    const min = c.r + r;
    if (d < min && d > 1e-6) {
      x = c.x + ((x - c.x) / d) * min;
      z = c.z + ((z - c.z) / d) * min;
    }
  }

  for (const b of world.boxes) {
    if (x + r <= b.x0 || x - r >= b.x1 || z + r <= b.z0 || z - r >= b.z1) continue;
    // Out by the shortest way.
    const left = x + r - b.x0;
    const right = b.x1 - (x - r);
    const up = z + r - b.z0;
    const down = b.z1 - (z - r);
    const least = Math.min(left, right, up, down);
    if (least === left) x = b.x0 - r;
    else if (least === right) x = b.x1 + r;
    else if (least === up) z = b.z0 - r;
    else z = b.z1 + r;
  }

  ({ x, z } = wall(ARES_RING, x, z, r, gateClosed));
  ({ x, z } = wall(SEA_ARENA, x, z, r, seaGateClosed));
  return { x, z };
}

export function inCity(x: number, z: number): boolean {
  return dist(x, z, CITY.x, CITY.z) < CITY.r;
}

export function inArena(x: number, z: number, within = ARENA_R): boolean {
  return dist(x, z, COLOSSEUM.x, COLOSSEUM.z) < within;
}

export function inSeaArena(x: number, z: number, within = SEA_ARENA.r): boolean {
  return dist(x, z, SEA_ARENA.x, SEA_ARENA.z) < within;
}
