import { dist } from "./bearing";

/**
 * The volcano west of the city: a cone with one staircase up its eastern side,
 * a crater of lava at the top, and a rock bridge out to an island with a portal
 * to Tartarus in the middle of it. There are no rails: whatever is not the path is a fall.
 */
export const VOLCANO = { x: -125, z: -90, r: 50, h: 30, rim: 12 };
/** Where the stairs stop and the flat landing on the crater's lip begins, measured from the centre. */
export const LANDING_OUT = VOLCANO.rim + 1.5;
export const LANDING_IN = VOLCANO.rim - 1;
export const LANDING_HALF = 2.5;
export const STAIR_HALF = 1.8;
export const BRIDGE_HALF = 1.2;
export const ISLAND_R = 5;
/** Step this close to the island's middle and the portal takes you. */
export const PORTAL_R = 1.2;
export const LAVA_Y = VOLCANO.h - 3;
export const ISLAND_Y = VOLCANO.h - 2;
/** Below this a step off the path is a stumble, put back on the stairs, not a fall. */
export const SAFE_DROP = 1.5;

export type Footing = { y: number; kind: "stair" | "landing" | "bridge" | "island" };

/** How high the cone's outside stands this far from the centre; the stairs climb exactly that slope. */
export function slopeY(d: number): number {
  if (d >= VOLCANO.r) return 0;
  if (d <= LANDING_OUT) return VOLCANO.h;
  return (VOLCANO.h * (VOLCANO.r - d)) / (VOLCANO.r - LANDING_OUT);
}

/** On the volcano at all: anywhere above its foot. */
export function inVolcano(x: number, z: number): boolean {
  return dist(x, z, VOLCANO.x, VOLCANO.z) < VOLCANO.r - 0.5;
}

/** What is underfoot at `(x, z)` on the volcano, or null where there is nothing to stand on. */
export function footing(x: number, z: number): Footing | null {
  const fromCentre = dist(x, z, VOLCANO.x, VOLCANO.z);
  if (fromCentre < ISLAND_R) return { y: ISLAND_Y, kind: "island" };
  // The path runs due east from the centre: along it, and how far off it.
  const d = x - VOLCANO.x;
  const off = Math.abs(z - VOLCANO.z);
  if (d < 0) return null;
  if (d < LANDING_IN && off < BRIDGE_HALF) {
    const k = (d - ISLAND_R) / (LANDING_IN - ISLAND_R);
    return { y: ISLAND_Y + (VOLCANO.h - ISLAND_Y) * Math.max(0, k), kind: "bridge" };
  }
  if (d >= LANDING_IN && d < LANDING_OUT && off < LANDING_HALF) return { y: VOLCANO.h, kind: "landing" };
  if (d >= LANDING_OUT && d <= VOLCANO.r && off < STAIR_HALF) return { y: slopeY(d), kind: "stair" };
  return null;
}

export function atPortal(x: number, z: number): boolean {
  return dist(x, z, VOLCANO.x, VOLCANO.z) < PORTAL_R;
}

/** Where a fall off the path ends: in the lava inside the crater, or on the slope outside it. */
export function landing(x: number, z: number): { y: number; lava: boolean } {
  const d = dist(x, z, VOLCANO.x, VOLCANO.z);
  if (d < VOLCANO.rim) return { y: LAVA_Y, lava: true };
  return { y: slopeY(d), lava: false };
}

/** Put a body that stumbled off the bottom of the stairs back on them. */
export function ontoStairs(x: number, z: number, r: number): { x: number; z: number } {
  const half = STAIR_HALF - r;
  return { x, z: Math.min(VOLCANO.z + half, Math.max(VOLCANO.z - half, z)) };
}
