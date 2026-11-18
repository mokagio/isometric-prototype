import { angleDiff, offset, type Track } from "./track";

/**
 * What a crystal gives: a turbo to use on yourself, an oil slick to drop
 * behind, or a rocket that hunts the kart in front.
 */
export type Item = "turbo" | "oil" | "rocket";
export const ITEMS: readonly Item[] = ["turbo", "oil", "rocket"];

/**
 * The further back a kart is, the better the draw: the leader mostly gets
 * oil to defend with, the back of the pack mostly turbos and rockets.
 * `place` is 0 for first; `roll` is a uniform number in [0, 1).
 */
export function drawItem(place: number, field: number, roll: number): Item {
  const behind = field > 1 ? place / (field - 1) : 0;
  const oil = 0.6 * (1 - behind);
  const rocket = behind === 0 ? 0 : 0.15 + 0.35 * behind;
  if (roll < oil) return "oil";
  if (roll < oil + rocket) return "rocket";
  return "turbo";
}

export interface Crystal {
  x: number;
  z: number;
  /** Seconds until it grows back; 0 means it is there. */
  wait: number;
}

/** Fractions of a lap where a row of crystals stands across the road. */
export const CRYSTAL_ROWS = [0.22, 0.55, 0.8];
export const PER_ROW = 4;
export const CRYSTAL_REACH = 1.9;
export const REGROW = 3;

export function placeCrystals(t: Track): Crystal[] {
  const out: Crystal[] = [];
  for (const f of CRYSTAL_ROWS) {
    for (let i = 0; i < PER_ROW; i++) {
      const lateral = ((i + 0.5) / PER_ROW - 0.5) * t.width * 0.7;
      const p = offset(t, f * t.length, lateral);
      out.push({ x: p.x, z: p.z, wait: 0 });
    }
  }
  return out;
}

/** The crystal a kart at `(x, z)` drives through, if one is standing within reach. */
export function crystalAt(crystals: Crystal[], x: number, z: number): Crystal | null {
  for (const c of crystals) if (c.wait <= 0 && Math.hypot(c.x - x, c.z - z) < CRYSTAL_REACH) return c;
  return null;
}

export interface Slick {
  x: number;
  z: number;
  life: number;
}
export const SLICK_REACH = 1.7;
export const SLICK_LIFE = 30;
/** How far behind its kart a slick lands. */
export const SLICK_BACK = 3.2;

export interface Rocket {
  x: number;
  z: number;
  yaw: number;
  /** Index of the kart it is hunting. */
  target: number;
  /** Index of the kart that fired it, which it never hits. */
  owner: number;
  life: number;
}
export const ROCKET_SPEED = 42;
export const ROCKET_TURN = 3.2;
export const ROCKET_LIFE = 5;
export const ROCKET_REACH = 1.8;

/** Turns toward its target no faster than `ROCKET_TURN`, and flies on. */
export function stepRocket(r: Rocket, tx: number, tz: number, dt: number): void {
  const want = Math.atan2(tx - r.x, tz - r.z);
  const d = angleDiff(r.yaw, want);
  const most = ROCKET_TURN * dt;
  r.yaw += Math.max(-most, Math.min(most, d));
  r.x += Math.sin(r.yaw) * ROCKET_SPEED * dt;
  r.z += Math.cos(r.yaw) * ROCKET_SPEED * dt;
  r.life -= dt;
}
