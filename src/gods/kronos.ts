import { dist, inArc, turnToward, yawTo } from "./bearing";

/**
 * Kronos, Titan of time, shut behind the monument's door on Olympia. The door
 * opens when the hero reaches the top; he walks out and fights on the square.
 * His scythe sweeps all the way round, and his trick is time: he slows the
 * hero right down, and is worn out afterwards.
 */
export const KRONOS_HP = 26;
/** Walking out of the door, before the fight starts. */
export const EMERGE_TIME = 1.4;
export const EMERGE_SPEED = 3.6;
export const STALK_SPEED = 2.6;
export const STALK_MIN = 1.0;
export const STALK_MAX = 3.6;
/** The scythe reaches all the way round him. */
export const SWEEP_RANGE = 4.2;
export const SWEEP_DAMAGE = 22;
export const WINDUP_TIME = 0.8;
export const SWEEP_TIME = 0.3;
export const RECOVER_TIME = 0.8;
/** Casting the slow, how long the hero stays slowed, and how slowly the hero's world runs meanwhile. */
export const CAST_TIME = 1.0;
export const SLOW_TIME = 4;
export const SLOW = 0.35;
/** While the hero is slowed he winds up faster. */
export const FAST_WINDUP = 0.4;
/** After the slow wears off he is worn out this long — the opening. */
export const TIRED_TIME = 2.6;
export const GUARD_ARC = Math.PI * 0.6;
export const BODY = 1.2;
const TURN = 3;

export type KronosState = "emerge" | "stalk" | "windup" | "sweep" | "recover" | "cast" | "tired" | "dead";

export interface Kronos {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  state: KronosState;
  t: number;
  /** How much longer the hero is slowed, in seconds. */
  slow: number;
  moving: boolean;
}

export type KronosEvent =
  | { kind: "blow"; damage: number; x: number; z: number; heavy: boolean }
  | { kind: "roar" }
  | { kind: "slow" }
  | { kind: "tired" };

export function makeKronos(x: number, z: number, yaw: number): Kronos {
  return { x, z, yaw, hp: KRONOS_HP, state: "emerge", t: 0, slow: 0, moving: false };
}

function enter(k: Kronos, state: KronosState): void {
  k.state = state;
  k.t = 0;
}

export function guarding(k: Kronos): boolean {
  return k.state === "emerge" || k.state === "stalk" || k.state === "windup" || k.state === "cast";
}

export function updateKronos(k: Kronos, dt: number, hero: { x: number; z: number; alive: boolean }): KronosEvent[] {
  const events: KronosEvent[] = [];
  k.t += dt;
  k.moving = false;
  const wasSlow = k.slow > 0;
  k.slow = Math.max(0, k.slow - dt);
  const toHero = dist(k.x, k.z, hero.x, hero.z);
  const face = (rate: number): void => {
    k.yaw = turnToward(k.yaw, yawTo(k.x, k.z, hero.x, hero.z), rate * dt);
  };
  if (wasSlow && k.slow === 0 && k.state !== "dead") {
    events.push({ kind: "tired" });
    enter(k, "tired");
  }

  switch (k.state) {
    case "emerge":
      // Straight out of the door, along the way he faces.
      k.x += Math.sin(k.yaw) * EMERGE_SPEED * dt;
      k.z += Math.cos(k.yaw) * EMERGE_SPEED * dt;
      k.moving = true;
      if (k.t >= EMERGE_TIME) {
        events.push({ kind: "roar" });
        enter(k, "stalk");
      }
      break;
    case "stalk":
      if (!hero.alive) break;
      face(TURN);
      if (toHero > SWEEP_RANGE * 0.7) {
        k.x += Math.sin(k.yaw) * STALK_SPEED * dt * (k.slow > 0 ? 1.4 : 1);
        k.z += Math.cos(k.yaw) * STALK_SPEED * dt * (k.slow > 0 ? 1.4 : 1);
        k.moving = true;
      }
      if (k.t >= STALK_MIN && toHero <= SWEEP_RANGE) enter(k, "windup");
      else if (k.t >= STALK_MAX && k.slow === 0) enter(k, "cast");
      break;
    case "windup":
      face(TURN * 0.5);
      if (k.t >= (k.slow > 0 ? FAST_WINDUP : WINDUP_TIME)) {
        enter(k, "sweep");
        if (hero.alive && toHero <= SWEEP_RANGE + 0.3) events.push({ kind: "blow", damage: SWEEP_DAMAGE, x: k.x, z: k.z, heavy: true });
      }
      break;
    case "sweep":
      if (k.t >= SWEEP_TIME) enter(k, "recover");
      break;
    case "recover":
      if (k.t >= RECOVER_TIME * (k.slow > 0 ? 0.5 : 1)) enter(k, "stalk");
      break;
    case "cast":
      face(TURN);
      if (k.t >= CAST_TIME) {
        k.slow = SLOW_TIME;
        events.push({ kind: "slow" });
        enter(k, "stalk");
      }
      break;
    case "tired":
      if (k.t >= TIRED_TIME) enter(k, "stalk");
      break;
    case "dead":
      break;
  }
  return events;
}

export type KronosHit = "none" | "clang" | "hurt" | "dead";

export function strikeKronos(k: Kronos, power: number, fromX: number, fromZ: number): KronosHit {
  if (k.state === "dead") return "none";
  if (guarding(k) && inArc(k.yaw, k.x, k.z, fromX, fromZ, GUARD_ARC)) return "clang";
  k.hp = Math.max(0, k.hp - power);
  if (k.hp === 0) {
    enter(k, "dead");
    k.slow = 0;
    return "dead";
  }
  return "hurt";
}
