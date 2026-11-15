import { dist, inArc, turnToward, yawTo } from "./bearing";

/**
 * Mount Olympus, south of the city. Zeus's colosseum stands at its foot, gate
 * to the city; beat him and the back wall breaks open onto a staircase up the
 * mountain's north face to Olympia, a city on the flat summit. As on the
 * volcano, whatever is not the path is a fall.
 */
export const OLYMPUS = { x: 0, z: 160, r: 70, h: 34, top: 30 };
/** Zeus's colosseum, its back against the foot of the stairs and its gate facing the city. */
export const ZEUS_RING = { x: OLYMPUS.x, z: OLYMPUS.z - OLYMPUS.r - 22.5, r: 16, thick: 3.5, yaw: Math.PI };
/** The monument in the middle of Olympia, and how close to its door counts as trying it. */
export const MONUMENT = { x: OLYMPUS.x, z: OLYMPUS.z + 2, w: 12, d: 14 };
export const DOOR = { x: MONUMENT.x, z: MONUMENT.z - MONUMENT.d / 2 - 2.6 };

/** Olympia's houses, in a ring round the monument with the top of the stairs left open. */
export function olympiaHouses(): Array<{ x: number; z: number; w: number; d: number; yaw: number; dome: boolean }> {
  const out: Array<{ x: number; z: number; w: number; d: number; yaw: number; dome: boolean }> = [];
  const angles = [0, 35, 70, 110, 145, 215, 250, 290, 325];
  angles.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const r = 18 + (i % 2) * 2;
    const x = Math.round(OLYMPUS.x + Math.sin(a) * r);
    const z = Math.round(OLYMPUS.z + Math.cos(a) * r);
    const back = Math.atan2(OLYMPUS.x - x, OLYMPUS.z - z);
    const yaw = Math.round(back / (Math.PI / 2)) * (Math.PI / 2);
    const across = Math.abs(Math.sin(yaw)) > 0.5;
    out.push({ x, z, w: across ? 4.5 : 5, d: across ? 5 : 4.5, yaw, dome: i % 2 === 0 });
  });
  return out;
}
export const OLYMPUS_STAIR_HALF = 2.2;
export const OLYMPUS_STEP = 1.2;

/** How high the mountain's side stands this far from its centre; the stairs climb exactly that. */
export function olympusSlope(d: number): number {
  if (d >= OLYMPUS.r) return 0;
  if (d <= OLYMPUS.top) return OLYMPUS.h;
  return (OLYMPUS.h * (OLYMPUS.r - d)) / (OLYMPUS.r - OLYMPUS.top);
}

/** The top of the step `d` from the centre is on. */
export function olympusStepY(d: number): number {
  return olympusSlope(OLYMPUS.top + Math.floor((d - OLYMPUS.top) / OLYMPUS_STEP) * OLYMPUS_STEP);
}

export function onOlympus(x: number, z: number): boolean {
  return dist(x, z, OLYMPUS.x, OLYMPUS.z) < OLYMPUS.r - 0.5;
}

/** How high the ground is on Olympus, or null off the path. The stairs run due north (toward -z) from the summit. */
export function olympusFooting(x: number, z: number): number | null {
  const d = dist(x, z, OLYMPUS.x, OLYMPUS.z);
  if (d < OLYMPUS.top) return OLYMPUS.h;
  const along = OLYMPUS.z - z;
  if (along > 0 && Math.abs(x - OLYMPUS.x) < OLYMPUS_STAIR_HALF && d <= OLYMPUS.r) return olympusStepY(along);
  return null;
}

export function inZeusArena(x: number, z: number, within = ZEUS_RING.r): boolean {
  return dist(x, z, ZEUS_RING.x, ZEUS_RING.z) < within;
}

export const ZEUS_HP = 22;
export const INTRO_TIME = 2.8;
export const STALK_SPEED = 2.8;
export const STALK_MIN = 1.2;
export const STALK_MAX = 3.2;
export const STRIKE_RANGE = 3.4;
export const STRIKE_DAMAGE = 18;
export const WINDUP_TIME = 0.65;
export const STRIKE_TIME = 0.2;
export const RECOVER_TIME = 0.9;
/** Further than this and he throws a bolt instead of walking up. */
export const THROW_FROM = 7;
export const AIM_TIME = 0.8;
export const BOLT_SPEED = 28;
export const BOLT_HIT = 1.0;
export const BOLT_DAMAGE = 20;
/** The storm: glowing rings on the floor, then lightning down each. One is always where the hero stands. */
export const STORM_WARN = 1.1;
export const STORM_COUNT = 8;
export const STORM_R = 1.6;
export const STORM_DAMAGE = 22;
/** Calling the storm leaves him spent this long — the opening. */
export const SPENT_TIME = 2.6;
export const GUARD_ARC = Math.PI * 0.6;
export const BODY = 1.1;
const TURN = 3;

export type ZeusState = "intro" | "stalk" | "windup" | "strike" | "recover" | "aim" | "storm" | "spent" | "dead";

export interface Bolt {
  x: number;
  z: number;
  yaw: number;
}

export interface Zeus {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  state: ZeusState;
  t: number;
  moving: boolean;
  storms: number;
  spots: Array<{ x: number; z: number }>;
  bolt: Bolt | null;
}

