import type { Pos } from "../woods/walker";

/**
 * Chickens pecking about their pen. Each one wanders between spots in it and
 * every so often lays an egg where it stands, which waits on the ground until
 * the kid walks over it.
 */
export const LAY_MIN = 25;
export const LAY_MAX = 45;
export const MAX_EGGS = 6;
export const PICKUP = 7;
export const WANDER_SPEED = 10;

export interface Pen {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Chicken {
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Seconds until it next lays. */
  lay: number;
  /** Seconds left standing still before it wanders on. */
  rest: number;
  facing: "left" | "right";
}

export function makeChicken(pen: Pen, rand: () => number): Chicken {
  const x = pen.x0 + rand() * (pen.x1 - pen.x0);
  const y = pen.y0 + rand() * (pen.y1 - pen.y0);
  return { x, y, tx: x, ty: y, lay: LAY_MIN + rand() * (LAY_MAX - LAY_MIN), rest: rand() * 2, facing: "right" };
}

/** Moves a chicken on; hands back where it laid an egg, if it did. */
export function stepChicken(c: Chicken, dt: number, pen: Pen, eggs: number, rand: () => number = Math.random): Pos | null {
  if (c.rest > 0) c.rest -= dt;
  else {
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) {
      c.rest = 1 + rand() * 3;
      c.tx = pen.x0 + rand() * (pen.x1 - pen.x0);
      c.ty = pen.y0 + rand() * (pen.y1 - pen.y0);
    } else {
      const step = Math.min(d, WANDER_SPEED * dt);
      c.x += (dx / d) * step;
      c.y += (dy / d) * step;
      if (Math.abs(dx) > 0.5) c.facing = dx > 0 ? "right" : "left";
    }
  }
  c.lay -= dt;
  if (c.lay > 0) return null;
  c.lay = LAY_MIN + rand() * (LAY_MAX - LAY_MIN);
  return eggs < MAX_EGGS ? { x: c.x, y: c.y } : null;
}
