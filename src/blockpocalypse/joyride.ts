import {
  COIN,
  CONCRETE,
  DIRT,
  EMITTER,
  HELIPAD,
  LASER,
  LASER_UP,
  PIPE,
  SIDEWALK,
  STEEL,
  VENT,
  WINDOW_LIT,
} from "./blocks";
import type { Level, ZombieSpawn } from "./level";
import { chance, mulberry32, randInt } from "./rng";
import { World } from "./world";

export const JOYRIDE_WIDTH = 2200;
export const JOYRIDE_HEIGHT = 34;
/** Top surface of the floor: the lowest a body can be. */
export const JOY_FLOOR = 6;
/** First solid row of the ceiling, so the corridor is `JOY_FLOOR`..`JOY_CEIL - 1`. */
export const JOY_CEIL = 23;
/** Flat, empty corridor before the first beam. */
export const JOY_SAFE_START = 46;
/** Nothing narrower than this is ever left to fly through. */
export const JOY_MIN_GAP = 5;

/**
 * A long service tunnel under the city: floor, ceiling, and a run of laser
 * barriers with coins strung between them. Nothing in the corridor is solid —
 * every obstacle is something you fly through and regret, which is what keeps
 * an auto-runner from ever pinning you against a wall it will not let go of.
 */
export function generateJoyride(seed: number): Level {
  const rng = mulberry32(seed ^ 0x10ade);
  const world = new World(JOYRIDE_WIDTH, JOYRIDE_HEIGHT);

  layTunnel(world, rng);

  const zombieSpawns: ZombieSpawn[] = [];
  let x = JOY_SAFE_START;
  const finishX = JOYRIDE_WIDTH - 30;
  while (x < finishX - 30) {
    const roll = rng();
    if (roll < 0.3) x += verticalBeam(world, rng, x);
    else if (roll < 0.54) x += horizontalBeam(world, rng, x);
    else if (roll < 0.68) x += beamComb(world, rng, x);
    else if (roll < 0.86) x += patrol(rng, x, zombieSpawns);
    else x += coinRun(world, rng, x);
    x += randInt(rng, 6, 13);
  }

  buildFinish(world, finishX);

  return {
    world,
    spawnX: 8.5,
    spawnY: JOY_FLOOR,
    checkpoints: [],
    zombieSpawns,
    goalX: finishX + 4,
    goalY: JOY_FLOOR + 1,
    skyline: Array.from({ length: JOYRIDE_WIDTH }, () => randInt(rng, 5, 16)),
  };
}

function layTunnel(world: World, rng: () => number): void {
  world.fill(0, 0, JOYRIDE_WIDTH - 1, JOY_FLOOR - 1, DIRT);
  world.fill(0, JOY_FLOOR - 1, JOYRIDE_WIDTH - 1, JOY_FLOOR - 1, SIDEWALK);
  world.fill(0, JOY_CEIL, JOYRIDE_WIDTH - 1, JOYRIDE_HEIGHT - 1, CONCRETE);
  world.fillBack(0, JOY_FLOOR, JOYRIDE_WIDTH - 1, JOY_CEIL - 1, CONCRETE);

  // Somewhere to look at while you fly. Nothing that goes in the corridor
  // itself may be solid: at this pace a single block to bump into is a run
  // over, so the scenery is either walked through or painted on the far wall.
  for (let x = 2; x < JOYRIDE_WIDTH - 2; x++) {
    if (chance(rng, 0.12)) world.set(x, JOY_CEIL - 1, PIPE);
    if (chance(rng, 0.07)) world.fillBack(x, JOY_FLOOR, x, JOY_FLOOR, STEEL);
    if (chance(rng, 0.05)) world.fillBack(x, JOY_CEIL - 2, x, JOY_CEIL - 2, VENT);
    if (chance(rng, 0.03)) {
      const y = randInt(rng, JOY_FLOOR + 3, JOY_CEIL - 3);
      world.fillBack(x, y, x, y, WINDOW_LIT);
    }
  }
  world.fill(0, JOY_FLOOR, JOY_SAFE_START, JOY_CEIL - 1, 0);
}

