import { dist, inArc, turnToward, yawTo } from "./bearing";

/** The rank and file: bandits on the road, and the soldiers Ares calls in. */
export type GruntKind = "bandit" | "spartan";

export interface GruntStats {
  hp: number;
  speed: number;
  /** How close it has to be to start a swing, and how far that swing reaches. */
  reach: number;
  damage: number;
  /** The telegraph: how long the sword is up before it comes down. */
  windup: number;
  recover: number;
  /** How near the hero has to come before it notices. */
  aggro: number;
}

export const GRUNTS: Record<GruntKind, GruntStats> = {
  bandit: { hp: 3, speed: 2.4, reach: 1.7, damage: 12, windup: 0.6, recover: 0.7, aggro: 13 },
  spartan: { hp: 2, speed: 3.6, reach: 1.8, damage: 10, windup: 0.45, recover: 0.55, aggro: 60 },
};

/** A felled bandit lies flat this long, and a blow in that time finishes it. */
export const DOWN_TIME = 4;
export const RISE_TIME = 0.9;
export const REEL_TIME = 0.35;
export const STRIKE_TIME = 0.15;
export const KNOCK = 7;
/** Dead bodies linger this long before the game clears them away. */
export const DEAD_FADE = 1.2;
/** Past this far from home a grunt gives up the chase. */
export const LEASH = 26;
export const TURN_RATE = 7;
/** The arc in front of a grunt its swing connects with. */
export const SWING_ARC = Math.PI * 0.6;

export type GruntState = "idle" | "walk" | "windup" | "strike" | "recover" | "reel" | "down" | "rise" | "dead";

export interface Grunt {
  id: number;
  kind: GruntKind;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  state: GruntState;
  /** Seconds spent in `state`. */
  t: number;
  homeX: number;
  homeZ: number;
  vx: number;
  vz: number;
  /** Whether it is moving this frame, so the figure knows to walk. */
  moving: boolean;
}

export function makeGrunt(id: number, kind: GruntKind, x: number, z: number, yaw = 0): Grunt {
  return { id, kind, x, z, yaw, hp: GRUNTS[kind].hp, state: "idle", t: 0, homeX: x, homeZ: z, vx: 0, vz: 0, moving: false };
}

/** A blow landing on the hero, from where it was struck. */
export interface Blow {
  damage: number;
  x: number;
  z: number;
  heavy: boolean;
}

export interface Target {
  x: number;
  z: number;
  alive: boolean;
}

function enter(g: Grunt, state: GruntState): void {
  g.state = state;
  g.t = 0;
}

export function updateGrunt(g: Grunt, dt: number, hero: Target): Blow | null {
  const s = GRUNTS[g.kind];
  g.t += dt;
  g.moving = false;
  // Knockback carries on whatever it is doing, and bleeds away.
  g.x += g.vx * dt;
  g.z += g.vz * dt;
  const drag = Math.exp(-8 * dt);
  g.vx *= drag;
  g.vz *= drag;

  const toHero = dist(g.x, g.z, hero.x, hero.z);
  const fromHome = dist(g.x, g.z, g.homeX, g.homeZ);
  const step = (tx: number, tz: number, speed: number): void => {
    g.yaw = turnToward(g.yaw, yawTo(g.x, g.z, tx, tz), TURN_RATE * dt);
    g.x += Math.sin(g.yaw) * speed * dt;
    g.z += Math.cos(g.yaw) * speed * dt;
    g.moving = true;
  };

  switch (g.state) {
    case "idle":
      if (hero.alive && toHero < s.aggro) enter(g, "walk");
      else if (fromHome > 1) step(g.homeX, g.homeZ, s.speed * 0.6);
      return null;
    case "walk":
      if (!hero.alive || fromHome > LEASH || toHero > s.aggro * 1.6) {
        enter(g, "idle");
        return null;
      }
      if (toHero <= s.reach) {
        enter(g, "windup");
        return null;
      }
      step(hero.x, hero.z, s.speed);
      return null;
    case "windup":
      // Tracks the hero, but slowly: a step aside is how a swing is dodged.
      g.yaw = turnToward(g.yaw, yawTo(g.x, g.z, hero.x, hero.z), 2 * dt);
      if (g.t >= s.windup) {
        enter(g, "strike");
        if (hero.alive && toHero <= s.reach + 0.4 && inArc(g.yaw, g.x, g.z, hero.x, hero.z, SWING_ARC)) {
          return { damage: s.damage, x: g.x, z: g.z, heavy: false };
        }
      }
      return null;
    case "strike":
      if (g.t >= STRIKE_TIME) enter(g, "recover");
      return null;
    case "recover":
      if (g.t >= s.recover) enter(g, "walk");
      return null;
    case "reel":
      if (g.t >= REEL_TIME) enter(g, "walk");
      return null;
    case "down":
      if (g.t >= DOWN_TIME) enter(g, "rise");
      return null;
    case "rise":
      if (g.t >= RISE_TIME) {
        g.hp = s.hp;
        enter(g, "walk");
      }
      return null;
    case "dead":
      return null;
  }
}

export type HitResult = "none" | "hurt" | "down" | "dead";

/** Whether a sword swinging now would connect: a heap on the ground still can. */
export function hittable(g: Grunt): boolean {
  return g.state !== "dead";
}

export function strikeGrunt(g: Grunt, power: number, fromX: number, fromZ: number): HitResult {
  if (g.state === "dead") return "none";
  // A bandit knocked flat — or still getting up — is finished by any blow.
  if (g.state === "down" || g.state === "rise") {
    enter(g, "dead");
    return "dead";
  }
  g.hp -= power;
  const away = yawTo(fromX, fromZ, g.x, g.z);
  if (g.hp <= 0) {
    g.hp = 0;
    g.vx = Math.sin(away) * KNOCK * 0.6;
    g.vz = Math.cos(away) * KNOCK * 0.6;
    const fell = g.kind === "bandit" ? "down" : "dead";
    enter(g, fell);
    return fell;
  }
  g.vx = Math.sin(away) * KNOCK;
  g.vz = Math.cos(away) * KNOCK;
  enter(g, "reel");
  return "hurt";
}

/** How many coins a grunt leaves behind when it is finished for good. */
export const BOUNTY: Record<GruntKind, number> = { bandit: 3, spartan: 2 };
