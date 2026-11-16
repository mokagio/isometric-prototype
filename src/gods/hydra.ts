import { dist, turnToward, yawTo } from "./bearing";

/**
 * Hydra's Peak, out in the north-east: a rocky mountain with one staircase
 * winding round it to a flat top, and the Hydra in a pool up there. Like the
 * other mountains, whatever is not the stairs or the top is a fall.
 *
 * The stairs are a ledge cut into the cone: at a fraction `u` of the way up they
 * are `PEAK.h * u` high and `ledgeRadius(u)` from the middle, which is exactly on
 * the slope, `TURNS` times round from where they start, facing the city.
 */
export const PEAK = { x: 420, z: -420, r: 58, h: 36, top: 17 };
export const TURNS = 1.5;
/** Where the stairs start, as a bearing from the middle: toward the city. */
export const START_ANGLE = Math.atan2(-PEAK.x, -PEAK.z);
export const LEDGE_HALF = 2;
/** Steps along the whole climb; each one's top is level, so feet sit on it. */
export const STEPS = 240;

export const ledgeRadius = (u: number): number => PEAK.r - (PEAK.r - PEAK.top) * u;

/**
 * How far the rock is cut down below the stairs. The ledge is `LEDGE_HALF * 2` wide
 * and the slope rises across it, so without this the rock would stand over the
 * inner half of every step and swallow the legs of anyone climbing.
 */
export const SINK = 2.2;

/** How high the mountain's rock side is this far from the middle: just under the stairs. */
export function peakSlope(d: number): number {
  if (d <= PEAK.top) return PEAK.h;
  return Math.max(0, (PEAK.h * (PEAK.r - d)) / (PEAK.r - PEAK.top) - SINK);
}

export function onPeak(x: number, z: number): boolean {
  return dist(x, z, PEAK.x, PEAK.z) < PEAK.r - 0.5;
}

/** A point `u` of the way up the stairs. */
export function ledgeAt(u: number): { x: number; z: number; y: number } {
  const a = START_ANGLE + u * TURNS * Math.PI * 2;
  const r = ledgeRadius(u);
  return { x: PEAK.x + Math.sin(a) * r, z: PEAK.z + Math.cos(a) * r, y: Math.floor(u * STEPS) * (PEAK.h / STEPS) };
}

/** How high the ground is on the mountain, or null off the stairs and the top. */
export function peakFooting(x: number, z: number): number | null {
  const d = dist(x, z, PEAK.x, PEAK.z);
  if (d < PEAK.top) return PEAK.h;
  const a = Math.atan2(x - PEAK.x, z - PEAK.z);
  // The stairs pass this bearing once a turn; find a pass at this distance out.
  for (let k = -1; k <= Math.ceil(TURNS) + 1; k++) {
    const u = (a + k * Math.PI * 2 - START_ANGLE) / (TURNS * Math.PI * 2);
    if (u < 0 || u > 1) continue;
    if (Math.abs(d - ledgeRadius(u)) < LEDGE_HALF) return Math.floor(u * STEPS) * (PEAK.h / STEPS);
  }
  return null;
}

// The Hydra -------------------------------------------------------------------

export const HEAD_HP = 3;
export const BODY_HP = 12;
export const MAX_HEADS = 6;
/** A cut neck grows back as two this long after, unless the body is struck first. */
export const REGROW_TIME = 5;
export const REAR_TIME = 0.8;
export const BITE_TIME = 0.25;
export const RECOVER_TIME = 0.9;
export const BITE_REACH = 7.5;
export const BITE_DAMAGE = 16;
/** How close to the hero a bite has to land to hurt. */
export const BITE_HIT = 1.6;
/** How far out from the body the heads hang, and where a blow has to land to cut one. */
export const NECK = 3.2;
export const BODY = 2;
const TURN = 2;

export type HeadState = "idle" | "rear" | "bite" | "recover";

export interface Head {
  /** Where it hangs round the body, as a bearing offset from where the Hydra faces. */
  offset: number;
  hp: number;
  state: HeadState;
  t: number;
  /** Where it aimed its bite. */
  aimX: number;
  aimZ: number;
}

export interface Stump {
  offset: number;
  t: number;
}

export interface Hydra {
  x: number;
  z: number;
  yaw: number;
  heads: Head[];
  stumps: Stump[];
  body: number;
  intro: number;
  dead: number;
  /** Seconds until the next head may rear. */
  cooldown: number;
}

