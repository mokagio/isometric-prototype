/**
 * A circuit is a closed loop of centreline samples a fixed `STEP` apart,
 * grown from a seed, so a track is a number rather than a stored map.
 * Distance along the loop is `s`, running from the start line; `lateral` is
 * metres to the right of the centreline, facing the way the race runs.
 * Headings follow three.js: yaw 0 faces +z, forward is (sin yaw, cos yaw).
 */
export interface Track {
  readonly seed: number;
  readonly length: number;
  readonly width: number;
  readonly xs: Float64Array;
  readonly zs: Float64Array;
}

export interface TrackShape {
  /** Mean distance of the loop from the middle of the map, in metres. */
  radius: number;
  /** How far each corner may push in or out, as a fraction of `radius`. */
  wiggle: number;
  /** Control points round the loop; more is twistier. */
  corners: number;
}

/** Metres between centreline samples. */
export const STEP = 2;
export const ROAD_WIDTH = 13;
/** Metres either side of the road's edge before the barrier stops a kart. */
export const RUNOFF = 7;
/** Lateral distance from the centreline at which the barrier stands. */
export const BARRIER = ROAD_WIDTH / 2 + RUNOFF;

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Grows a loop from `seed`, re-rolling until no stretch of road comes near
 * another stretch's barrier and no corner is too tight to take, so every seed
 * is a track that can be raced.
 */
export function makeTrack(seed: number, shape: TrackShape): Track {
  for (let attempt = 0; ; attempt++) {
    const t = growLoop(seed + attempt * 7919, seed, shape);
    if (raceable(t)) return t;
    if (attempt > 200) throw new Error(`no raceable track near seed ${seed}`);
  }
}

function growLoop(roll: number, seed: number, shape: TrackShape): Track {
  const rand = mulberry(roll);
  const k = shape.corners;
  const stretch = 1.25 + rand() * 0.35;
  const ctrl: Array<[number, number]> = [];
  for (let i = 0; i < k; i++) {
    const a = ((i + (rand() - 0.5) * 0.5) / k) * Math.PI * 2;
    const r = shape.radius * (1 + shape.wiggle * (rand() * 2 - 1));
    ctrl.push([Math.cos(a) * r * stretch, Math.sin(a) * r]);
  }

  // Closed Catmull-Rom through the control points, sampled finely, then
  // re-sampled at even spacing so `s` is plain arithmetic on an index.
  const fine: Array<[number, number]> = [];
  const SUB = 24;
  for (let i = 0; i < k; i++) {
    const p0 = ctrl[(i - 1 + k) % k]!;
    const p1 = ctrl[i]!;
    const p2 = ctrl[(i + 1) % k]!;
    const p3 = ctrl[(i + 2) % k]!;
    for (let j = 0; j < SUB; j++) {
      const t = j / SUB;
      fine.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  const cum = [0];
  for (let i = 1; i <= fine.length; i++) {
    const a = fine[i - 1]!;
    const b = fine[i % fine.length]!;
    cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[fine.length]!;
  const n = Math.round(total / STEP);
  const xs = new Float64Array(n);
  const zs = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const want = (i / n) * total;
    while (cum[j + 1]! < want) j++;
    const f = (want - cum[j]!) / (cum[j + 1]! - cum[j]! || 1);
    const a = fine[j]!;
    const b = fine[(j + 1) % fine.length]!;
    xs[i] = a[0] + (b[0] - a[0]) * f;
    zs[i] = a[1] + (b[1] - a[1]) * f;
  }
  return { seed, length: n * STEP, width: ROAD_WIDTH, xs, zs };
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Tightest a corner may be, as the radius of the turn, in metres. */
export const MIN_TURN_RADIUS = 14;

export function raceable(t: Track): boolean {
  return clearance(t) > 2 * BARRIER + 4 && tightestTurn(t) >= MIN_TURN_RADIUS;
}

/** Closest two stretches of road come, ignoring each sample's own neighbourhood. */
export function clearance(t: Track): number {
  const n = t.xs.length;
  const skip = Math.ceil((BARRIER * 4) / STEP);
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + skip; j < n; j++) {
      if (n - (j - i) < skip) continue;
      const d = (t.xs[i]! - t.xs[j]!) ** 2 + (t.zs[i]! - t.zs[j]!) ** 2;
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
}

/** Radius of the sharpest turn on the loop, measured over a few samples so it is not noise. */
export function tightestTurn(t: Track): number {
  const span = 4;
  let tightest = Infinity;
  for (let i = 0; i < t.xs.length; i++) {
    const turn = Math.abs(angleDiff(headingAt(t, i * STEP), headingAt(t, (i + span) * STEP)));
    if (turn > 1e-6) tightest = Math.min(tightest, (span * STEP) / turn);
  }
  return tightest;
}

export function wrap(t: Track, s: number): number {
  return ((s % t.length) + t.length) % t.length;
}

export interface Place {
  x: number;
  z: number;
  /** Unit vector along the race. */
  tx: number;
  tz: number;
}

export function at(t: Track, s: number): Place {
  const n = t.xs.length;
  const u = wrap(t, s) / STEP;
  const i = Math.floor(u) % n;
  const k = (i + 1) % n;
  const f = u - Math.floor(u);
  const dx = t.xs[k]! - t.xs[i]!;
  const dz = t.zs[k]! - t.zs[i]!;
  const len = Math.hypot(dx, dz) || 1;
  return { x: t.xs[i]! + dx * f, z: t.zs[i]! + dz * f, tx: dx / len, tz: dz / len };
}

/** A point `lateral` metres right of the centreline at `s`. */
export function offset(t: Track, s: number, lateral: number): { x: number; z: number } {
  const p = at(t, s);
  return { x: p.x - p.tz * lateral, z: p.z + p.tx * lateral };
}

export function headingAt(t: Track, s: number): number {
  const p = at(t, s);
  return Math.atan2(p.tx, p.tz);
}

/** Where a point sits on the loop: the nearest `s`, and how far right of the centreline. */
export function locate(t: Track, x: number, z: number): { s: number; lateral: number } {
  const n = t.xs.length;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const d = (t.xs[i]! - x) ** 2 + (t.zs[i]! - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  // Project onto whichever of the two segments touching the nearest sample is closer.
  let s = best * STEP;
  let lateral = 0;
  let closest = Infinity;
  for (const i of [(best - 1 + n) % n, best]) {
    const k = (i + 1) % n;
    const dx = t.xs[k]! - t.xs[i]!;
    const dz = t.zs[k]! - t.zs[i]!;
    const len2 = dx * dx + dz * dz || 1;
    const f = Math.max(0, Math.min(1, ((x - t.xs[i]!) * dx + (z - t.zs[i]!) * dz) / len2));
    const px = t.xs[i]! + dx * f;
    const pz = t.zs[i]! + dz * f;
    const d = (x - px) ** 2 + (z - pz) ** 2;
    if (d < closest) {
      closest = d;
      s = (i + f) * STEP;
      const len = Math.sqrt(len2);
      lateral = ((x - px) * -dz + (z - pz) * dx) / len;
    }
  }
  return { s: wrap(t, s), lateral };
}

/** Signed smallest turn from `a` to `b`, in (-π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** The most the road turns anywhere in the next `ahead` metres, in radians. */
export function bendAhead(t: Track, s: number, ahead: number): number {
  const h0 = headingAt(t, s);
  let most = 0;
  for (let d = STEP * 2; d <= ahead; d += STEP * 2) most = Math.max(most, Math.abs(angleDiff(h0, headingAt(t, s + d))));
  return most;
}
