import { dist, inArc, turnToward, yawTo } from "./bearing";

/** Tartarus: a round floor of black rock hanging over a sea of fire, far below the world. */
export const TARTARUS = { x: 0, z: 360, y: -60, r: 18 };
/** Where the portal from the volcano sets you down, and where the way home stands once he is beaten. */
export const ARRIVAL = { x: TARTARUS.x + TARTARUS.r - 4, z: TARTARUS.z, yaw: -Math.PI / 2 };
export const HOME_PORTAL = { x: TARTARUS.x + TARTARUS.r - 1.5, z: TARTARUS.z };

export function inTartarus(x: number, z: number, within = TARTARUS.r + 20): boolean {
  return dist(x, z, TARTARUS.x, TARTARUS.z) < within;
}

export const HADES_HP = 20;
/** He raises the dead each time his health drops past one of these shares. */
export const RAISE_AT: readonly number[] = [2 / 3, 1 / 3];
export const RAISE_COUNT = 3;
export const RAISE_TIME = 1.6;

export const INTRO_TIME = 2.8;
export const STALK_SPEED = 2.6;
export const STALK_MIN = 1.2;
export const STALK_MAX = 3.2;
export const STRIKE_RANGE = 3.6;
export const STRIKE_DAMAGE = 18;
export const WINDUP_TIME = 0.7;
export const STRIKE_TIME = 0.2;
export const RECOVER_TIME = 0.9;
/** Further than this and he puts on his helmet and vanishes. */
export const VANISH_FROM = 6;
export const VANISH_TIME = 1.3;
/** He comes back this far behind you. */
export const BEHIND = 2.4;
/** The green glow before the blow from behind: long enough to turn and raise a shield. */
export const AMBUSH_TIME = 0.9;
export const AMBUSH_DAMAGE = 26;
/** After the blow from behind he stands open this long — the opening. */
export const EXPOSED_TIME = 2.4;
export const GUARD_ARC = Math.PI * 0.6;
export const BODY = 1.1;
const TURN = 3;

export type HadesState = "intro" | "stalk" | "windup" | "strike" | "recover" | "vanish" | "ambush" | "exposed" | "raise" | "dead";

export interface Hades {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  state: HadesState;
  t: number;
  raises: number;
  moving: boolean;
}

export type HadesEvent =
  | { kind: "blow"; damage: number; x: number; z: number; heavy: boolean }
  | { kind: "vanish" }
  | { kind: "appear"; x: number; z: number }
  | { kind: "raise"; count: number }
  | { kind: "roar" };

export function makeHades(x: number, z: number, yaw: number): Hades {
  return { x, z, yaw, hp: HADES_HP, state: "intro", t: 0, raises: 0, moving: false };
}

function enter(h: Hades, state: HadesState): void {
  h.state = state;
  h.t = 0;
}

export function raiseDue(h: Hades): boolean {
  const line = RAISE_AT[h.raises];
  return line !== undefined && h.hp <= HADES_HP * line && h.hp > 0;
}

/** Holding his bident he turns aside what comes from in front. */
export function guarding(h: Hades): boolean {
  return h.state === "intro" || h.state === "stalk" || h.state === "windup" || h.state === "raise";
}

/** Gone: wearing the helmet, nothing can find him. */
export function hidden(h: Hades): boolean {
  return h.state === "vanish";
}

export function updateHades(
  h: Hades,
  dt: number,
  hero: { x: number; z: number; yaw: number; alive: boolean },
  arena: { x: number; z: number; r: number },
): HadesEvent[] {
  const events: HadesEvent[] = [];
  h.t += dt;
  h.moving = false;
  const toHero = dist(h.x, h.z, hero.x, hero.z);
  const face = (rate: number): void => {
    h.yaw = turnToward(h.yaw, yawTo(h.x, h.z, hero.x, hero.z), rate * dt);
  };
  const blowIfNear = (range: number, damage: number, heavy: boolean): void => {
    if (hero.alive && dist(h.x, h.z, hero.x, hero.z) <= range + 0.3 && inArc(h.yaw, h.x, h.z, hero.x, hero.z, Math.PI * 0.7)) {
      events.push({ kind: "blow", damage, x: h.x, z: h.z, heavy });
    }
  };

  switch (h.state) {
    case "intro":
      face(TURN);
      if (h.t >= INTRO_TIME) {
        events.push({ kind: "roar" });
        enter(h, "stalk");
      }
      break;
    case "stalk":
      if (!hero.alive) break;
      if (raiseDue(h)) {
        enter(h, "raise");
        break;
      }
      face(TURN);
      if (toHero > STRIKE_RANGE * 0.8) {
        h.x += Math.sin(h.yaw) * STALK_SPEED * dt;
        h.z += Math.cos(h.yaw) * STALK_SPEED * dt;
        h.moving = true;
      }
      if (h.t >= STALK_MIN && toHero <= STRIKE_RANGE) enter(h, "windup");
      else if ((h.t >= STALK_MIN && toHero > VANISH_FROM) || h.t >= STALK_MAX) {
        enter(h, "vanish");
        events.push({ kind: "vanish" });
      }
      break;
    case "windup":
      face(TURN * 0.5);
      if (h.t >= WINDUP_TIME) {
        enter(h, "strike");
        blowIfNear(STRIKE_RANGE, STRIKE_DAMAGE, false);
      }
      break;
    case "strike":
      if (h.t >= STRIKE_TIME) enter(h, "recover");
      break;
    case "recover":
      if (h.t >= RECOVER_TIME) enter(h, "stalk");
      break;
    case "vanish":
      if (h.t >= VANISH_TIME) {
        // Back, behind wherever the hero is looking, and inside the arena.
        let x = hero.x - Math.sin(hero.yaw) * BEHIND;
        let z = hero.z - Math.cos(hero.yaw) * BEHIND;
        const out = dist(x, z, arena.x, arena.z);
        const limit = arena.r - BODY - 0.5;
        if (out > limit) {
          x = arena.x + ((x - arena.x) / out) * limit;
          z = arena.z + ((z - arena.z) / out) * limit;
        }
        h.x = x;
        h.z = z;
        h.yaw = yawTo(x, z, hero.x, hero.z);
        events.push({ kind: "appear", x, z });
        enter(h, "ambush");
      }
      break;
    case "ambush":
      face(TURN * 0.6);
      if (h.t >= AMBUSH_TIME) {
        blowIfNear(STRIKE_RANGE, AMBUSH_DAMAGE, true);
        enter(h, "exposed");
      }
      break;
    case "exposed":
      if (h.t >= EXPOSED_TIME) enter(h, "stalk");
      break;
    case "raise":
      face(TURN);
      if (h.t >= RAISE_TIME * 0.5 && raiseDue(h)) {
        h.raises += 1;
        events.push({ kind: "raise", count: RAISE_COUNT });
      }
      if (h.t >= RAISE_TIME) enter(h, "stalk");
      break;
    case "dead":
      break;
  }
  return events;
}

export type HadesHit = "none" | "clang" | "hurt" | "dead";

export function strikeHades(h: Hades, power: number, fromX: number, fromZ: number): HadesHit {
  if (h.state === "dead" || hidden(h)) return "none";
  if (guarding(h) && inArc(h.yaw, h.x, h.z, fromX, fromZ, GUARD_ARC)) return "clang";
  h.hp = Math.max(0, h.hp - power);
  if (h.hp === 0) {
    enter(h, "dead");
    return "dead";
  }
  return "hurt";
}
