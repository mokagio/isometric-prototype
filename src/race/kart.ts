import { angleDiff, at, BARRIER, locate, wrap, type Track } from "./track";

/** How a kart drives; every number is a multiple of the base dial below. */
export interface Stats {
  top: number;
  accel: number;
  turn: number;
}

export interface Kart {
  x: number;
  z: number;
  yaw: number;
  /** Metres a second along `yaw`; negative is reversing. */
  speed: number;
  /** Seconds of turbo left. */
  boost: number;
  /** Seconds of spin-out left; the kart ignores its driver until it stops. */
  spin: number;
  /** Where on the loop it was last frame, for counting laps. */
  s: number;
  lateral: number;
  /** Laps completed; -1 while still behind the start line on the grid. */
  lap: number;
  /** Race time it crossed the line on its final lap, or null. */
  finished: number | null;
  stats: Stats;
}

export interface Drive {
  /** -1 brake or reverse, 1 accelerate. */
  throttle: number;
  /** -1 left, 1 right. */
  steer: number;
}

export const TOP = 24;
export const ACCEL = 13;
export const BRAKE = 28;
export const REVERSE_TOP = 7;
/** Slowing when neither pedal is down, in metres a second per second. */
export const COAST = 5;
/** Off the tarmac a kart tops out at this fraction of its speed. */
export const GRASS = 0.5;
export const TURN = 2.1;
/** Turbo raises the top speed by this much, and holds it there. */
export const BOOST = 1.45;
export const BOOST_TIME = 1.3;
export const SPIN_TIME = 1.1;
export const RADIUS = 1.3;

export function makeKart(x: number, z: number, yaw: number, stats: Stats): Kart {
  return { x, z, yaw, speed: 0, boost: 0, spin: 0, s: 0, lateral: 0, lap: 0, finished: null, stats };
}

export function onRoad(t: Track, k: Kart): boolean {
  return Math.abs(k.lateral) <= t.width / 2;
}

/** Fastest the kart may go here: off the road, or on a turbo, it changes. */
export function topSpeed(t: Track, k: Kart): number {
  const top = TOP * k.stats.top;
  if (k.boost > 0) return top * BOOST;
  return onRoad(t, k) ? top : top * GRASS;
}

export function stepKart(t: Track, k: Kart, drive: Drive, dt: number): void {
  const top = topSpeed(t, k);
  if (k.spin > 0) {
    k.spin = Math.max(0, k.spin - dt);
    k.speed *= Math.exp(-2.5 * dt);
  } else if (k.boost > 0) {
    k.speed = Math.min(top, k.speed + ACCEL * 3 * dt);
  } else if (drive.throttle > 0) {
    k.speed = k.speed < top ? Math.min(top, k.speed + ACCEL * k.stats.accel * drive.throttle * dt) : approach(k.speed, top, BRAKE * dt);
  } else if (drive.throttle < 0) {
    k.speed = Math.max(-REVERSE_TOP, k.speed + (k.speed > 0 ? BRAKE : ACCEL) * drive.throttle * dt);
  } else {
    k.speed = approach(k.speed, 0, COAST * dt);
  }
  // Running onto the grass at speed slows the kart down to what grass allows.
  if (k.speed > top && k.boost <= 0) k.speed = approach(k.speed, top, BRAKE * dt);
  k.boost = Math.max(0, k.boost - dt);

  if (k.spin <= 0) {
    // No grip without rolling, and a little less at full tilt so a corner needs lifting for.
    const grip = Math.min(1, Math.abs(k.speed) / 6) * (1 - 0.3 * Math.min(1, Math.abs(k.speed) / (TOP * BOOST)));
    k.yaw += drive.steer * TURN * k.stats.turn * grip * Math.sign(k.speed) * dt;
  }
  k.x += Math.sin(k.yaw) * k.speed * dt;
  k.z += Math.cos(k.yaw) * k.speed * dt;
  track(t, k);
}

/**
 * Re-reads where the kart is on the loop, counts a lap whenever it crosses
 * the line, and keeps it inside the barrier.
 */
export function track(t: Track, k: Kart): void {
  const before = k.s;
  let here = locate(t, k.x, k.z);
  if (Math.abs(here.lateral) > BARRIER) {
    const side = Math.sign(here.lateral);
    const p = at(t, here.s);
    k.x = p.x - p.tz * BARRIER * side;
    k.z = p.z + p.tx * BARRIER * side;
    // Scraping along the wall bleeds speed, and nudges the nose back along the road.
    k.speed *= 0.96;
    const along = Math.atan2(p.tx, p.tz) + (k.speed < 0 ? Math.PI : 0);
    k.yaw += angleDiff(k.yaw, along) * 0.08;
    here = { s: here.s, lateral: BARRIER * side };
  }
  k.s = here.s;
  k.lateral = here.lateral;
  k.lap += lapsCrossed(t, before, k.s);
}

/** +1 for crossing the line forwards, -1 for backing over it. */
export function lapsCrossed(t: Track, before: number, after: number): number {
  const q = t.length / 4;
  if (before > t.length - q && after < q) return 1;
  if (before < q && after > t.length - q) return -1;
  return 0;
}

/** Distance raced, the one number positions are ordered by. */
export function progress(t: Track, k: Kart): number {
  return k.lap * t.length + wrap(t, k.s);
}

export function spinOut(k: Kart): void {
  k.spin = SPIN_TIME;
  k.boost = 0;
}

export function turbo(k: Kart): void {
  k.boost = BOOST_TIME;
}

/** Pushes two karts apart; the one hit from behind gets a little of the other's speed. */
export function bump(a: Kart, b: Kart): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const reach = RADIUS * 2;
  if (d >= reach || d === 0) return false;
  const push = (reach - d) / 2;
  const nx = dx / d;
  const nz = dz / d;
  a.x -= nx * push;
  a.z -= nz * push;
  b.x += nx * push;
  b.z += nz * push;
  const share = (a.speed - b.speed) * 0.25;
  a.speed -= share;
  b.speed += share;
  return true;
}

function approach(v: number, target: number, by: number): number {
  return v < target ? Math.min(target, v + by) : Math.max(target, v - by);
}
