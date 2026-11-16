import { dist, turnToward, yawTo } from "./bearing";

/**
 * Artemis, goddess of the hunt, in her colosseum in the north-west forest.
 * She keeps her distance and looses arrows in volleys, leaps away from a hero
 * who closes in, and calls wolves when hurt. The opening is the reload after a
 * volley, when she stands still to nock the next.
 */
export const ARTEMIS = { x: -380, z: -430, r: 18, thick: 3.5, yaw: Math.PI / 4 };
export const ARTEMIS_HP = 20;
export const WOLF_AT: readonly number[] = [2 / 3, 1 / 3];
export const WOLVES = 3;

export const INTRO_TIME = 2.6;
/** She likes to be about this far away, and backs off or closes to keep it. */
export const RANGE = 9;
export const MOVE_SPEED = 3.4;
export const AIM_TIME = 0.7;
export const VOLLEY = 3;
export const VOLLEY_GAP = 0.35;
export const RELOAD_TIME = 2.2;
export const ARROW_SPEED = 24;
export const ARROW_HIT = 0.9;
export const ARROW_DAMAGE = 12;
/** Closer than this and she leaps clean away. */
export const TOO_CLOSE = 3;
export const LEAP_TIME = 0.5;
export const LEAP_DISTANCE = 9;
export const LEAP_COOLDOWN = 4;
export const CALL_TIME = 1.4;
export const BODY = 1;
const TURN = 4;

export type ArtemisState = "intro" | "hunt" | "aim" | "loose" | "reload" | "leap" | "call" | "dead";

export interface Arrow {
  x: number;
  z: number;
  yaw: number;
  t: number;
}

export interface Artemis {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  state: ArtemisState;
  t: number;
  shots: number;
  calls: number;
  leapReady: number;
  moving: boolean;
  arrows: Arrow[];
}

export type ArtemisEvent =
  | { kind: "blow"; damage: number; x: number; z: number; heavy: boolean }
  | { kind: "loose" }
  | { kind: "leap" }
  | { kind: "wolves"; count: number }
  | { kind: "roar" };

export function makeArtemis(x: number, z: number, yaw: number): Artemis {
  return { x, z, yaw, hp: ARTEMIS_HP, state: "intro", t: 0, shots: 0, calls: 0, leapReady: 0, moving: false, arrows: [] };
}

function enter(a: Artemis, state: ArtemisState): void {
  a.state = state;
  a.t = 0;
}

export function wolvesDue(a: Artemis): boolean {
  const line = WOLF_AT[a.calls];
  return line !== undefined && a.hp <= ARTEMIS_HP * line && a.hp > 0;
}

