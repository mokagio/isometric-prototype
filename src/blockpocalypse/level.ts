import {
  AIR,
  ASPHALT,
  BEACON,
  BLOOD_BRICK,
  BRICK,
  CAR_BODY,
  CAR_GLASS,
  CONCRETE,
  CRATE,
  DIRT,
  GLASS,
  HELIPAD,
  LAMP_HEAD,
  LAMP_POST,
  PIPE,
  PLANK,
  RUBBLE,
  SIDEWALK,
  SIGN,
  STEEL,
  TYRE,
  VENT,
  WINDOW_LIT,
} from "./blocks";
import { chance, mulberry32, randInt } from "./rng";
import { World } from "./world";

export const LEVEL_WIDTH = 420;
export const LEVEL_HEIGHT = 56;
/**
 * Row the street surface sits at: blocks below are solid, this row is air.
 * Kept shallow — every row under the road is screen the sky could have had.
 */
export const GROUND_TOP = 7;
/** Below this the player has fallen out of the level. */
export const DEATH_Y = -4;

/** Flat, zombie-free ground to find the controls on before anything happens. */
export const SAFE_START = 14;
/**
 * No holes in the road until here. A collapsed street is the one thing that
 * kills outright, and running into one before the first jump is not a lesson.
 */
export const NO_PITS_BEFORE = 52;

export type ZombieKind = "walker" | "runner" | "flyer";

export interface ZombieSpawn {
  x: number;
  y: number;
  kind: ZombieKind;
}

export interface Level {
  world: World;
  spawnX: number;
  spawnY: number;
  checkpoints: Array<{ x: number; y: number }>;
  zombieSpawns: ZombieSpawn[];
  goalX: number;
  goalY: number;
  /** Height of each far-background silhouette column, for the renderer. */
  skyline: number[];
}

export function generateLevel(seed: number): Level {
  const rng = mulberry32(seed);
  const world = new World(LEVEL_WIDTH, LEVEL_HEIGHT);
  const zombieSpawns: ZombieSpawn[] = [];
  const checkpoints: Array<{ x: number; y: number }> = [];

  layStreet(world, rng);

  const towerX = LEVEL_WIDTH - 22;
  let x = SAFE_START;
  let nextCheckpoint = SAFE_START + 60;

  while (x < towerX - 16) {
    if (x >= nextCheckpoint) {
      // The beacon is a pillar to hop over; the checkpoint is the clear
      // pavement just past it, or a respawn would put the player inside it.
      world.fill(x, GROUND_TOP, x, GROUND_TOP + 1, BEACON);
      checkpoints.push({ x: x + 1.5, y: GROUND_TOP });
      nextCheckpoint = x + randInt(rng, 55, 75);
      x += 3;
      continue;
    }

    const roll = x < NO_PITS_BEFORE ? 0.3 + rng() * 0.7 : rng();
    if (roll < 0.3) x += carveGap(world, rng, x);
    else if (roll < 0.66) x += raiseBuilding(world, rng, x, zombieSpawns);
    else if (roll < 0.85) x += hangPlatforms(world, rng, x, zombieSpawns);
    else x += pileRubble(world, rng, x, zombieSpawns);

    // A patrol between the set pieces, so the street is never empty for long.
    if (chance(rng, 0.7)) {
      zombieSpawns.push({
        x: x + randInt(rng, 1, 4),
        y: GROUND_TOP,
        kind: chance(rng, 0.28) ? "runner" : "walker",
      });
    }
    x += randInt(rng, 3, 7);
  }

  const goal = raiseTower(world, rng, towerX, zombieSpawns);
  dressStreet(world, rng, checkpoints);

  return {
    world,
    spawnX: 4.5,
    spawnY: GROUND_TOP,
    checkpoints,
    // Sections are laid down in order and later ones overwrite earlier ones,
    // so a spawn point can end up walled in. Drop those rather than have the
    // game wake a zombie inside a brick.
    zombieSpawns: zombieSpawns.filter((spawn) => standable(world, spawn.x, spawn.y)),
    goalX: goal.x,
    goalY: goal.y,
    skyline: Array.from({ length: LEVEL_WIDTH }, () => randInt(rng, 5, 16)),
  };
}

/**
 * Street furniture, laid on last so it can see the finished city and refuse
 * any spot that is not clear road. Nothing here is taller than a jump, and the
 * lamps and pipes are decoration a body walks straight through.
 */
