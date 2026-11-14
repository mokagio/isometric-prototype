/**
 * Headings on the ground plane. A yaw of 0 faces +z and forward is
 * `(sin yaw, cos yaw)`, which is the direction three.js turns a model's +z to
 * when its `rotation.y` is `yaw` — so a heading here is a rotation there.
 */

export const TAU = Math.PI * 2;

/** The same angle, brought into (-π, π]. */
export function wrap(a: number): number {
  const r = (((a + Math.PI) % TAU) + TAU) % TAU;
  return r - Math.PI;
}

export function yawTo(fx: number, fz: number, tx: number, tz: number): number {
  return Math.atan2(tx - fx, tz - fz);
}

/** Turn `current` toward `target` the short way round, by no more than `step`. */
export function turnToward(current: number, target: number, step: number): number {
  const d = wrap(target - current);
  if (Math.abs(d) <= step) return wrap(target);
  return wrap(current + Math.sign(d) * step);
}

/** Whether `(tx, tz)` lies within `arc` (total, not half) of the heading `yaw` from `(fx, fz)`. */
export function inArc(yaw: number, fx: number, fz: number, tx: number, tz: number, arc: number): boolean {
  return Math.abs(wrap(yawTo(fx, fz, tx, tz) - yaw)) <= arc / 2;
}

export function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(bx - ax, bz - az);
}
