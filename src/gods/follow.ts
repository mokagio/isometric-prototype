import { turnToward, wrap, yawTo } from "./bearing";

/**
 * The camera rides behind the hero at `camYaw`: it looks along that heading,
 * from `CAM_DIST` back. Everything the stick does is relative to it.
 */
export const CAM_DIST = 7.5;
export const CAM_HEIGHT = 3.6;
export const LOOK_HEIGHT = 1.5;
/** How fast pushing the stick sideways swings the camera round after you, in radians a second. */
export const AUTO_TURN = 1.4;
/** Radians per pixel of a camera drag. */
export const DRAG_TURN = 0.009;
/** How fast the camera swings to keep the god in view, in radians a second. */
export const LOCK_TURN = 2.2;

/**
 * Stick to ground: up is the way the camera faces, right is its right.
 * `sy` is screen-down, so pushing up is negative.
 */
export function moveFromStick(sx: number, sy: number, camYaw: number): { x: number; z: number } {
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  // Right of a +z heading, with y up, is -x.
  const rx = -fz;
  const rz = fx;
  return { x: fx * -sy + rx * sx, z: fz * -sy + rz * sx };
}

/**
 * Walking sideways drags the camera round after you, the way a thumb on a
 * phone has no spare finger to do it. Straight ahead or back leaves it be.
 */
export function autoTurn(camYaw: number, sx: number, dt: number): number {
  return wrap(camYaw - sx * AUTO_TURN * dt);
}

/** Dragging right turns the view right. */
export function dragTurn(camYaw: number, dx: number): number {
  return wrap(camYaw - dx * DRAG_TURN);
}

/** In a fight the camera keeps the god in front of you without being asked. */
export function lockOn(camYaw: number, hero: { x: number; z: number }, foe: { x: number; z: number }, dt: number): number {
  return turnToward(camYaw, yawTo(hero.x, hero.z, foe.x, foe.z), LOCK_TURN * dt);
}

/**
 * A thumb's drag from where it landed, as a stick reading inside the unit
 * circle. Inside the dead zone reads as centred, and past `radius` is full tilt.
 */
export function stickFrom(dx: number, dy: number, radius: number, dead = 0.15): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (len < radius * dead) return { x: 0, y: 0 };
  const k = Math.min(len, radius) / radius / len;
  return { x: dx * k, y: dy * k };
}
