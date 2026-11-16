import { dist } from "./bearing";
import { HAMLET_R, HAMLETS, CAMPS, CITY, COLOSSEUM, ARENA_R, WALL_THICK, VILLAGE, hash } from "./world";
import { VOLCANO } from "./volcano";
import { OLYMPUS, ZEUS_RING } from "./zeus";
import { ARTEMIS } from "./artemis";
import { KRATOS } from "./kratos";
import { PEAK } from "./hydra";
import { LAIR } from "./medusa";

/**
 * The lie of the open land: rolling hills you can walk up and over, flattened
 * wherever something stands — the city, the hamlets, the colosseums, the
 * fishing village, the camps and the feet of the two mountains — so nothing is
 * ever built on a slope. The mountains themselves are not hills: their own
 * modules say where you can stand on them.
 */
export const HILL_HEIGHT = 8;
/** The ground mesh's spacing; `groundY` reads heights off the same grid, so feet land on the drawn surface. */
export const GRID = 8;

function smooth(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const v = (i: number, j: number): number => hash(x0 + i, z0 + j, seed);
  return v(0, 0) * (1 - sx) * (1 - sz) + v(1, 0) * sx * (1 - sz) + v(0, 1) * (1 - sx) * sz + v(1, 1) * sx * sz;
}

/** Where the ground must be level, and how far round each the land eases back up to hills. */
function places(): Array<{ x: number; z: number; r: number }> {
  return [
    { x: CITY.x, z: CITY.z, r: CITY.r + 10 },
    ...HAMLETS.map((h) => ({ x: h.x, z: h.z, r: HAMLET_R + 4 })),
    { x: COLOSSEUM.x, z: COLOSSEUM.z, r: ARENA_R + WALL_THICK + 12 },
    { x: ZEUS_RING.x, z: ZEUS_RING.z, r: ZEUS_RING.r + ZEUS_RING.thick + 12 },
    { x: VILLAGE.x, z: VILLAGE.z, r: VILLAGE.r + 12 },
    { x: VOLCANO.x, z: VOLCANO.z, r: VOLCANO.r + 12 },
    { x: OLYMPUS.x, z: OLYMPUS.z, r: OLYMPUS.r + 12 },
    { x: ARTEMIS.x, z: ARTEMIS.z, r: ARTEMIS.r + ARTEMIS.thick + 12 },
    { x: KRATOS.x, z: KRATOS.z, r: KRATOS.r + KRATOS.thick + 12 },
    { x: PEAK.x, z: PEAK.z, r: PEAK.r + 12 },
    { x: LAIR.x, z: LAIR.z, r: LAIR.r + 10 },
    ...CAMPS.map((c) => ({ x: c.x, z: c.z, r: 9 })),
  ];
}
const PLACES = places();
const EASE = 30;

/** 0 on level ground by a place, rising to 1 out in open country. */
export function wildness(x: number, z: number): number {
  let w = 1;
  for (const p of PLACES) {
    const d = dist(x, z, p.x, p.z) - p.r;
    if (d < EASE) w = Math.min(w, Math.max(0, d / EASE));
  }
  return w * w * (3 - 2 * w);
}

/** How high the land is at a point, in metres: rolling hills, level wherever something stands. */
export function heightAt(x: number, z: number): number {
  // The shore and the sea are the scenery's business; the land runs level down to the beach.
  if (x > VILLAGE.x - VILLAGE.r) return 0;
  const hills = smooth(x / 70, z / 70, 11) * 0.75 + smooth(x / 23, z / 23, 12) * 0.25;
  return Math.max(0, hills - 0.35) * (HILL_HEIGHT / 0.65) * wildness(x, z);
}

/** The ground's height under a point, read off the mesh's own grid so feet sit on what is drawn. */
export function groundY(x: number, z: number): number {
  const gx = Math.floor(x / GRID) * GRID;
  const gz = Math.floor(z / GRID) * GRID;
  const fx = (x - gx) / GRID;
  const fz = (z - gz) / GRID;
  const a = heightAt(gx, gz);
  const b = heightAt(gx + GRID, gz);
  const c = heightAt(gx, gz + GRID);
  const d = heightAt(gx + GRID, gz + GRID);
  return a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) + c * (1 - fx) * fz + d * fx * fz;
}