export function updateArtemis(a: Artemis, dt: number, hero: { x: number; z: number; alive: boolean }, arena: { x: number; z: number; r: number }): ArtemisEvent[] {
  const events: ArtemisEvent[] = [];
  a.t += dt;
  a.moving = false;
  a.leapReady = Math.max(0, a.leapReady - dt);
  const toHero = dist(a.x, a.z, hero.x, hero.z);
  const face = (rate: number): void => {
    a.yaw = turnToward(a.yaw, yawTo(a.x, a.z, hero.x, hero.z), rate * dt);
  };

  for (const arrow of a.arrows) {
    arrow.t += dt;
    arrow.x += Math.sin(arrow.yaw) * ARROW_SPEED * dt;
    arrow.z += Math.cos(arrow.yaw) * ARROW_SPEED * dt;
    if (hero.alive && dist(arrow.x, arrow.z, hero.x, hero.z) < ARROW_HIT) {
      events.push({ kind: "blow", damage: ARROW_DAMAGE, x: arrow.x - Math.sin(arrow.yaw) * 2, z: arrow.z - Math.cos(arrow.yaw) * 2, heavy: false });
      arrow.t = 99;
    }
  }
  a.arrows = a.arrows.filter((arrow) => arrow.t < 1.5 && dist(arrow.x, arrow.z, arena.x, arena.z) < arena.r);

  // Too close, and she is gone: a leap straight away from the hero, kept inside the wall.
  if (hero.alive && toHero < TOO_CLOSE && a.leapReady === 0 && (a.state === "hunt" || a.state === "aim")) {
    a.yaw = yawTo(hero.x, hero.z, a.x, a.z);
    a.leapReady = LEAP_COOLDOWN;
    events.push({ kind: "leap" });
    enter(a, "leap");
  }

  switch (a.state) {
    case "intro":
      face(TURN);
      if (a.t >= INTRO_TIME) {
        events.push({ kind: "roar" });
        enter(a, "hunt");
      }
      break;
    case "hunt": {
      if (!hero.alive) break;
      if (wolvesDue(a)) {
        enter(a, "call");
        break;
      }
      face(TURN);
      // Back off if the hero is closing, close in if they are far.
      const dir = toHero < RANGE - 1.5 ? -1 : toHero > RANGE + 3 ? 1 : 0;
      if (dir !== 0) {
        a.x += Math.sin(a.yaw) * MOVE_SPEED * dt * dir;
        a.z += Math.cos(a.yaw) * MOVE_SPEED * dt * dir;
        a.moving = true;
      }
      if (a.t >= 1.2) {
        a.shots = 0;
        enter(a, "aim");
      }
      break;
    }
    case "aim":
      face(TURN * 2);
      if (a.t >= AIM_TIME) enter(a, "loose");
      break;
    case "loose":
      face(TURN * 2);
      if (a.t >= VOLLEY_GAP) {
        a.arrows.push({ x: a.x + Math.sin(a.yaw) * BODY, z: a.z + Math.cos(a.yaw) * BODY, yaw: a.yaw, t: 0 });
        events.push({ kind: "loose" });
        a.shots += 1;
        a.t = 0;
        if (a.shots >= VOLLEY) enter(a, "reload");
      }
      break;
    case "reload":
      if (a.t >= RELOAD_TIME) enter(a, "hunt");
      break;
    case "leap": {
      const speed = LEAP_DISTANCE / LEAP_TIME;
      a.x += Math.sin(a.yaw) * speed * dt;
      a.z += Math.cos(a.yaw) * speed * dt;
      a.moving = true;
      const d = dist(a.x, a.z, arena.x, arena.z);
      const limit = arena.r - BODY - 0.5;
      if (d > limit) {
        a.x = arena.x + ((a.x - arena.x) / d) * limit;
        a.z = arena.z + ((a.z - arena.z) / d) * limit;
      }
      if (a.t >= LEAP_TIME) enter(a, "hunt");
      break;
    }
    case "call":
      face(TURN);
      if (a.t >= CALL_TIME * 0.5 && wolvesDue(a)) {
        a.calls += 1;
        events.push({ kind: "wolves", count: WOLVES });
      }
      if (a.t >= CALL_TIME) enter(a, "hunt");
      break;
    case "dead":
      break;
  }
  return events;
}

export type ArtemisHit = "none" | "hurt" | "dead";

/** She has no shield: what keeps her safe is distance, and the leap. */
export function strikeArtemis(a: Artemis, power: number): ArtemisHit {
  if (a.state === "dead" || a.state === "leap") return "none";
  a.hp = Math.max(0, a.hp - power);
  if (a.hp === 0) {
    enter(a, "dead");
    a.arrows = [];
    return "dead";
  }
  return "hurt";
}

/** A wolf she calls: it runs at the hero and bites, and two blows put it down. */
export interface Wolf {
  x: number;
  z: number;
  yaw: number;
  hp: number;
  bite: number;
  hurt: number;
  dead: number;
}
export const WOLF_SPEED = 6.5;
export const WOLF_DAMAGE = 8;
export const WOLF_BITE_EVERY = 1.1;
export const WOLF_REACH = 1.4;

export function makeWolf(x: number, z: number): Wolf {
  return { x, z, yaw: 0, hp: 2, bite: WOLF_BITE_EVERY, hurt: 0, dead: -1 };
}

/** Moves a wolf on; hands back true the moment it bites. */
export function stepWolf(w: Wolf, dt: number, hero: { x: number; z: number; alive: boolean }): boolean {
  if (w.dead >= 0) {
    w.dead += dt;
    return false;
  }
  w.hurt = Math.max(0, w.hurt - dt);
  w.bite = Math.max(0, w.bite - dt);
  if (!hero.alive) return false;
  w.yaw = yawTo(w.x, w.z, hero.x, hero.z);
  const d = dist(w.x, w.z, hero.x, hero.z);
  if (d > WOLF_REACH * 0.8 && w.hurt === 0) {
    w.x += Math.sin(w.yaw) * WOLF_SPEED * dt;
    w.z += Math.cos(w.yaw) * WOLF_SPEED * dt;
  }
  if (d <= WOLF_REACH && w.bite === 0) {
    w.bite = WOLF_BITE_EVERY;
    return true;
  }
  return false;
}

export function strikeWolf(w: Wolf, power: number): boolean {
  if (w.dead >= 0) return false;
  w.hp -= power;
  w.hurt = 0.3;
  if (w.hp <= 0) w.dead = 0;
  return true;
}
