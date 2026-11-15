import { dist, inArc, turnToward, yawTo } from "./bearing";

/**
 * Tartarus, far below the world: a rock island hanging over a sea of fire,
 * and a staircase up from it to Hades's roofed colosseum. Its centre and floor
 * height are `TARTARUS`; its gate faces east, down the stairs.
 */
export const TARTARUS = { x: 0, z: 360, y: -60, r: 18 };
export const HADES_RING = { x: TARTARUS.x, z: TARTARUS.z, r: TARTARUS.r, thick: 3.5, yaw: Math.PI / 2 };
export const GATE_HALF = 3.2;
/** The island you land on, well below the colosseum. */
export const LOW_Y = TARTARUS.y - 30;
export const FIRE_Y = LOW_Y - 30;
export const STAIRS = { x0: TARTARUS.x + TARTARUS.r + 3.5, x1: TARTARUS.x + TARTARUS.r + 3.5 + 36, half: 2 };
/** The island at the foot of the stairs. */
export const ISLAND = { x: STAIRS.x1 + 13, z: TARTARUS.z, r: 15 };
/** Every island in the dark, the stairs' own first; you land on the last. */
export const ISLANDS: ReadonlyArray<{ x: number; z: number; r: number }> = [
  ISLAND,
  { x: ISLAND.x + 34, z: TARTARUS.z + 20, r: 10 },
  { x: ISLAND.x + 62, z: TARTARUS.z - 6, r: 11 },
  { x: ISLAND.x + 6, z: TARTARUS.z - 38, r: 8 },
];
/** Narrow rock bridges between islands, by index into `ISLANDS`. */
export const BRIDGES: ReadonlyArray<[number, number]> = [
  [0, 1],
  [1, 2],
  [0, 3],
];
export const BRIDGE_HALF = 1.3;
/** Where the portal from the volcano sets you down, and where the way home stands once he is beaten. */
export const ARRIVAL = { x: ISLANDS[2]!.x + 6, z: ISLANDS[2]!.z, yaw: -Math.PI / 2 };
/** Skeletons guarding the islands: how many on each. */
export const ISLAND_GUARDS: readonly number[] = [3, 3, 2, 3];
export const HOME_PORTAL = { x: TARTARUS.x - 10, z: TARTARUS.z };
/** Step this far inside and the gate drops behind you. */
export const HADES_TRIGGER = TARTARUS.r - 4;

export function inTartarus(x: number, z: number): boolean {
  return z > TARTARUS.z - 80 && z < TARTARUS.z + 80 && x > TARTARUS.x - 60 && x < ISLAND.x + 100;
}

export function inHadesArena(x: number, z: number, within = TARTARUS.r): boolean {
  return dist(x, z, TARTARUS.x, TARTARUS.z) < within;
}

/** How high the ground is in Tartarus, or null over the drop into the fire. */
export function tartarusFooting(x: number, z: number): number | null {
  const fromArena = dist(x, z, TARTARUS.x, TARTARUS.z);
  if (fromArena < TARTARUS.r + HADES_RING.thick && (fromArena < TARTARUS.r || Math.abs(z - TARTARUS.z) < GATE_HALF + 2)) return TARTARUS.y;
  // The top step tucks a little into the gateway, so the corner where curve meets straight is never a gap.
  if (x >= STAIRS.x0 - 0.6 && x <= STAIRS.x1 && Math.abs(z - TARTARUS.z) < STAIRS.half) {
    return TARTARUS.y + (LOW_Y - TARTARUS.y) * Math.max(0, (x - STAIRS.x0) / (STAIRS.x1 - STAIRS.x0));
  }
  if (ISLANDS.some((i) => dist(x, z, i.x, i.z) < i.r)) return LOW_Y;
  for (const [a, b] of BRIDGES) if (nearSegment(x, z, ISLANDS[a]!, ISLANDS[b]!) < BRIDGE_HALF) return LOW_Y;
  return null;
}

/** How far `(x, z)` is from the line between two points, or Infinity past either end. */
function nearSegment(x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz);
  if (t < 0 || t > 1) return Infinity;
  return Math.abs((x - a.x) * dz - (z - a.z) * dx) / Math.hypot(dx, dz);
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
/** The other trick: he strikes the floor and stalactites come down from the roof. */
export const QUAKE_WARN = 1.2;
export const QUAKE_TIME = 2.0;
export const QUAKE_COUNT = 7;
export const CRUSH_R = 1.5;
export const CRUSH_DAMAGE = 22;
export const GUARD_ARC = Math.PI * 0.6;
export const BODY = 1.1;
const TURN = 3;

export type HadesState = "intro" | "stalk" | "windup" | "strike" | "recover" | "vanish" | "ambush" | "exposed" | "quake" | "raise" | "dead";

export interface Hades {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  state: HadesState;
  t: number;
  raises: number;
  /** How many tricks he has played, so he takes turns between vanishing and the stalactites. */
  tricks: number;
  /** Where the stalactites are coming down. */
  spots: Array<{ x: number; z: number }>;
  moving: boolean;
}

export type HadesEvent =
  | { kind: "blow"; damage: number; x: number; z: number; heavy: boolean }
  | { kind: "vanish" }
  | { kind: "appear"; x: number; z: number }
  | { kind: "raise"; count: number }
  | { kind: "quake"; spots: Array<{ x: number; z: number }> }
  | { kind: "crash"; spots: Array<{ x: number; z: number }> }
  | { kind: "crush"; damage: number }
  | { kind: "roar" };

export function makeHades(x: number, z: number, yaw: number): Hades {
  return { x, z, yaw, hp: HADES_HP, state: "intro", t: 0, raises: 0, tricks: 0, spots: [], moving: false };
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
  return h.state === "intro" || h.state === "stalk" || h.state === "windup" || h.state === "raise" || h.state === "quake";
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
  rand: () => number = Math.random,
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
        h.tricks += 1;
        if (h.tricks % 2 === 1) {
          enter(h, "vanish");
          events.push({ kind: "vanish" });
        } else {
          // One right where the hero stands, the rest anywhere on the sand.
          h.spots = [{ x: hero.x, z: hero.z }];
          for (let i = 1; i < QUAKE_COUNT; i++) {
            const a = rand() * Math.PI * 2;
            const d = Math.sqrt(rand()) * (arena.r - 2);
            h.spots.push({ x: arena.x + Math.sin(a) * d, z: arena.z + Math.cos(a) * d });
          }
          enter(h, "quake");
          events.push({ kind: "quake", spots: h.spots });
        }
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
    case "quake":
      if (h.spots.length > 0 && h.t >= QUAKE_WARN) {
        events.push({ kind: "crash", spots: h.spots });
        if (hero.alive && h.spots.some((p) => dist(p.x, p.z, hero.x, hero.z) < CRUSH_R)) events.push({ kind: "crush", damage: CRUSH_DAMAGE });
        h.spots = [];
      }
      if (h.t >= QUAKE_TIME) enter(h, "stalk");
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
