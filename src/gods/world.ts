import { dist } from "./bearing";

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

export interface Camp {
  x: number;
  z: number;
  count: number;
}

/** Skeleton camps along the road: one, then the rest in threes. */
export const CAMPS: readonly Camp[] = [
  { x: -4, z: -46, count: 2 },
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
  return z < ROAD_START + margin && z > ROAD_END - margin && Math.abs(x) < ROAD_HALF + margin;
}

export function nearColosseum(x: number, z: number, margin: number): boolean {
  return dist(x, z, COLOSSEUM.x, COLOSSEUM.z) < ARENA_R + WALL_THICK + margin;
}

export interface Tree {
  x: number;
  z: number;
  size: number;
}

/** Trees on a jittered grid, kept off the road, out of town and clear of the colosseum. */
export function trees(): Tree[] {
  const out: Tree[] = [];
  const step = 7;
  for (let gz = BOUNDS.z0 - 40; gz <= BOUNDS.z1 + 40; gz += step) {
    for (let gx = BOUNDS.x0 - 40; gx <= BOUNDS.x1 + 40; gx += step) {
      const keep = hash(gx, gz, 1);
      const x = gx + (hash(gx, gz, 2) - 0.5) * step * 0.8;
      const z = gz + (hash(gx, gz, 3) - 0.5) * step * 0.8;
      const inside = x > BOUNDS.x0 && x < BOUNDS.x1 && z > BOUNDS.z0 && z < BOUNDS.z1;
      // Thick forest past the edge of the world, open meadow with copses inside it.
      if (keep > (inside ? 0.28 : 0.75)) continue;
      if (dist(x, z, CITY.x, CITY.z) < CITY.r + 6) continue;
      if (nearRoad(x, z, 5)) continue;
      if (nearColosseum(x, z, 8)) continue;
      if (CAMPS.some((c) => dist(x, z, c.x, c.z) < 9)) continue;
      out.push({ x, z, size: 0.8 + hash(gx, gz, 4) * 0.7 });
    }
  }
  return out;
}

export const TRUNK_R = 0.5;

export function layoutWorld(): World {
  const boxes: Box[] = houses().map((h) => ({ x0: h.x - h.w / 2, z0: h.z - h.d / 2, x1: h.x + h.w / 2, z1: h.z + h.d / 2 }));
  // The forge and counter, with the smith behind them.
  boxes.push({ x0: BLACKSMITH.x - 0.5, z0: BLACKSMITH.z - 3, x1: BLACKSMITH.x + 3.5, z1: BLACKSMITH.z + 3 });
  const circles: Circle[] = [
    FOUNTAIN,
    { x: -4.5, z: CITY_GATE_Z, r: 1 },
    { x: 4.5, z: CITY_GATE_Z, r: 1 },
    ...trees()
      .filter((t) => t.x > BOUNDS.x0 - 2 && t.x < BOUNDS.x1 + 2 && t.z > BOUNDS.z0 - 2 && t.z < BOUNDS.z1 + 2)
      .map((t) => ({ x: t.x, z: t.z, r: TRUNK_R * t.size })),
  ];
  return { circles, boxes };
}

/** Whether `(x, z)` is in the colosseum's gateway, where the wall has its gap. */
export function inGateway(x: number, z: number): boolean {
  return Math.abs(x - COLOSSEUM.x) < GATE_HALF && z > COLOSSEUM.z;
}

/** Slide a body of radius `r` back out of whatever it walked into. */
export function pushOut(world: World, x: number, z: number, r: number, gateClosed: boolean): { x: number; z: number } {
  x = Math.min(BOUNDS.x1 - r, Math.max(BOUNDS.x0 + r, x));
  z = Math.min(BOUNDS.z1 - r, Math.max(BOUNDS.z0 + r, z));

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

  const dc = dist(x, z, COLOSSEUM.x, COLOSSEUM.z);
  const inner = ARENA_R - r;
  const outer = ARENA_R + WALL_THICK + r;
  if (dc > inner && dc < outer && dc > 1e-6 && (gateClosed || !inGateway(x, z))) {
    const to = dc < ARENA_R + WALL_THICK / 2 ? inner : outer;
    x = COLOSSEUM.x + ((x - COLOSSEUM.x) / dc) * to;
    z = COLOSSEUM.z + ((z - COLOSSEUM.z) / dc) * to;
  }
  return { x, z };
}

export function inCity(x: number, z: number): boolean {
  return dist(x, z, CITY.x, CITY.z) < CITY.r;
}

export function inArena(x: number, z: number, within = ARENA_R): boolean {
  return dist(x, z, COLOSSEUM.x, COLOSSEUM.z) < within;
}
