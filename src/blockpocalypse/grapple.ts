import type { World } from "./world";

export interface RayHit {
  /** Where the ray met the block face. */
  x: number;
  y: number;
  /** The block it stopped in. */
  bx: number;
  by: number;
  distance: number;
}

/**
 * Walks the grid a cell at a time along a ray (Amanatides & Woo) and reports
 * the first solid block. Everything that has to ask "what is over there" —
 * the hook, a bullet, a zombie's line of sight — goes through this rather
 * than sampling points and hoping not to skip a block.
 */
export function raycast(
  world: World,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDistance: number,
): RayHit | null {
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const ux = dx / length;
  const uy = dy / length;

  let bx = Math.floor(ox);
  let by = Math.floor(oy);
  const stepX = ux > 0 ? 1 : -1;
  const stepY = uy > 0 ? 1 : -1;
  // Distance along the ray between successive grid lines on each axis.
  const deltaX = ux === 0 ? Infinity : Math.abs(1 / ux);
  const deltaY = uy === 0 ? Infinity : Math.abs(1 / uy);
  let sideX = ux === 0 ? Infinity : (ux > 0 ? bx + 1 - ox : ox - bx) * deltaX;
  let sideY = uy === 0 ? Infinity : (uy > 0 ? by + 1 - oy : oy - by) * deltaY;

  if (world.isSolid(bx, by)) {
    return { x: ox, y: oy, bx, by, distance: 0 };
  }

  let travelled = 0;
  while (travelled <= maxDistance) {
    if (sideX < sideY) {
      travelled = sideX;
      sideX += deltaX;
      bx += stepX;
    } else {
      travelled = sideY;
      sideY += deltaY;
      by += stepY;
    }
    if (travelled > maxDistance) return null;
    if (world.isSolid(bx, by)) {
      return { x: ox + ux * travelled, y: oy + uy * travelled, bx, by, distance: travelled };
    }
  }
  return null;
}

export interface Rope {
  anchorX: number;
  anchorY: number;
  /** The block the hook bit into, so the rope drops if it is shot away. */
  bx: number;
  by: number;
  length: number;
}

export const ROPE_MIN = 1.6;
export const ROPE_REEL_SPEED = 9;

/**
 * Holds a point at rope's length from the anchor. Returns where it should be
 * and what is left of its velocity: the part pulling away along the rope is
 * spent on the rope, and only the sideways part survives — which is what
 * turns a fall into a swing.
 */
export function applyRope(
  rope: Rope,
  x: number,
  y: number,
  vx: number,
  vy: number,
): { x: number; y: number; vx: number; vy: number; taut: boolean } {
  const dx = x - rope.anchorX;
  const dy = y - rope.anchorY;
  const distance = Math.hypot(dx, dy);
  if (distance <= rope.length || distance === 0) return { x, y, vx, vy, taut: false };

  const nx = dx / distance;
  const ny = dy / distance;
  const outward = vx * nx + vy * ny;
  return {
    x: rope.anchorX + nx * rope.length,
    y: rope.anchorY + ny * rope.length,
    vx: outward > 0 ? vx - outward * nx : vx,
    vy: outward > 0 ? vy - outward * ny : vy,
    taut: true,
  };
}
