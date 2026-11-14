import { dist, inArc, turnToward, wrap } from "./bearing";

export const MAX_HP = 100;
export const RUN = 6.2;
/** Behind a raised shield the hero only edges along. */
export const GUARD_SPEED = 2.4;
export const RADIUS = 0.45;
export const TURN = 14;
/** One sword swing, start to finish. */
export const SWING_TIME = 0.42;
/** The moment inside a swing that the blade connects. */
export const SWING_HIT = 0.17;
export const SWING_REACH = 2.4;
export const SWING_ARC = Math.PI * 0.8;
/** After a blow lands on the hero, this long before another can. */
export const HURT_TIME = 0.7;
export const KNOCK = 9;
export const HEAVY_KNOCK = 16;
/** How fast the city heals a hero standing in it, in health a second. */
export const CITY_HEAL = 25;

export interface Hero {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  /** Seconds into the current swing, or -1. */
  swing: number;
  blocking: boolean;
  /** Seconds left before another blow can land. */
  hurt: number;
  vx: number;
  vz: number;
  /** Seconds since falling, or -1 while standing. */
  fallen: number;
  /** Ground speed this frame, which is what the legs animate from. */
  speed: number;
}

export function makeHero(x: number, z: number, yaw: number): Hero {
  return { x, z, yaw, hp: MAX_HP, swing: -1, blocking: false, hurt: 0, vx: 0, vz: 0, fallen: -1, speed: 0 };
}

export function standing(h: Hero): boolean {
  return h.fallen < 0;
}

export function startSwing(h: Hero): boolean {
  if (!standing(h) || h.swing >= 0) return false;
  h.swing = 0;
  return true;
}

export interface HeroInput {
  /** Ground direction, already turned by the camera; length up to 1. */
  move: { x: number; z: number };
  block: boolean;
}

/** Advance the hero; true on the frame the swing connects. */
export function stepHero(h: Hero, dt: number, input: HeroInput): boolean {
  h.hurt = Math.max(0, h.hurt - dt);
  h.x += h.vx * dt;
  h.z += h.vz * dt;
  const drag = Math.exp(-9 * dt);
  h.vx *= drag;
  h.vz *= drag;

  if (!standing(h)) {
    h.fallen += dt;
    h.speed = 0;
    h.blocking = false;
    return false;
  }

  let lands = false;
  if (h.swing >= 0) {
    const before = h.swing;
    h.swing += dt;
    lands = before < SWING_HIT && h.swing >= SWING_HIT;
    if (h.swing >= SWING_TIME) h.swing = -1;
  }
  // You cannot hide behind the shield mid-swing.
  h.blocking = input.block && h.swing < 0;

  const tilt = Math.min(1, Math.hypot(input.move.x, input.move.z));
  const speed = (h.blocking ? GUARD_SPEED : RUN) * tilt * (h.swing >= 0 ? 0.35 : 1);
  if (tilt > 0.01) {
    const heading = Math.atan2(input.move.x, input.move.z);
    // Behind a shield you keep facing the threat and sidestep.
    if (!h.blocking) h.yaw = turnToward(h.yaw, heading, TURN * dt);
    h.x += (input.move.x / tilt) * speed * dt;
    h.z += (input.move.z / tilt) * speed * dt;
  }
  h.speed = tilt > 0.01 ? speed : 0;
  return lands;
}

/** Whether a body at `(tx, tz)` with radius `r` is under the blade of a swing. */
export function underBlade(h: Hero, tx: number, tz: number, r: number): boolean {
  return dist(h.x, h.z, tx, tz) <= SWING_REACH + r && inArc(h.yaw, h.x, h.z, tx, tz, SWING_ARC);
}

export function hurtHero(h: Hero, damage: number, fromX: number, fromZ: number, heavy: boolean): void {
  h.hp = Math.max(0, h.hp - damage);
  h.hurt = HURT_TIME;
  shove(h, fromX, fromZ, heavy ? HEAVY_KNOCK : KNOCK);
  if (h.hp === 0) {
    h.fallen = 0;
    h.swing = -1;
  }
}

export function shove(h: Hero, fromX: number, fromZ: number, power: number): void {
  const away = Math.atan2(h.x - fromX, h.z - fromZ);
  h.vx = Math.sin(away) * power;
  h.vz = Math.cos(away) * power;
}

/** Point the hero at something without walking, e.g. to face a target when swinging. */
export function face(h: Hero, yaw: number): void {
  h.yaw = wrap(yaw);
}
