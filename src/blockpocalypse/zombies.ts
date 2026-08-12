import type { ZombieKind } from "./level";
import { createBody, ledgeAhead, moveBody, restingOnGround, type Body } from "./physics";
import type { World } from "./world";

export const ZOMBIE_GRAVITY = 34;
export const HIT_FLASH = 0.12;
/** How close the player has to be before a spawn point wakes up. */
export const WAKE_RANGE = 42;
/** Past this far behind the player a zombie is forgotten, and can wake again. */
export const FORGET_RANGE = 70;

interface Breed {
  width: number;
  height: number;
  speed: number;
  health: number;
  jump: number;
  damage: number;
  /** Ignores gravity and the world, and holds the height it came in at. */
  flies: boolean;
}

export const BREEDS: Record<ZombieKind, Breed> = {
  walker: { width: 0.75, height: 1.7, speed: 2.3, health: 3, jump: 11, damage: 1, flies: false },
  runner: { width: 0.65, height: 1.4, speed: 5.2, health: 2, jump: 12.5, damage: 1, flies: false },
  flyer: { width: 0.9, height: 1.1, speed: 3.4, health: 2, jump: 0, damage: 1, flies: true },
};

/** How far a flyer bobs either side of the lane it holds. */
export const BOB = 0.7;

export interface Zombie {
  kind: ZombieKind;
  body: Body;
  health: number;
  flash: number;
  facing: number;
  walkPhase: number;
  /** The height a flyer holds; unused by anything that walks. */
  lane: number;
  /** The spawn point that made it, so the level can re-arm that point. */
  origin: number;
}

export function createZombie(kind: ZombieKind, x: number, y: number, origin: number): Zombie {
  const breed = BREEDS[kind];
  return {
    kind,
    body: createBody(x, y, breed.width, breed.height),
    health: breed.health,
    flash: 0,
    facing: -1,
    walkPhase: 0,
    lane: y,
    origin,
  };
}

/**
 * Shambles towards the player. A zombie that walks into something jumps at
 * it, and a zombie that walks off a roof falls off the roof — it never checks
 * for the edge, which is most of the reason rooftops are worth standing on.
 */
export function stepZombie(world: World, zombie: Zombie, targetX: number, dt: number): void {
  const breed = BREEDS[zombie.kind];
  const body = zombie.body;
  zombie.flash = Math.max(0, zombie.flash - dt);

  if (breed.flies) {
    // Straight and level, west, forever. Predictable on purpose: the whole
    // game is reading what is coming and deciding to climb, drop or shoot.
    zombie.facing = -1;
    zombie.walkPhase += dt * 3;
    body.vx = -breed.speed;
    body.vy = 0;
    body.x += body.vx * dt;
    body.y = zombie.lane + Math.sin(zombie.walkPhase) * BOB;
    body.onGround = false;
    return;
  }

  const direction = Math.sign(targetX - body.x) || zombie.facing;
  zombie.facing = direction;
  body.vx = direction * breed.speed;

  // Anything hops a step it has walked into; only runners spot a gap coming
  // and leap it, which is what makes a pit shelter from one and not the other.
  const leaping = zombie.kind === "runner" && ledgeAhead(world, body, direction);
  if (body.onGround && (body.hitWall || leaping)) body.vy = breed.jump;

  body.vy -= ZOMBIE_GRAVITY * dt;
  if (body.vy < -40) body.vy = -40;
  moveBody(world, body, dt);
  body.onGround = restingOnGround(world, body);
  zombie.walkPhase += Math.abs(body.vx) * dt * 2.2;
}

/** Returns true when that was the last of it. */
export function hurtZombie(zombie: Zombie, damage: number, fromX: number): boolean {
  zombie.health -= damage;
  zombie.flash = HIT_FLASH;
  zombie.body.vx += zombie.body.x < fromX ? -3 : 3;
  return zombie.health <= 0;
}

export function overlapsBody(a: Body, b: Body): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
    a.y < b.y + b.h &&
    b.y < a.y + a.h
  );
}