function dressStreet(
  world: World,
  rng: () => number,
  checkpoints: ReadonlyArray<{ x: number; y: number }>,
): void {
  /**
   * Road wide enough, and sky enough above it. The headroom is the whole
   * point: a crate is only an obstacle if there is room to jump onto it, and
   * one parked under a low gantry is a dead end for anyone without gear. The
   * column either side counts too, since that is where the jump starts.
   */
  const clear = (x: number, width: number, headroom: number): boolean => {
    if (checkpoints.some((point) => Math.abs(point.x - x) < 4)) return false;
    for (let step = -1; step <= width; step++) {
      const column = x + step;
      if (step >= 0 && step < width && !world.isSolid(column, GROUND_TOP - 1)) return false;
      for (let up = 0; up < headroom; up++) {
        if (world.get(column, GROUND_TOP + up) !== AIR) return false;
      }
    }
    return true;
  };

  for (let x = SAFE_START; x < world.width - 26; x++) {
    const roll = rng();
    if (roll < 0.02 && clear(x, 1, 8)) {
      const height = randInt(rng, 3, 5);
      world.fill(x, GROUND_TOP, x, GROUND_TOP + height - 1, LAMP_POST);
      world.set(x, GROUND_TOP + height, LAMP_HEAD);
      x += 3;
    } else if (roll < 0.035 && clear(x, 4, 6)) {
      // A car: wheels under a body, glass on top, and it can be climbed.
      world.fill(x, GROUND_TOP, x + 3, GROUND_TOP, CAR_BODY);
      world.set(x, GROUND_TOP, TYRE);
      world.set(x + 3, GROUND_TOP, TYRE);
      world.fill(x + 1, GROUND_TOP + 1, x + 2, GROUND_TOP + 1, CAR_GLASS);
      x += 6;
    } else if (roll < 0.05 && clear(x, 2, 6)) {
      world.fill(x, GROUND_TOP, x + 1, GROUND_TOP, CRATE);
      if (chance(rng, 0.5)) world.set(x, GROUND_TOP + 1, CRATE);
      x += 3;
    }
  }
}

/** Head and shoulders clear, and something to land on not far below. */
export function standable(world: World, x: number, y: number): boolean {
  const bx = Math.floor(x);
  const by = Math.floor(y);
  if (world.isSolid(bx, by) || world.isSolid(bx, by + 1)) return false;
  for (let depth = 1; depth <= 4; depth++) {
    if (world.isSolid(bx, by - depth)) return true;
  }
  return false;
}

function layStreet(world: World, rng: () => number): void {
  world.fill(0, 0, LEVEL_WIDTH - 1, GROUND_TOP - 1, DIRT);
  for (let x = 0; x < LEVEL_WIDTH; x++) {
    world.set(x, GROUND_TOP - 1, chance(rng, 0.12) ? SIDEWALK : ASPHALT);
    if (chance(rng, 0.04)) world.set(x, GROUND_TOP - 1, RUBBLE);
  }
}

/** A collapsed stretch of road. Wide ones get a girder to swing from. */
function carveGap(world: World, rng: () => number, x: number): number {
  const width = chance(rng, 0.35) ? randInt(rng, 6, 9) : randInt(rng, 3, 4);
  world.fill(x, 0, x + width - 1, GROUND_TOP - 1, AIR);
  world.set(x - 1, GROUND_TOP - 1, BLOOD_BRICK);
  world.set(x + width, GROUND_TOP - 1, BLOOD_BRICK);
  if (width > 4) {
    world.fill(x - 1, GROUND_TOP + 7, x + width, GROUND_TOP + 7, STEEL);
  }
  return width;
}

/**
 * A gutted apartment block. The ground floor is open so it can be run through,
 * and every second storey sticks a fire escape out of the wall, which is the
 * way up for anyone not using the hook yet.
 */
