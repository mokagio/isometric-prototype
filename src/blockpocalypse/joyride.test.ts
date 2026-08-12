import { describe, expect, it } from "vitest";
import { isHazardBlock, isPrizeBlock } from "./blocks";
import { createGame, stepGame, TICK, type Game } from "./game";
import { emptyInput, type InputState } from "./input";
import {
  generateJoyride,
  JOY_CEIL,
  JOY_FLOOR,
  JOY_MIN_GAP,
  JOY_SAFE_START,
} from "./joyride";
import { MAX_HEALTH } from "./player";
import type { World } from "./world";

const SEEDS = [1, 9, 64, 777, 20240];

function run(game: Game, ticks: number, edit: (input: InputState, tick: number) => void): void {
  for (let tick = 0; tick < ticks; tick++) {
    const input = emptyInput();
    edit(input, tick);
    stepGame(game, input, TICK);
  }
}

/** Cells in the corridor a body can occupy: not solid, not a beam. */
function open(world: World, x: number, y: number): boolean {
  return !world.isSolid(x, y) && !isHazardBlock(world.get(x, y));
}

/**
 * Flies the tunnel on paper, one column at a time. Climbing is slower than
 * falling, so the reach is asymmetric — and deliberately meaner than the real
 * jetpack, so a level this says is flyable has room to spare.
 */
function reachable(world: World): boolean {
  const height = JOY_CEIL - JOY_FLOOR;
  let front = new Set<number>();
  for (let y = JOY_FLOOR; y < JOY_CEIL; y++) {
    if (open(world, 0, y) && open(world, 0, y + 1)) front.add(y);
  }
  for (let x = 1; x < world.width; x++) {
    const next = new Set<number>();
    for (const y of front) {
      for (let step = -2; step <= 1; step++) {
        const to = y + step;
        if (to < JOY_FLOOR || to >= JOY_CEIL) continue;
        // Head and feet both have to fit through.
        if (open(world, x, to) && open(world, x, to + 1)) next.add(to);
      }
    }
    if (next.size === 0) return false;
    front = next;
    if (front.size > height) front = new Set([...front].slice(0, height));
  }
  return true;
}

describe("generateJoyride", () => {
  it("builds the same tunnel twice from the same seed", () => {
    expect(generateJoyride(7).world.data).toEqual(generateJoyride(7).world.data);
    expect(generateJoyride(7).world.data).not.toEqual(generateJoyride(8).world.data);
  });

  it.each(SEEDS)("can be flown from one end to the other (seed %i)", (seed) => {
    expect(reachable(generateJoyride(seed).world)).toBe(true);
  });

  it.each(SEEDS)("never walls the corridor off with solid blocks (seed %i)", (seed) => {
    const world = generateJoyride(seed).world;
    for (let x = 0; x < world.width; x++) {
      let clear = 0;
      for (let y = JOY_FLOOR; y < JOY_CEIL; y++) if (!world.isSolid(x, y)) clear++;
      expect(clear).toBe(JOY_CEIL - JOY_FLOOR);
    }
  });

  it.each(SEEDS)("leaves a way past every beam (seed %i)", (seed) => {
    const world = generateJoyride(seed).world;
    for (let x = 0; x < world.width; x++) {
      let best = 0;
      let run = 0;
      for (let y = JOY_FLOOR; y < JOY_CEIL; y++) {
        run = open(world, x, y) ? run + 1 : 0;
        best = Math.max(best, run);
      }
      expect(best).toBeGreaterThanOrEqual(JOY_MIN_GAP - 1);
    }
  });

  it("opens on an empty stretch, and puts coins out to be had", () => {
    const world = generateJoyride(3).world;
    for (let x = 0; x < JOY_SAFE_START; x++) {
      for (let y = JOY_FLOOR; y < JOY_CEIL; y++) expect(world.get(x, y)).toBe(0);
    }
    const coins = [...world.data].filter((block) => isPrizeBlock(block)).length;
    expect(coins).toBeGreaterThan(200);
  });
});

describe("a joyride run", () => {
  it("carries the player east with nothing pressed", () => {
    const game = createGame(9, "jetpack", "joyride");
    const from = game.player.body.x;
    run(game, 240, () => {});
    expect(game.player.body.x).toBeGreaterThan(from + 15);
    expect(game.status).toBe("playing");
  });

  it("climbs while the button is held and drops when it is let go", () => {
    const game = createGame(9, "jetpack", "joyride");
    run(game, 90, (input) => {
      input.jumpHeld = true;
    });
    const high = game.player.body.y;
    expect(high).toBeGreaterThan(JOY_FLOOR + 4);
    run(game, 90, () => {});
    expect(game.player.body.y).toBeLessThan(high);
  });

  it("keeps speeding up the further it goes", () => {
    const game = createGame(9, "jetpack", "joyride");
    run(game, 120, () => {});
    const early = game.player.body.vx;
    game.player.body.x += 900;
    run(game, 120, () => {});
    expect(game.player.body.vx).toBeGreaterThan(early + 1);
  });

  it("picks up a coin it flies through, once", () => {
    const game = createGame(9, "jetpack", "joyride");
    const body = game.player.body;
    game.world.set(Math.floor(body.x), Math.floor(body.y), 23);
    run(game, 2, () => {});
    expect(game.coins).toBe(1);
    run(game, 30, () => {});
    expect(game.coins).toBe(1);
  });

  it("takes a heart off a beam, and only one per touch", () => {
    const game = createGame(9, "jetpack", "joyride");
    const body = game.player.body;
    game.world.fill(Math.floor(body.x), JOY_FLOOR, Math.floor(body.x), JOY_CEIL - 1, 24);
    run(game, 12, () => {});
    expect(game.player.health).toBe(MAX_HEALTH - 1);
  });

  it("ends the run rather than sending the player back to a beacon", () => {
    const game = createGame(9, "jetpack", "joyride");
    game.player.health = 1;
    const body = game.player.body;
    game.world.fill(Math.floor(body.x), JOY_FLOOR, Math.floor(body.x), JOY_CEIL - 1, 24);
    run(game, 12, () => {});
    expect(game.status).toBe("over");
    run(game, 600, () => {});
    expect(game.status).toBe("over");
  });

  it("is won at the far end", () => {
    const game = createGame(9, "jetpack", "joyride");
    game.player.body.x = game.level.goalX;
    game.player.body.y = game.level.goalY;
    run(game, 1, () => {});
    expect(game.status).toBe("won");
  });
});
