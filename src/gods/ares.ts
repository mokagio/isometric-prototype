import { dist, inArc, turnToward, yawTo } from "./bearing";

export const ARES_HP = 16;
/** Ares calls soldiers in each time his health drops past one of these shares. */
export const SUMMON_AT: readonly number[] = [2 / 3, 1 / 3];
export const SUMMON_COUNT = 3;

export const INTRO_TIME = 2.6;
export const STALK_SPEED = 2.6;
/** He walks at you at least this long before trying anything. */
export const STALK_MIN = 1.2;
export const STALK_MAX = 3.5;
export const SWING_RANGE = 3.2;
export const SWING_DAMAGE = 18;
export const WINDUP_TIME = 0.75;
export const SWING_TIME = 0.2;
export const RECOVER_TIME = 0.9;
/** Further than this and he charges rather than walking. */
export const CHARGE_FROM = 7;
export const BRACE_TIME = 1.0;
export const CHARGE_SPEED = 16;
export const CHARGE_MAX = 1.5;
export const CHARGE_DAMAGE = 28;
export const CHARGE_HIT = 1.7;
/** Running into the arena wall leaves him dizzy this long — the opening. */
export const DAZED_TIME = 2.8;
export const SUMMON_TIME = 1.6;
/** His shield covers this much in front of him while he is on guard. */
export const GUARD_ARC = Math.PI * 0.6;
export const BODY = 1.1;
const TURN = 3;

export type AresState =
  | "intro"
  | "stalk"
  | "windup"
  | "swing"
  | "recover"
  | "brace"
  | "charge"
  | "dazed"
  | "summon"
  | "dead";

export interface Ares {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  state: AresState;
  t: number;
  summons: number;
  chargeHit: boolean;
  moving: boolean;
}

export type AresEvent =
  | { kind: "blow"; damage: number; x: number; z: number; heavy: boolean }
  | { kind: "summon"; count: number }
  | { kind: "wall" }
  | { kind: "roar" };

export interface Arena {
  x: number;
  z: number;
  r: number;
}

export function makeAres(x: number, z: number, yaw: number): Ares {
  return { x, z, yaw, hp: ARES_HP, state: "intro", t: 0, summons: 0, chargeHit: false, moving: false };
}

function enter(a: Ares, state: AresState): void {
  a.state = state;
  a.t = 0;
}

/** Whether his health has dropped past the next summon line he has not yet answered. */
export function summonDue(a: Ares): boolean {
  const line = SUMMON_AT[a.summons];
  return line !== undefined && a.hp <= ARES_HP * line && a.hp > 0;
}

/** On guard, his shield faces you and a blow from the front rings off it. */
export function guarding(a: Ares): boolean {
  return a.state === "stalk" || a.state === "windup" || a.state === "brace" || a.state === "intro" || a.state === "summon";
}

export function updateAres(a: Ares, dt: number, hero: { x: number; z: number; alive: boolean }, arena: Arena): AresEvent[] {
  const events: AresEvent[] = [];
  a.t += dt;
  a.moving = false;
  const toHero = dist(a.x, a.z, hero.x, hero.z);
  const face = (rate: number): void => {
    a.yaw = turnToward(a.yaw, yawTo(a.x, a.z, hero.x, hero.z), rate * dt);
  };

  switch (a.state) {
    case "intro":
      face(TURN);
      if (a.t >= INTRO_TIME) {
        events.push({ kind: "roar" });
        enter(a, "stalk");
      }
      break;
    case "stalk":
      if (!hero.alive) break;
      if (summonDue(a)) {
        enter(a, "summon");
        break;
      }
      face(TURN);
      if (toHero > SWING_RANGE * 0.8) {
        a.x += Math.sin(a.yaw) * STALK_SPEED * dt;
        a.z += Math.cos(a.yaw) * STALK_SPEED * dt;
        a.moving = true;
      }
      if (a.t >= STALK_MIN && toHero <= SWING_RANGE) enter(a, "windup");
      else if ((a.t >= STALK_MIN && toHero > CHARGE_FROM) || a.t >= STALK_MAX) enter(a, "brace");
      break;
    case "windup":
      face(TURN * 0.5);
      if (a.t >= WINDUP_TIME) {
        enter(a, "swing");
        if (hero.alive && toHero <= SWING_RANGE + 0.3 && inArc(a.yaw, a.x, a.z, hero.x, hero.z, Math.PI * 0.8)) {
          events.push({ kind: "blow", damage: SWING_DAMAGE, x: a.x, z: a.z, heavy: false });
        }
      }
      break;
    case "swing":
      if (a.t >= SWING_TIME) enter(a, "recover");
      break;
    case "recover":
      if (a.t >= RECOVER_TIME) enter(a, "stalk");
      break;
    case "brace":
      face(TURN * 2);
      if (a.t >= BRACE_TIME) {
        a.chargeHit = false;
        enter(a, "charge");
      }
      break;
    case "charge": {
      a.x += Math.sin(a.yaw) * CHARGE_SPEED * dt;
      a.z += Math.cos(a.yaw) * CHARGE_SPEED * dt;
      a.moving = true;
      if (!a.chargeHit && hero.alive && dist(a.x, a.z, hero.x, hero.z) < CHARGE_HIT) {
        a.chargeHit = true;
        events.push({ kind: "blow", damage: CHARGE_DAMAGE, x: a.x, z: a.z, heavy: true });
      }
      const out = dist(a.x, a.z, arena.x, arena.z);
      const limit = arena.r - BODY - 0.2;
      if (out > limit) {
        const k = limit / out;
        a.x = arena.x + (a.x - arena.x) * k;
        a.z = arena.z + (a.z - arena.z) * k;
        events.push({ kind: "wall" });
        enter(a, "dazed");
      } else if (a.t >= CHARGE_MAX) {
        enter(a, "recover");
      }
      break;
    }
    case "dazed":
      if (a.t >= DAZED_TIME) enter(a, "stalk");
      break;
    case "summon":
      face(TURN);
      if (a.t >= SUMMON_TIME * 0.5 && summonDue(a)) {
        a.summons += 1;
        events.push({ kind: "summon", count: SUMMON_COUNT });
      }
      if (a.t >= SUMMON_TIME) enter(a, "stalk");
      break;
    case "dead":
      break;
  }
  return events;
}

export type AresHit = "none" | "clang" | "hurt" | "dead";

export function strikeAres(a: Ares, power: number, fromX: number, fromZ: number): AresHit {
  if (a.state === "dead") return "none";
  if (guarding(a) && inArc(a.yaw, a.x, a.z, fromX, fromZ, GUARD_ARC)) return "clang";
  a.hp = Math.max(0, a.hp - power);
  if (a.hp === 0) {
    enter(a, "dead");
    return "dead";
  }
  return "hurt";
}