function raiseBuilding(
  world: World,
  rng: () => number,
  x: number,
  spawns: ZombieSpawn[],
): number {
  const width = randInt(rng, 7, 13);
  const height = randInt(rng, 6, 15);
  const top = GROUND_TOP + height;
  const wall = chance(rng, 0.4) ? CONCRETE : BRICK;

  // The room behind the front wall, so a doorway leads somewhere instead of
  // showing the skyline straight through the building.
  world.fillBack(x, GROUND_TOP, x + width - 1, top, wall);

  world.fill(x, GROUND_TOP, x, top - 1, wall);
  world.fill(x + width - 1, GROUND_TOP, x + width - 1, top - 1, wall);
  world.fill(x, top, x + width - 1, top, CONCRETE);

  for (let floor = GROUND_TOP + 4; floor < top - 1; floor += 4) {
    world.fill(x + 1, floor, x + width - 2, floor, PLANK);
    world.fill(x + randInt(rng, 2, width - 4), floor, x + width - 3, floor, AIR);
    if (chance(rng, 0.5)) {
      spawns.push({ x: x + width / 2, y: floor + 1, kind: "walker" });
    }
  }

  // Roughly half the windows still have someone's lights on.
  const pane = (): number => (chance(rng, 0.45) ? WINDOW_LIT : GLASS);
  for (let wy = GROUND_TOP + 2; wy < top - 1; wy += 3) {
    if (chance(rng, 0.75)) world.set(x, wy, pane());
    if (chance(rng, 0.75)) world.set(x + width - 1, wy, pane());
  }

  // Rooftop clutter, and a sign hung off the front.
  for (let prop = x + 1; prop < x + width - 1; prop++) {
    if (chance(rng, 0.22)) world.set(prop, top + 1, chance(rng, 0.5) ? VENT : PIPE);
  }
  if (chance(rng, 0.4)) {
    const signY = GROUND_TOP + randInt(rng, 4, Math.max(4, height - 2));
    world.fill(x - 1, signY, x - 1, signY + 1, SIGN);
  }

  // Ground floor doorways, on both walls, so the building is a corridor.
  world.fill(x, GROUND_TOP, x, GROUND_TOP + 2, AIR);
  world.fill(x + width - 1, GROUND_TOP, x + width - 1, GROUND_TOP + 2, AIR);

  // A zig-zag of fire escapes up the left face: three up and one across is a
  // jump, so the roof is reachable without ever firing the hook. It has to
  // zig — a ledge straight above another one is a ceiling to bang your head on.
  for (let ledge = GROUND_TOP + 3, rung = 0; ledge <= top; ledge += 3, rung++) {
    world.set(x - (rung % 2 === 0 ? 2 : 1), ledge, PLANK);
  }

  if (height > 8) world.fill(x + 1, top + 6, x + width - 2, top + 6, STEEL);
  spawns.push({ x: x + width / 2, y: top + 1, kind: chance(rng, 0.3) ? "runner" : "walker" });
  return width;
}

/** Scaffolding: a short climb that also works as swing anchors. */
function hangPlatforms(
  world: World,
  rng: () => number,
  x: number,
  spawns: ZombieSpawn[],
): number {
  const width = randInt(rng, 8, 14);
  let at = x;
  for (let level = 0; level < 3; level++) {
    const span = randInt(rng, 3, 5);
    const y = GROUND_TOP + 3 + level * randInt(rng, 3, 4);
    world.fill(at, y, at + span - 1, y, STEEL);
    if (level === 2 && chance(rng, 0.5)) {
      spawns.push({ x: at + span / 2, y: y + 1, kind: "walker" });
    }
    at += randInt(rng, 3, 5);
    if (at > x + width) break;
  }
  return width;
}

/**
 * A mound of collapsed masonry. It rises and falls one block at a time, so
 * it is a staircase from either side rather than a wall from the west — and
 * a zombie can follow you over it, which is the point of it.
 */
function pileRubble(
  world: World,
  rng: () => number,
  x: number,
  spawns: ZombieSpawn[],
): number {
  const peak = randInt(rng, 2, 5);
  const width = peak * 2 + 1;
  for (let step = 0; step < width; step++) {
    const height = peak - Math.abs(peak - step);
    if (height > 0) world.fill(x + step, GROUND_TOP, x + step, GROUND_TOP + height - 1, RUBBLE);
  }
  if (chance(rng, 0.5)) {
    spawns.push({ x: x + peak + 0.5, y: GROUND_TOP + peak, kind: "walker" });
  }
  return width + randInt(rng, 1, 3);
}

/** The extraction tower: the only way up is hook and nerve. */
function raiseTower(
  world: World,
  rng: () => number,
  x: number,
  spawns: ZombieSpawn[],
): { x: number; y: number } {
  const width = 10;
  const height = 22;
  const top = GROUND_TOP + height;

  world.fillBack(x, GROUND_TOP, x + width - 1, top, CONCRETE);
  world.fill(x, GROUND_TOP, x + width - 1, top - 1, CONCRETE);
  world.fill(x + 1, GROUND_TOP, x + width - 2, top - 1, AIR);
  world.fill(x, top, x + width - 1, top, CONCRETE);
  world.fill(x + 2, top + 1, x + width - 3, top + 1, HELIPAD);

  for (let ledge = GROUND_TOP + 4; ledge < top - 2; ledge += 5) {
    world.fill(x - 2, ledge, x - 1, ledge, STEEL);
    world.fill(x - 5, ledge + 3, x - 4, ledge + 3, STEEL);
    if (chance(rng, 0.6)) spawns.push({ x: x - 1.5, y: ledge + 1, kind: "walker" });
  }
  world.fill(x - 8, top - 2, x - 3, top - 2, STEEL);
  spawns.push({ x: x + width / 2, y: top + 1, kind: "runner" });
  spawns.push({ x: x + width / 2 - 2, y: top + 1, kind: "walker" });

  return { x: x + width / 2, y: top + 1 };
}
