import { AIR, colourOf, isHazardBlock, isPrizeBlock } from "./blocks";
import { BULLET_LIFE, stepBullet, type Bullet } from "./bullets";
import type { InputState } from "./input";
import { generateJoyride } from "./joyride";
import { DEATH_Y, generateLevel, type Level } from "./level";
import { burst, stepParticles, type Particle } from "./particles";
import {
  chestY,
  createPlayer,
  hurtPlayer,
  MAX_HEALTH,
  stepPlayer,
  type Ability,
  type Mode,
  type Player,
} from "./player";
import { mulberry32 } from "./rng";
import type { World } from "./world";
import {
  BREEDS,
  createZombie,
  FORGET_RANGE,
  hurtZombie,
  overlapsBody,
  stepZombie,
  WAKE_RANGE,
  type Zombie,
} from "./zombies";

export const MAX_ZOMBIES = 30;
export const RESPAWN_DELAY = 1.6;
export const GOAL_RADIUS = 3;
/** Fixed simulation tick. Everything is tuned against it. */
export const TICK = 1 / 120;

/** `dead` is waiting on a respawn; `over` is a run with nowhere left to go. */
export type GameStatus = "playing" | "dead" | "over" | "won";

export type GameEvent =
  | { kind: "shot" }
  | { kind: "zombieHit" }
  | { kind: "zombieDied" }
  | { kind: "playerHurt" }
  | { kind: "coin" }
  | { kind: "checkpoint"; index: number }
  | { kind: "died" }
  | { kind: "won" };

export interface Game {
  seed: number;
  level: Level;
  world: World;
  player: Player;
  zombies: Zombie[];
  bullets: Bullet[];
  particles: Particle[];
  kills: number;
  coins: number;
  status: GameStatus;
  respawnIn: number;
  checkpoint: { x: number; y: number };
  checkpointIndex: number;
  /** One flag per level spawn point: armed points are allowed to wake up. */
  armed: boolean[];
  shake: number;
  elapsed: number;
  events: GameEvent[];
  rng: () => number;
}

export function createGame(
  seed: number,
  ability: Ability = "hook",
  mode: Mode = "city",
): Game {
  const level = mode === "joyride" ? generateJoyride(seed) : generateLevel(seed);
  return {
    seed,
    level,
    world: level.world,
    player: createPlayer(level.spawnX, level.spawnY, ability, mode),
    zombies: [],
    bullets: [],
    particles: [],
    kills: 0,
    coins: 0,
    status: "playing",
    respawnIn: 0,
    checkpoint: { x: level.spawnX, y: level.spawnY },
    checkpointIndex: -1,
    armed: level.zombieSpawns.map(() => true),
    shake: 0,
    elapsed: 0,
    events: [],
    rng: mulberry32(seed ^ 0x9e3779b9),
  };
}

export function stepGame(game: Game, input: InputState, dt: number): void {
  game.events.length = 0;
  game.shake = Math.max(0, game.shake - dt * 4);
  stepParticles(game.particles, dt);

  if (game.status === "dead") {
    game.respawnIn -= dt;
    if (game.respawnIn <= 0) respawn(game);
    return;
  }
  if (game.status === "won" || game.status === "over") return;

  game.elapsed += dt;
  const player = game.player;

  const shot = stepPlayer(game.world, player, input, dt);
  if (shot) {
    game.bullets.push({ x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy, life: BULLET_LIFE });
    burst(game.particles, game.rng, shot.x, shot.y, 0xffd27f, 3, 4);
    game.shake = Math.min(1, game.shake + 0.06);
    game.events.push({ kind: "shot" });
  }

  // Exhaust, thinned to a rate rather than one a tick, or a two-second burn
  // would be the whole particle budget.
  if (player.thrusting && game.rng() < dt * 45) {
    const nozzleX = player.body.x - player.facing * 0.36;
    burst(game.particles, game.rng, nozzleX, player.body.y + 0.5, 0xffb347, 1, 4, -7);
  }

  wakeSpawns(game);
  stepZombies(game, dt);
  stepBullets(game, dt);
  sweepCells(game);
  claimCheckpoint(game);

  if (Math.hypot(player.body.x - game.level.goalX, player.body.y - game.level.goalY) < GOAL_RADIUS) {
    game.status = "won";
    game.events.push({ kind: "won" });
  }

  if (player.body.y < DEATH_Y) {
    player.health = 0;
    player.alive = false;
  }
  if (!player.alive) kill(game);
}

function wakeSpawns(game: Game): void {
  const px = game.player.body.x;
  game.level.zombieSpawns.forEach((spawn, index) => {
    const distance = Math.abs(spawn.x - px);
    if (!game.armed[index]) {
      if (distance > FORGET_RANGE) game.armed[index] = true;
      return;
    }
    if (distance > WAKE_RANGE || game.zombies.length >= MAX_ZOMBIES) return;
    game.armed[index] = false;
    game.zombies.push(createZombie(spawn.kind, spawn.x, spawn.y, index));
  });
}