export type ZeusEvent =
  | { kind: "blow"; damage: number; x: number; z: number; heavy: boolean }
  | { kind: "throw" }
  | { kind: "storm"; spots: Array<{ x: number; z: number }> }
  | { kind: "lightning"; spots: Array<{ x: number; z: number }> }
  | { kind: "zap"; damage: number }
  | { kind: "roar" };

export function makeZeus(x: number, z: number, yaw: number): Zeus {
  return { x, z, yaw, hp: ZEUS_HP, state: "intro", t: 0, moving: false, storms: 0, spots: [], bolt: null };
}

function enter(zs: Zeus, state: ZeusState): void {
  zs.state = state;
  zs.t = 0;
}

export function guarding(zs: Zeus): boolean {
  return zs.state === "intro" || zs.state === "stalk" || zs.state === "windup" || zs.state === "aim" || zs.state === "storm";
}

export function updateZeus(
  zs: Zeus,
  dt: number,
  hero: { x: number; z: number; alive: boolean },
  arena: { x: number; z: number; r: number },
  rand: () => number = Math.random,
): ZeusEvent[] {
  const events: ZeusEvent[] = [];
  zs.t += dt;
  zs.moving = false;
  const toHero = dist(zs.x, zs.z, hero.x, hero.z);
  const face = (rate: number): void => {
    zs.yaw = turnToward(zs.yaw, yawTo(zs.x, zs.z, hero.x, hero.z), rate * dt);
  };

  const b = zs.bolt;
  if (b) {
    b.x += Math.sin(b.yaw) * BOLT_SPEED * dt;
    b.z += Math.cos(b.yaw) * BOLT_SPEED * dt;
    if (hero.alive && dist(b.x, b.z, hero.x, hero.z) < BOLT_HIT) {
      events.push({ kind: "blow", damage: BOLT_DAMAGE, x: b.x - Math.sin(b.yaw) * 2, z: b.z - Math.cos(b.yaw) * 2, heavy: true });
      zs.bolt = null;
    } else if (dist(b.x, b.z, arena.x, arena.z) > arena.r) zs.bolt = null;
  }

  switch (zs.state) {
    case "intro":
      face(TURN);
      if (zs.t >= INTRO_TIME) {
        events.push({ kind: "roar" });
        enter(zs, "stalk");
      }
      break;
    case "stalk":
      if (!hero.alive) break;
      face(TURN);
      if (toHero > STRIKE_RANGE * 0.8) {
        zs.x += Math.sin(zs.yaw) * STALK_SPEED * dt;
        zs.z += Math.cos(zs.yaw) * STALK_SPEED * dt;
        zs.moving = true;
      }
      if (zs.t >= STALK_MIN && toHero <= STRIKE_RANGE) enter(zs, "windup");
      else if (zs.t >= STALK_MIN && toHero > THROW_FROM) enter(zs, "aim");
      else if (zs.t >= STALK_MAX) {
        zs.spots = [{ x: hero.x, z: hero.z }];
        for (let i = 1; i < STORM_COUNT; i++) {
          const a = rand() * Math.PI * 2;
          const d = Math.sqrt(rand()) * (arena.r - 2);
          zs.spots.push({ x: arena.x + Math.sin(a) * d, z: arena.z + Math.cos(a) * d });
        }
        enter(zs, "storm");
        events.push({ kind: "storm", spots: zs.spots });
      }
      break;
    case "windup":
      face(TURN * 0.5);
      if (zs.t >= WINDUP_TIME) {
        enter(zs, "strike");
        if (hero.alive && toHero <= STRIKE_RANGE + 0.3 && inArc(zs.yaw, zs.x, zs.z, hero.x, hero.z, Math.PI * 0.7)) {
          events.push({ kind: "blow", damage: STRIKE_DAMAGE, x: zs.x, z: zs.z, heavy: false });
        }
      }
      break;
    case "strike":
      if (zs.t >= STRIKE_TIME) enter(zs, "recover");
      break;
    case "recover":
      if (zs.t >= RECOVER_TIME) enter(zs, "stalk");
      break;
    case "aim":
      face(TURN * 1.5);
      if (zs.t >= AIM_TIME) {
        zs.bolt = { x: zs.x + Math.sin(zs.yaw) * BODY, z: zs.z + Math.cos(zs.yaw) * BODY, yaw: zs.yaw };
        events.push({ kind: "throw" });
        enter(zs, "recover");
      }
      break;
    case "storm":
      if (zs.spots.length > 0 && zs.t >= STORM_WARN) {
        events.push({ kind: "lightning", spots: zs.spots });
        if (hero.alive && zs.spots.some((p) => dist(p.x, p.z, hero.x, hero.z) < STORM_R)) events.push({ kind: "zap", damage: STORM_DAMAGE });
        zs.spots = [];
        zs.storms += 1;
        enter(zs, "spent");
      }
      break;
    case "spent":
      if (zs.t >= SPENT_TIME) enter(zs, "stalk");
      break;
    case "dead":
      break;
  }
  return events;
}

export type ZeusHit = "none" | "clang" | "hurt" | "dead";

export function strikeZeus(zs: Zeus, power: number, fromX: number, fromZ: number): ZeusHit {
  if (zs.state === "dead") return "none";
  if (guarding(zs) && inArc(zs.yaw, zs.x, zs.z, fromX, fromZ, GUARD_ARC)) return "clang";
  zs.hp = Math.max(0, zs.hp - power);
  if (zs.hp === 0) {
    enter(zs, "dead");
    zs.bolt = null;
    return "dead";
  }
  return "hurt";
}
