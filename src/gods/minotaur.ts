import { dist, inArc, turnToward, yawTo } from "./bearing";

/**
 * The Minotaur, in the room at the heart of the labyrinth. A great double axe
 * up close, and the bull's charge: he paws the ground, then runs straight at
 * the hero; dodge it and he drives his horns into the wall and is stuck there,
 * which is the opening.
 */
export const MINOTAUR_HP = 24;
export const INTRO_TIME = 2.4;
export const STALK_SPEED = 2.6;
export const STALK_MIN = 1.2;
export const STALK_MAX = 3.0;
export const SWING_RANGE = 3.4;
export const SWING_DAMAGE = 20;
export const WINDUP_TIME = 0.75;
export const SWING_TIME = 0.2;
export const RECOVER_TIME = 0.8;
export const PAW_TIME = 1.1;
export const CHARGE_SPEED = 15;
export const CHARGE_MAX = 1.6;
export const CHARGE_DAMAGE = 26;
export const CHARGE_HIT = 1.6;
export const STUCK_TIME = 3;
export const GUARD_ARC = Math.PI * 0.6;
export const BODY = 1.2;
const TURN = 3;

export type MinotaurState = "intro" | "stalk" | "windup" | "swing" | "recover" | "paw" | "charge" | "stuck" | "dead";

export interface Minotaur {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  state: MinotaurState;
  t: number;
  moving: boolean;
  gored: boolean;
}

export type MinotaurEvent =
  | { kind: "blow"; damage: number; x: number; z: number; heavy: boolean }
  | { kind: "paw" }
  | { kind: "stuck" }
  | { kind: "roar" };

export function makeMinotaur(x: number, z: number, yaw: number): Minotaur {
  return { x, z, yaw, hp: MINOTAUR_HP, state: "intro", t: 0, moving: false, gored: false };
}

function enter(m: Minotaur, state: MinotaurState): void {
  m.state = state;
  m.t = 0;
}

export function guarding(m: Minotaur): boolean {
  return m.state === "intro" || m.state === "stalk" || m.state === "windup" || m.state === "paw";
}

/** `blocked` says whether a point is inside a wall: that is what stops a charge. */
export function updateMinotaur(m: Minotaur, dt: number, hero: { x: number; z: number; alive: boolean }, blocked: (x: number, z: number) => boolean): MinotaurEvent[] {
  const events: MinotaurEvent[] = [];
  m.t += dt;
  m.moving = false;
  const toHero = dist(m.x, m.z, hero.x, hero.z);
  const face = (rate: number): void => {
    m.yaw = turnToward(m.yaw, yawTo(m.x, m.z, hero.x, hero.z), rate * dt);
  };
  switch (m.state) {
    case "intro":
      face(TURN);
      if (m.t >= INTRO_TIME) {
        events.push({ kind: "roar" });
        enter(m, "stalk");
      }
      break;
    case "stalk":
      if (!hero.alive) break;
      face(TURN);
      if (toHero > SWING_RANGE * 0.8) {
        const nx = m.x + Math.sin(m.yaw) * STALK_SPEED * dt;
        const nz = m.z + Math.cos(m.yaw) * STALK_SPEED * dt;
        if (!blocked(nx, nz)) {
          m.x = nx;
          m.z = nz;
          m.moving = true;
        }
      }
      if (m.t >= STALK_MIN && toHero <= SWING_RANGE) enter(m, "windup");
      else if (m.t >= STALK_MAX || (m.t >= STALK_MIN && toHero > 7)) {
        events.push({ kind: "paw" });
        enter(m, "paw");
      }
      break;
    case "windup":
      face(TURN * 0.5);
      if (m.t >= WINDUP_TIME) {
        enter(m, "swing");
        if (hero.alive && toHero <= SWING_RANGE + 0.3 && inArc(m.yaw, m.x, m.z, hero.x, hero.z, Math.PI * 0.7)) {
          events.push({ kind: "blow", damage: SWING_DAMAGE, x: m.x, z: m.z, heavy: true });
        }
      }
      break;
    case "swing":
      if (m.t >= SWING_TIME) enter(m, "recover");
      break;
    case "recover":
      if (m.t >= RECOVER_TIME) enter(m, "stalk");
      break;
    case "paw":
      face(TURN * 2);
      if (m.t >= PAW_TIME) {
        m.gored = false;
        enter(m, "charge");
      }
      break;
    case "charge": {
      const nx = m.x + Math.sin(m.yaw) * CHARGE_SPEED * dt;
      const nz = m.z + Math.cos(m.yaw) * CHARGE_SPEED * dt;
      if (blocked(nx + Math.sin(m.yaw) * BODY, nz + Math.cos(m.yaw) * BODY)) {
        events.push({ kind: "stuck" });
        enter(m, "stuck");
        break;
      }
      m.x = nx;
      m.z = nz;
      m.moving = true;
      if (!m.gored && hero.alive && dist(m.x, m.z, hero.x, hero.z) < CHARGE_HIT) {
        m.gored = true;
        events.push({ kind: "blow", damage: CHARGE_DAMAGE, x: m.x, z: m.z, heavy: true });
      }
      if (m.t >= CHARGE_MAX) enter(m, "recover");
      break;
    }
    case "stuck":
      if (m.t >= STUCK_TIME) enter(m, "stalk");
      break;
    case "dead":
      break;
  }
  return events;
}

export type MinotaurHit = "none" | "clang" | "hurt" | "dead";

export function strikeMinotaur(m: Minotaur, power: number, fromX: number, fromZ: number): MinotaurHit {
  if (m.state === "dead") return "none";
  if (guarding(m) && inArc(m.yaw, m.x, m.z, fromX, fromZ, GUARD_ARC)) return "clang";
  m.hp = Math.max(0, m.hp - power);
  if (m.hp === 0) {
    enter(m, "dead");
    return "dead";
  }
  return "hurt";
}
