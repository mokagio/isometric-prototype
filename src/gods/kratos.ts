import { dist, inArc, turnToward, yawTo } from "./bearing";

/**
 * Kratos, god of strength, in his iron colosseum in the rocky south-east.
 * Huge slow punches up close, boulders thrown at a hero who keeps away, and the
 * ground slam: a shockwave ring that rolls out across the sand. The opening is
 * the slam itself, which leaves his fist stuck in the ground.
 */
export const KRATOS = { x: 380, z: 430, r: 18, thick: 3.5, yaw: -Math.PI * 0.75 };
export const KRATOS_HP = 26;
export const INTRO_TIME = 2.8;
export const STALK_SPEED = 2.4;
export const STALK_MIN = 1.2;
export const STALK_MAX = 3.6;
export const PUNCH_RANGE = 3.4;
export const PUNCH_DAMAGE = 26;
export const WINDUP_TIME = 0.9;
export const PUNCH_TIME = 0.2;
export const RECOVER_TIME = 0.8;
export const THROW_FROM = 8;
export const LIFT_TIME = 1.0;
export const BOULDER_SPEED = 16;
export const BOULDER_HIT = 1.4;
export const BOULDER_DAMAGE = 22;
/** The slam: wind up, then a ring that rolls out from him to this far, this fast. */
export const SLAM_WINDUP = 1.1;
export const WAVE_SPEED = 9;
export const WAVE_REACH = 14;
/** How thick the ring is: a hero inside that band as it passes is thrown. */
export const WAVE_BAND = 1.2;
export const WAVE_DAMAGE = 20;
export const STUCK_TIME = 2.6;
export const GUARD_ARC = Math.PI * 0.6;
export const BODY = 1.2;
const TURN = 2.6;

export type KratosState = "intro" | "stalk" | "windup" | "punch" | "recover" | "lift" | "slamWindup" | "stuck" | "dead";

export interface Boulder {
  x: number;
  z: number;
  yaw: number;
  t: number;
}

export interface Kratos {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  state: KratosState;
  t: number;
  tricks: number;
  moving: boolean;
  boulder: Boulder | null;
  /** The shockwave rolling out, by how far it has got; -1 when there is none. */
  wave: number;
  waveX: number;
  waveZ: number;
  waveHit: boolean;
}

export type KratosEvent =
  | { kind: "blow"; damage: number; x: number; z: number; heavy: boolean }
  | { kind: "slam"; x: number; z: number }
  | { kind: "throw" }
  | { kind: "roar" };

export function makeKratos(x: number, z: number, yaw: number): Kratos {
  return { x, z, yaw, hp: KRATOS_HP, state: "intro", t: 0, tricks: 0, moving: false, boulder: null, wave: -1, waveX: x, waveZ: z, waveHit: false };
}

function enter(k: Kratos, state: KratosState): void {
  k.state = state;
  k.t = 0;
}

export function guarding(k: Kratos): boolean {
  return k.state === "intro" || k.state === "stalk" || k.state === "windup" || k.state === "lift" || k.state === "slamWindup";
}

export function updateKratos(k: Kratos, dt: number, hero: { x: number; z: number; alive: boolean }, arena: { x: number; z: number; r: number }): KratosEvent[] {
  const events: KratosEvent[] = [];
  k.t += dt;
  k.moving = false;
  const toHero = dist(k.x, k.z, hero.x, hero.z);
  const face = (rate: number): void => {
    k.yaw = turnToward(k.yaw, yawTo(k.x, k.z, hero.x, hero.z), rate * dt);
  };

  if (k.wave >= 0) {
    k.wave += WAVE_SPEED * dt;
    const fromWave = dist(k.waveX, k.waveZ, hero.x, hero.z);
    if (!k.waveHit && hero.alive && Math.abs(fromWave - k.wave) < WAVE_BAND) {
      k.waveHit = true;
      events.push({ kind: "blow", damage: WAVE_DAMAGE, x: k.waveX, z: k.waveZ, heavy: true });
    }
    if (k.wave > WAVE_REACH) k.wave = -1;
  }
  const b = k.boulder;
  if (b) {
    b.t += dt;
    b.x += Math.sin(b.yaw) * BOULDER_SPEED * dt;
    b.z += Math.cos(b.yaw) * BOULDER_SPEED * dt;
    if (hero.alive && dist(b.x, b.z, hero.x, hero.z) < BOULDER_HIT) {
      events.push({ kind: "blow", damage: BOULDER_DAMAGE, x: b.x - Math.sin(b.yaw) * 2, z: b.z - Math.cos(b.yaw) * 2, heavy: true });
      k.boulder = null;
    } else if (dist(b.x, b.z, arena.x, arena.z) > arena.r) k.boulder = null;
  }

  switch (k.state) {
    case "intro":
      face(TURN);
      if (k.t >= INTRO_TIME) {
        events.push({ kind: "roar" });
        enter(k, "stalk");
      }
      break;
    case "stalk":
      if (!hero.alive) break;
      face(TURN);
      if (toHero > PUNCH_RANGE * 0.8) {
        k.x += Math.sin(k.yaw) * STALK_SPEED * dt;
        k.z += Math.cos(k.yaw) * STALK_SPEED * dt;
        k.moving = true;
      }
      if (k.t >= STALK_MIN && toHero <= PUNCH_RANGE) enter(k, "windup");
      else if (k.t >= STALK_MIN && toHero > THROW_FROM && !k.boulder) enter(k, "lift");
      else if (k.t >= STALK_MAX) enter(k, "slamWindup");
      break;
    case "windup":
      face(TURN * 0.5);
      if (k.t >= WINDUP_TIME) {
        enter(k, "punch");
        if (hero.alive && toHero <= PUNCH_RANGE + 0.3 && inArc(k.yaw, k.x, k.z, hero.x, hero.z, Math.PI * 0.7)) {
          events.push({ kind: "blow", damage: PUNCH_DAMAGE, x: k.x, z: k.z, heavy: true });
        }
      }
      break;
    case "punch":
      if (k.t >= PUNCH_TIME) enter(k, "recover");
      break;
    case "recover":
      if (k.t >= RECOVER_TIME) enter(k, "stalk");
      break;
    case "lift":
      face(TURN);
      if (k.t >= LIFT_TIME) {
        k.boulder = { x: k.x + Math.sin(k.yaw) * BODY * 1.5, z: k.z + Math.cos(k.yaw) * BODY * 1.5, yaw: k.yaw, t: 0 };
        events.push({ kind: "throw" });
        enter(k, "recover");
      }
      break;
    case "slamWindup":
      if (k.t >= SLAM_WINDUP) {
        k.wave = 0;
        k.waveX = k.x;
        k.waveZ = k.z;
        k.waveHit = false;
        events.push({ kind: "slam", x: k.x, z: k.z });
        enter(k, "stuck");
      }
      break;
    case "stuck":
      if (k.t >= STUCK_TIME) enter(k, "stalk");
      break;
    case "dead":
      break;
  }
  return events;
}

export type KratosHit = "none" | "clang" | "hurt" | "dead";

export function strikeKratos(k: Kratos, power: number, fromX: number, fromZ: number): KratosHit {
  if (k.state === "dead") return "none";
  if (guarding(k) && inArc(k.yaw, k.x, k.z, fromX, fromZ, GUARD_ARC)) return "clang";
  k.hp = Math.max(0, k.hp - power);
  if (k.hp === 0) {
    enter(k, "dead");
    k.boulder = null;
    k.wave = -1;
    return "dead";
  }
  return "hurt";
}