/** A beam standing off the floor or hanging from the ceiling, gap at the far end. */
function verticalBeam(world: World, rng: () => number, x: number): number {
  const span = JOY_CEIL - JOY_FLOOR;
  const length = randInt(rng, 4, span - JOY_MIN_GAP);
  const fromFloor = chance(rng, 0.5);
  const y0 = fromFloor ? JOY_FLOOR : JOY_CEIL - length;
  world.fill(x, y0, x, y0 + length - 1, LASER_UP);
  world.set(x, fromFloor ? y0 + length - 1 : y0, EMITTER);
  world.set(x, fromFloor ? JOY_FLOOR : JOY_CEIL - 1, EMITTER);
  // Coins in the gap, so the way through is also the way to be paid.
  const gapMiddle = fromFloor
    ? Math.floor((y0 + length + JOY_CEIL) / 2)
    : Math.floor((JOY_FLOOR + y0) / 2);
  for (let step = -1; step <= 1; step++) world.set(x + step, gapMiddle, COIN);
  return 2;
}

/** A beam lying across the tunnel, with clear air above and below it. */
function horizontalBeam(world: World, rng: () => number, x: number): number {
  const length = randInt(rng, 5, 11);
  const y = randInt(rng, JOY_FLOOR + 4, JOY_CEIL - 5);
  world.fill(x, y, x + length - 1, y, LASER);
  world.set(x, y, EMITTER);
  world.set(x + length - 1, y, EMITTER);
  const above = chance(rng, 0.5);
  const lane = above ? y + 3 : y - 3;
  for (let step = 1; step < length - 1; step += 2) world.set(x + step, lane, COIN);
  return length;
}

/**
 * Teeth from both sides at once, offset so there is always a way through —
 * the gap between two facing beams is never below `JOY_MIN_GAP`.
 */
function beamComb(world: World, rng: () => number, x: number): number {
  const teeth = randInt(rng, 2, 4);
  const span = JOY_CEIL - JOY_FLOOR;
  let at = x;
  for (let tooth = 0; tooth < teeth; tooth++) {
    const fromFloor = tooth % 2 === 0;
    const length = randInt(rng, 3, Math.max(3, span - JOY_MIN_GAP - 2));
    const y0 = fromFloor ? JOY_FLOOR : JOY_CEIL - length;
    world.fill(at, y0, at, y0 + length - 1, LASER_UP);
    world.set(at, fromFloor ? JOY_FLOOR : JOY_CEIL - 1, EMITTER);
    at += randInt(rng, 5, 8);
  }
  return at - x;
}

/**
 * A line of flyers coming the other way, stacked across a couple of lanes.
 * They are the only thing in the tunnel worth shooting, and the only thing
 * that can be shot instead of dodged.
 */
function patrol(rng: () => number, x: number, spawns: ZombieSpawn[]): number {
  const count = randInt(rng, 2, 4);
  const lane = randInt(rng, JOY_FLOOR + 2, JOY_CEIL - 4);
  for (let index = 0; index < count; index++) {
    spawns.push({
      x: x + index * randInt(rng, 3, 6),
      y: chance(rng, 0.35) ? randInt(rng, JOY_FLOOR + 1, JOY_CEIL - 3) : lane,
      kind: "flyer",
    });
  }
  return count * 4;
}

/** A payday: a slow arc of coins across an empty stretch. */
function coinRun(world: World, rng: () => number, x: number): number {
  const length = randInt(rng, 10, 18);
  const centre = (JOY_FLOOR + JOY_CEIL) / 2;
  const swing = randInt(rng, 3, 6);
  const phase = rng() * Math.PI * 2;
  for (let step = 0; step < length; step++) {
    const y = Math.round(centre + Math.sin(phase + step * 0.45) * swing);
    world.set(x + step, Math.max(JOY_FLOOR, Math.min(JOY_CEIL - 1, y)), COIN);
  }
  return length;
}

function buildFinish(world: World, x: number): void {
  world.fill(x - 2, JOY_FLOOR, x + 10, JOY_CEIL - 1, 0);
  world.fill(x, JOY_FLOOR - 1, x + 8, JOY_FLOOR - 1, HELIPAD);
  world.fillBack(x - 2, JOY_FLOOR, x + 10, JOY_CEIL - 1, CONCRETE);
}