export type HydraEvent =
  | { kind: "blow"; damage: number; x: number; z: number; heavy: boolean }
  | { kind: "regrow"; heads: number }
  | { kind: "sealed" }
  | { kind: "exposed" }
  | { kind: "roar" };

const head = (offset: number): Head => ({ offset, hp: HEAD_HP, state: "idle", t: 0, aimX: 0, aimZ: 0 });

export function makeHydra(x: number, z: number, yaw: number): Hydra {
  return { x, z, yaw, heads: [-0.6, 0, 0.6].map(head), stumps: [], body: BODY_HP, intro: 2.4, dead: -1, cooldown: 1 };
}

/** Where a head is: out from the body toward its bearing, and lunged at its aim while biting. */
export function headAt(h: Hydra, hd: { offset: number; state?: HeadState; t?: number; aimX?: number; aimZ?: number }): { x: number; z: number } {
  const a = h.yaw + hd.offset;
  const rest = { x: h.x + Math.sin(a) * NECK, z: h.z + Math.cos(a) * NECK };
  if (hd.state === "bite" && hd.aimX !== undefined && hd.aimZ !== undefined) {
    const k = Math.min(1, (hd.t ?? 0) / BITE_TIME);
    return { x: rest.x + (hd.aimX - rest.x) * k, z: rest.z + (hd.aimZ - rest.z) * k };
  }
  return rest;
}

export function updateHydra(h: Hydra, dt: number, hero: { x: number; z: number; alive: boolean }): HydraEvent[] {
  const events: HydraEvent[] = [];
  if (h.dead >= 0) {
    h.dead += dt;
    return events;
  }
  if (h.intro > 0) {
    h.intro -= dt;
    if (h.intro <= 0) events.push({ kind: "roar" });
    return events;
  }
  h.yaw = turnToward(h.yaw, yawTo(h.x, h.z, hero.x, hero.z), TURN * dt);
  h.cooldown = Math.max(0, h.cooldown - dt);

  for (const s of h.stumps) s.t += dt;
  const grown = h.stumps.filter((s) => s.t >= REGROW_TIME);
  if (grown.length > 0) {
    h.stumps = h.stumps.filter((s) => s.t < REGROW_TIME);
    for (const s of grown) {
      for (const side of [-0.25, 0.25]) if (h.heads.length < MAX_HEADS) h.heads.push(head(s.offset + side));
    }
    events.push({ kind: "regrow", heads: h.heads.length });
  }

  const toHero = dist(h.x, h.z, hero.x, hero.z);
  for (const hd of h.heads) {
    hd.t += dt;
    if (hd.state === "idle") {
      // One head at a time rears to bite a hero in reach.
      if (hero.alive && toHero < BITE_REACH && h.cooldown === 0) {
        hd.state = "rear";
        hd.t = 0;
        hd.aimX = hero.x;
        hd.aimZ = hero.z;
        h.cooldown = REAR_TIME + 0.4;
      }
    } else if (hd.state === "rear") {
      if (hd.t >= REAR_TIME) {
        hd.state = "bite";
        hd.t = 0;
      }
    } else if (hd.state === "bite") {
      if (hd.t >= BITE_TIME) {
        if (hero.alive && dist(hd.aimX, hd.aimZ, hero.x, hero.z) < BITE_HIT) {
          const from = headAt(h, { offset: hd.offset });
          events.push({ kind: "blow", damage: BITE_DAMAGE, x: from.x, z: from.z, heavy: false });
        }
        hd.state = "recover";
        hd.t = 0;
      }
    } else if (hd.t >= RECOVER_TIME) {
      hd.state = "idle";
      hd.t = 0;
    }
  }
  return events;
}

export type HydraHit = "none" | "head" | "cut" | "sealed" | "body" | "dead";

/** A blow at a head (by index) or, with `head` null, at the body. */
export function strikeHydra(h: Hydra, power: number, target: number | null): HydraHit {
  if (h.dead >= 0 || h.intro > 0) return "none";
  if (target !== null) {
    const hd = h.heads[target];
    if (!hd) return "none";
    hd.hp -= power;
    if (hd.hp > 0) return "head";
    h.heads.splice(target, 1);
    h.stumps.push({ offset: hd.offset, t: 0 });
    return "cut";
  }
  // The body: a blow seals any cut neck, and once no head is left it hurts.
  if (h.stumps.length > 0) {
    h.stumps = [];
    return "sealed";
  }
  if (h.heads.length > 0) return "none";
  h.body = Math.max(0, h.body - power);
  if (h.body === 0) {
    h.dead = 0;
    return "dead";
  }
  return "body";
}