function stepZombies(game: Game, dt: number): void {
  const player = game.player;
  for (let index = game.zombies.length - 1; index >= 0; index--) {
    const zombie = game.zombies[index];
    if (!zombie) continue;
    if (Math.abs(zombie.body.x - player.body.x) > FORGET_RANGE || zombie.body.y < DEATH_Y) {
      game.zombies.splice(index, 1);
      continue;
    }
    stepZombie(game.world, zombie, player.body.x, dt);
    if (player.alive && overlapsBody(zombie.body, player.body)) {
      if (hurtPlayer(player, BREEDS[zombie.kind].damage, zombie.body.x)) {
        game.shake = 1;
        game.events.push({ kind: "playerHurt" });
        burst(game.particles, game.rng, player.body.x, chestY(player), 0xd8443c, 14, 7);
      }
    }
  }
}

function stepBullets(game: Game, dt: number): void {
  for (let index = game.bullets.length - 1; index >= 0; index--) {
    const bullet = game.bullets[index];
    if (!bullet) continue;
    const outcome = stepBullet(game.world, bullet, game.zombies, dt);
    if (outcome.kind === "flying") continue;
    game.bullets.splice(index, 1);

    if (outcome.kind === "wall") {
      burst(game.particles, game.rng, outcome.x, outcome.y, colourOf(outcome.block), outcome.broke ? 12 : 5, 6);
    } else if (outcome.kind === "hit") {
      const zombie = game.zombies[outcome.index];
      if (!zombie) continue;
      burst(game.particles, game.rng, outcome.x, outcome.y, 0x5aa02c, 8, 6);
      game.events.push({ kind: "zombieHit" });
      if (hurtZombie(zombie, 1, bullet.x)) {
        burst(game.particles, game.rng, zombie.body.x, zombie.body.y + zombie.body.h / 2, 0x5aa02c, 22, 9);
        game.zombies.splice(outcome.index, 1);
        game.kills++;
        game.shake = Math.min(1, game.shake + 0.25);
        game.events.push({ kind: "zombieDied" });
      }
    }
  }
}

/**
 * Reads the cells the player is standing in. Everything that is picked up or
 * regretted on contact lives in the grid rather than as an entity, so a coin
 * costs one byte and a beam of any length costs nothing to collide with.
 */
function sweepCells(game: Game): void {
  const body = game.player.body;
  const x0 = Math.floor(body.x - body.w / 2);
  const x1 = Math.floor(body.x + body.w / 2);
  const y0 = Math.floor(body.y);
  const y1 = Math.floor(body.y + body.h);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const block = game.world.get(x, y);
      if (block === AIR) continue;
      if (isPrizeBlock(block)) {
        game.world.set(x, y, AIR);
        game.coins++;
        game.events.push({ kind: "coin" });
        burst(game.particles, game.rng, x + 0.5, y + 0.5, colourOf(block), 6, 5);
      } else if (isHazardBlock(block) && hurtPlayer(game.player, 1, body.x)) {
        game.shake = 1;
        game.events.push({ kind: "playerHurt" });
        burst(game.particles, game.rng, x + 0.5, y + 0.5, colourOf(block), 18, 8);
      }
    }
  }
}

function claimCheckpoint(game: Game): void {
  game.level.checkpoints.forEach((point, index) => {
    if (index <= game.checkpointIndex) return;
    if (Math.abs(game.player.body.x - point.x) > 1.5) return;
    game.checkpointIndex = index;
    game.checkpoint = { x: point.x, y: point.y };
    game.shake = Math.min(1, game.shake + 0.2);
    burst(game.particles, game.rng, point.x, point.y + 1, 0x38e0a0, 24, 6);
    game.events.push({ kind: "checkpoint", index });
  });
}

function kill(game: Game): void {
  if (game.status === "dead" || game.status === "over") return;
  // A joyride has no beacons to go back to, so going down ends the run.
  game.status = game.player.mode === "joyride" ? "over" : "dead";
  game.respawnIn = RESPAWN_DELAY;
  game.shake = 1;
  game.events.push({ kind: "died" });
  burst(game.particles, game.rng, game.player.body.x, chestY(game.player), 0x4a7fd8, 26, 8);
}

function respawn(game: Game): void {
  const at = game.checkpoint;
  game.player = createPlayer(at.x, at.y, game.player.ability, game.player.mode);
  game.player.health = MAX_HEALTH;
  game.status = "playing";
  game.bullets.length = 0;
  // Clear the welcoming party, and re-arm it so the fight is there next time.
  for (let index = game.zombies.length - 1; index >= 0; index--) {
    const zombie = game.zombies[index];
    if (!zombie) continue;
    if (Math.abs(zombie.body.x - at.x) < WAKE_RANGE) {
      game.armed[zombie.origin] = true;
      game.zombies.splice(index, 1);
    }
  }
}
