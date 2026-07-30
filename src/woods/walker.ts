import type { Axis } from "../input";

// Whispering Woods is drawn straight down the screen, not on an isometric grid,
// so the walker works in pixels. The keys and the stick both speak the grid axes
// the iso game uses, and `screenAxis` is the one place that converts.

export const SPEED = 90; // pixels a second, before the sprite zoom

export type Facing = "left" | "right";

export interface Pos {
  x: number;
  y: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/**
 * Steering direction in screen pixels, at unit length — `{x: 0, y: 0}` when still.
 *
 * Screen-x runs with `dc - dr` and screen-y with `dc + dr`, the same relation
 * `iso.ts` projects with. Both are then divided by the vector's own length, so
 * holding two keys does not walk 1.4x faster than holding one.
 */
export function screenAxis(axis: Axis): Pos {
  const x = axis.dc - axis.dr;
  const y = axis.dc + axis.dr;
  const len = Math.hypot(x, y);
  return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
}

/** Where the walker is `dt` later, kept inside `bounds`. */
export function walk(pos: Pos, axis: Axis, dt: number, bounds: Bounds): Pos {
  const dir = screenAxis(axis);
  return {
    x: clamp(pos.x + dir.x * SPEED * dt, bounds.minX, bounds.maxX),
    y: clamp(pos.y + dir.y * SPEED * dt, bounds.minY, bounds.maxY),
  };
}

/**
 * Which way to face, given screen-x travel.
 *
 * The pack draws one facing, so left is that facing mirrored. Walking straight
 * up or down keeps whichever way you last went across the screen, rather than
 * snapping to a default the player did not ask for.
 */
export function facingFrom(x: number, facing: Facing): Facing {
  if (x > 0) return "right";
  if (x < 0) return "left";
  return facing;
}
