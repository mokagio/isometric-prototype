import { dist, inArc, turnToward, yawTo } from "./bearing";

/**
 * Medusa, in a ruined temple deep in the south-west forest. Her gaze turns to
 * stone anyone looking at her when it comes; look away and it passes, or raise
 * a shield toward her and it rebounds — as Perseus did — leaving her stunned,
 * which is the opening.
 */
export const LAIR = { x: -430, z: 420, r: 15 };
export const MEDUSA_HP = 24;
export const INTRO_TIME = 2.4;
export const STALK_SPEED = 2.6;
export const STALK_MIN = 1.2;
export const STALK_MAX = 3.4;
export const SWIPE_RANGE = 3.2;
export const SWIPE_DAMAGE = 16;
export const WINDUP_TIME = 0.6;
export const SWIPE_TIME = 0.2;
export const RECOVER_TIME = 0.8;
/** The warning before the gaze: her eyes glow this long. */
export const GAZE_WINDUP = 1.3;
/** How wide "looking at her" is, either side of straight ahead. */
export const LOOK_ARC = Math.PI * 0.6;
export const STONE_TIME = 2.6;
export const STONE_DAMAGE = 14;
export const STUN_TIME = 3.2;
export const BODY = 1;
const TURN = 3;

export type MedusaState = "intro" | "stalk" | "windup" | "swipe" | "recover" | "glare" | "stunned" | "dead";

export interface Medusa {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  state: MedusaState;
  t: number;
  moving: boolean;
}

export type MedusaEvent =
  | { kind: "blow"; damage: number; x: number; z: number; heavy: boolean }
  | { kind: "glare" }
  | { kind: "gaze" }
  | { kind: "roar" };

export function makeMedusa(x: number, z: number, yaw: number): Medusa {
  return { x, z, yaw, hp: MEDUSA_HP, state: "intro", t: 0, moving: false };
}

function enter(m: Medusa, state: MedusaState): void {
  m.state = state;
  m.t = 0;
}

/** What her gaze does to a hero: rebounds off a shield held toward her, turns to stone a hero looking at her, misses one looking away. */
export function gazeMeets(hero: { x: number; z: number; yaw: number; blocking: boolean }, m: { x: number; z: number }): "reflect" | "stone" | "safe" {
  const looking = inArc(hero.yaw, hero.x, hero.z, m.x, m.z, LOOK_ARC);
  if (!looking) return "safe";
  return hero.blocking ? "reflect" : "stone";
}

export function updateMedusa(m: Medusa, dt: number, hero: { x: number; z: number; alive: boolean }): MedusaEvent[] {
  const events: MedusaEvent[] = [];
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
      if (toHero > SWIPE_RANGE * 0.8) {
        m.x += Math.sin(m.yaw) * STALK_SPEED * dt;
        m.z += Math.cos(m.yaw) * STALK_SPEED * dt;
        m.moving = true;
      }
      if (m.t >= STALK_MIN && toHero <= SWIPE_RANGE) enter(m, "windup");
      else if (m.t >= STALK_MAX) {
        events.push({ kind: "glare" });
        enter(m, "glare");
      }
      break;
    case "windup":
      face(TURN * 0.5);
      if (m.t >= WINDUP_TIME) {
        enter(m, "swipe");
        if (hero.alive && toHero <= SWIPE_RANGE + 0.3 && inArc(m.yaw, m.x, m.z, hero.x, hero.z, Math.PI * 0.7)) {
          events.push({ kind: "blow", damage: SWIPE_DAMAGE, x: m.x, z: m.z, heavy: false });
        }
      }
      break;
    case "swipe":
      if (m.t >= SWIPE_TIME) enter(m, "recover");
      break;
    case "recover":
      if (m.t >= RECOVER_TIME) enter(m, "stalk");
      break;
    case "glare":
      face(TURN);
      if (m.t >= GAZE_WINDUP) {
        events.push({ kind: "gaze" });
        enter(m, "recover");
      }
      break;
    case "stunned":
      if (m.t >= STUN_TIME) enter(m, "stalk");
      break;
    case "dead":
      break;
  }
  return events;
}

/** Her own gaze, turned back on her by a shield. */
export function stun(m: Medusa): void {
  if (m.state !== "dead") enter(m, "stunned");
}

export type MedusaHit = "none" | "hurt" | "dead";

/** Stunned, she takes a blow twice over. */
export function strikeMedusa(m: Medusa, power: number): MedusaHit {
  if (m.state === "dead" || m.state === "intro") return "none";
  m.hp = Math.max(0, m.hp - (m.state === "stunned" ? power * 2 : power));
  if (m.hp === 0) {
    enter(m, "dead");
    return "dead";
  }
  return "hurt";
}
