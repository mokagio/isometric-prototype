import { dist, inArc, turnToward, yawTo } from "./bearing";
import type { Arena } from "./ares";

export const POSEIDON_HP = 18;
/** He floods the arena each time his health drops past one of these shares. */
export const FLOOD_AT: readonly number[] = [2 / 3, 1 / 3];
/** How long the arena stays flooded, rise and drain included. */
export const FLOOD_TIME = 7;
export const FLOOD_RISE = 1.4;
export const FLOOD_DRAIN = 1.2;
/** Hurt per second for anyone caught in the water off the islands. */
export const FLOOD_DAMAGE = 10;

export const INTRO_TIME = 2.6;
export const STALK_SPEED = 2.4;
export const STALK_MIN = 1.2;
export const STALK_MAX = 3.5;
/** The trident is long: his jab reaches further than a sword. */
export const JAB_RANGE = 3.8;
export const JAB_DAMAGE = 16;
export const WINDUP_TIME = 0.7;
export const JAB_TIME = 0.2;
export const RECOVER_TIME = 0.9;
/** Further than this and he throws the trident instead of walking up. */
export const THROW_FROM = 6;
export const AIM_TIME = 1.0;
export const SPEAR_SPEED = 20;
export const SPEAR_HIT = 1.0;
export const SPEAR_DAMAGE = 24;
/** With the trident thrown he has nothing to parry with — the opening. */
export const UNARMED_TIME = 3.2;
/** His trident turns aside blows from in front while he holds it. */
export const GUARD_ARC = Math.PI * 0.6;
export const BODY = 1.1;
const TURN = 3;

export type PoseidonState = "intro" | "stalk" | "windup" | "jab" | "recover" | "aim" | "unarmed" | "flood" | "dead";

export interface Spear {
  x: number;
  z: number;
  yaw: number;
  /** Still in the air; false once it has hit something and stuck. */
  flying: boolean;
}

export interface Poseidon {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  state: PoseidonState;
  t: number;
  floods: number;
  moving: boolean;
  spear: Spear | null;
}

export type PoseidonEvent =
  | { kind: "blow"; damage: number; x: number; z: number; heavy: boolean }
  | { kind: "throw" }
  | { kind: "stuck"; x: number; z: number }
  | { kind: "flood" }
  | { kind: "roar" };

export function makePoseidon(x: number, z: number, yaw: number): Poseidon {
  return { x, z, yaw, hp: POSEIDON_HP, state: "intro", t: 0, floods: 0, moving: false, spear: null };
}

function enter(p: Poseidon, state: PoseidonState): void {
  p.state = state;
  p.t = 0;
}

export function floodDue(p: Poseidon): boolean {
  const line = FLOOD_AT[p.floods];
  return line !== undefined && p.hp <= POSEIDON_HP * line && p.hp > 0;
}

/** How high the water stands, 0 (dry) to 1 (full), from how far into the flood he is. */
export function floodLevel(p: Poseidon): number {
  if (p.state !== "flood") return 0;
  if (p.t < FLOOD_RISE) return p.t / FLOOD_RISE;
  if (p.t > FLOOD_TIME - FLOOD_DRAIN) return Math.max(0, (FLOOD_TIME - p.t) / FLOOD_DRAIN);
  return 1;
}

/** Holding the trident, he parries what comes from in front; while he calls the sea, nothing reaches him. */
export function guarding(p: Poseidon): boolean {
  return p.state === "intro" || p.state === "stalk" || p.state === "windup" || p.state === "aim";
}

export function updatePoseidon(p: Poseidon, dt: number, hero: { x: number; z: number; alive: boolean }, arena: Arena): PoseidonEvent[] {
  const events: PoseidonEvent[] = [];
  p.t += dt;
  p.moving = false;
  const toHero = dist(p.x, p.z, hero.x, hero.z);
  const face = (rate: number): void => {
    p.yaw = turnToward(p.yaw, yawTo(p.x, p.z, hero.x, hero.z), rate * dt);
  };

  const s = p.spear;
  if (s && s.flying) {
    s.x += Math.sin(s.yaw) * SPEAR_SPEED * dt;
    s.z += Math.cos(s.yaw) * SPEAR_SPEED * dt;
    if (hero.alive && dist(s.x, s.z, hero.x, hero.z) < SPEAR_HIT) {
      s.flying = false;
      // The blow comes from where the trident came from, so a shield held toward it stops it.
      events.push({ kind: "blow", damage: SPEAR_DAMAGE, x: s.x - Math.sin(s.yaw) * 2, z: s.z - Math.cos(s.yaw) * 2, heavy: true });
    } else if (dist(s.x, s.z, arena.x, arena.z) > arena.r - 0.6) {
      s.flying = false;
      events.push({ kind: "stuck", x: s.x, z: s.z });
    }
  }

  switch (p.state) {
    case "intro":
      face(TURN);
      if (p.t >= INTRO_TIME) {
        events.push({ kind: "roar" });
        enter(p, "stalk");
      }
      break;
    case "stalk":
      if (!hero.alive) break;
      if (floodDue(p)) {
        enter(p, "flood");
        events.push({ kind: "flood" });
        break;
      }
      face(TURN);
      if (toHero > JAB_RANGE * 0.8) {
        p.x += Math.sin(p.yaw) * STALK_SPEED * dt;
        p.z += Math.cos(p.yaw) * STALK_SPEED * dt;
        p.moving = true;
      }
      if (p.t >= STALK_MIN && toHero <= JAB_RANGE) enter(p, "windup");
      else if ((p.t >= STALK_MIN && toHero > THROW_FROM) || p.t >= STALK_MAX) enter(p, "aim");
      break;
    case "windup":
      face(TURN * 0.5);
      if (p.t >= WINDUP_TIME) {
        enter(p, "jab");
        if (hero.alive && toHero <= JAB_RANGE + 0.3 && inArc(p.yaw, p.x, p.z, hero.x, hero.z, Math.PI * 0.6)) {
          events.push({ kind: "blow", damage: JAB_DAMAGE, x: p.x, z: p.z, heavy: false });
        }
      }
      break;
    case "jab":
      if (p.t >= JAB_TIME) enter(p, "recover");
      break;
    case "recover":
      if (p.t >= RECOVER_TIME) enter(p, "stalk");
      break;
    case "aim":
      face(TURN * 1.5);
      if (p.t >= AIM_TIME) {
        p.spear = { x: p.x + Math.sin(p.yaw) * BODY, z: p.z + Math.cos(p.yaw) * BODY, yaw: p.yaw, flying: true };
        events.push({ kind: "throw" });
        enter(p, "unarmed");
      }
      break;
    case "unarmed":
      if (p.t >= UNARMED_TIME) {
        p.spear = null;
        enter(p, "stalk");
      }
      break;
    case "flood":
      face(TURN * 0.5);
      if (p.t >= FLOOD_TIME) {
        p.floods += 1;
        enter(p, "stalk");
      }
      break;
    case "dead":
      break;
  }
  return events;
}

export type PoseidonHit = "none" | "clang" | "hurt" | "dead";

export function strikePoseidon(p: Poseidon, power: number, fromX: number, fromZ: number): PoseidonHit {
  if (p.state === "dead") return "none";
  if (p.state === "flood") return "clang";
  if (guarding(p) && inArc(p.yaw, p.x, p.z, fromX, fromZ, GUARD_ARC)) return "clang";
  p.hp = Math.max(0, p.hp - power);
  if (p.hp === 0) {
    enter(p, "dead");
    p.spear = null;
    return "dead";
  }
  return "hurt";
}
