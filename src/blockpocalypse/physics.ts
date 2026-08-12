import type { World } from "./world";

/**
 * An axis-aligned box that falls and bumps into blocks. `x` is the centre of
 * the box and `y` is its feet, which is the anchor every renderer and every
 * spawn point in the level agrees on.
 */
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  hitWall: boolean;
  hitCeiling: boolean;
}

/** Kept clear of block edges so a box resting on the floor is not inside it. */
export const SKIN = 1e-4;

/** Longest displacement resolved in one pass; anything faster is substepped. */
export const MAX_STEP = 0.4;

export function createBody(x: number, y: number, w: number, h: number): Body {
  return { x, y, vx: 0, vy: 0, w, h, onGround: false, hitWall: false, hitCeiling: false };
}

export function overlapsSolid(
  world: World,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const x0 = Math.floor(x - w / 2 + SKIN);
  const x1 = Math.floor(x + w / 2 - SKIN);
  const y0 = Math.floor(y + SKIN);
  const y1 = Math.floor(y + h - SKIN);
  for (let by = y0; by <= y1; by++) {
    for (let bx = x0; bx <= x1; bx++) {
      if (world.isSolid(bx, by)) return true;
    }
  }
  return false;
}

/**
 * Moves the body by its velocity, stopping it dead against whatever it runs
 * into. Each axis is resolved on its own, so running into a wall at an angle
 * slides along it instead of stopping both directions.
 */
export function moveBody(world: World, body: Body, dt: number): void {
  body.onGround = false;
  body.hitWall = false;
  body.hitCeiling = false;
  moveAxis(world, body, body.vx * dt, true);
  moveAxis(world, body, body.vy * dt, false);
}

function moveAxis(world: World, body: Body, distance: number, horizontal: boolean): void {
  let left = Math.abs(distance);
  const sign = Math.sign(distance);
  if (sign === 0) return;

  while (left > 0) {
    const step = Math.min(left, MAX_STEP) * sign;
    left -= Math.abs(step);
    const nx = horizontal ? body.x + step : body.x;
    const ny = horizontal ? body.y : body.y + step;
    if (!overlapsSolid(world, nx, ny, body.w, body.h)) {
      body.x = nx;
      body.y = ny;
      continue;
    }
    if (horizontal) {
      const edge = sign > 0 ? Math.floor(nx + body.w / 2) : Math.floor(nx - body.w / 2) + 1;
      body.x = sign > 0 ? edge - body.w / 2 - SKIN : edge + body.w / 2 + SKIN;
      body.vx = 0;
      body.hitWall = true;
    } else {
      const edge = sign > 0 ? Math.floor(ny + body.h) : Math.floor(ny) + 1;
      body.y = sign > 0 ? edge - body.h - SKIN : edge + SKIN;
      body.vy = 0;
      if (sign > 0) body.hitCeiling = true;
      else body.onGround = true;
    }
    return;
  }
}

/** How far below the feet `restingOnGround` looks; must clear `SKIN`. */
export const GROUND_PROBE = 0.06;

/** True when there is solid ground within a whisker of the body's feet. */
export function restingOnGround(world: World, body: Body): boolean {
  return overlapsSolid(world, body.x, body.y - GROUND_PROBE, body.w, body.h);
}

/** True when nothing holds up the block just ahead of the body's leading foot. */
export function ledgeAhead(world: World, body: Body, direction: number): boolean {
  const probeX = Math.floor(body.x + (direction * (body.w / 2 + 0.3)));
  const probeY = Math.floor(body.y - 0.5);
  return !world.isSolid(probeX, probeY);
}
