import { describe, expect, it } from "vitest";
import { createGame, stepGame, TICK, type Game } from "./game";
import { emptyInput, type InputState } from "./input";
import { DEATH_Y, GROUND_TOP, NO_PITS_BEFORE } from "./level";
import { MAX_HEALTH } from "./player";
import { createZombie } from "./zombies";

function run(game: Game, ticks: number, edit: (input: InputState, tick: number) => void): void {
  for (let tick = 0; tick < ticks; tick++) {
    const input = emptyInput();
    input.aimX = game.player.body.x + 5;
    input.aimY = game.player.body.y + 1;
    edit(input, tick);
    stepGame(game, input, TICK);
  }
}

describe("stepGame", () => {
  it("leaves the player standing on the street when nothing is pressed", () => {
    const game = createGame(11);
    run(game, 240, () => {});
    expect(game.status).toBe("playing");
    expect(game.player.body.y).toBeCloseTo(GROUND_TOP, 2);
    expect(game.player.health).toBe(MAX_HEALTH);
  });

  it("walks the player to the right and wakes the city up", () => {
    const game = createGame(11);
    run(game, 600, (input) => {
      input.right = true;
    });
    expect(game.player.body.x).toBeGreaterThan(game.level.spawnX + 10);
    expect(game.zombies.length).toBeGreaterThan(0);
  });

  // Nothing in the road up to the first pit may need the hook, and none of it
  // may kill: a pit used to open right after the runway, and a rubble mound
  // used to present a five-block wall to anyone coming from the west. The
  // city is emptied first, so this is about the ground and not about a fight.
  it.each([11, 42, 777, 20240, 5, 3, 88, 1234, 60606, 7, 4096, 31337])(
    "lets running and jumping alone cross the opening city (seed %i)",
    (seed) => {
      const game = createGame(seed);
      game.level.zombieSpawns.length = 0;
      const target = NO_PITS_BEFORE - 6;
      for (let tick = 0; tick < 2400 && game.player.body.x < target; tick++) {
        const input = emptyInput();
        input.right = true;
        // Held rather than tapped: a tap is a hop of under two blocks, and a
        // parked car is two blocks tall.
        input.jumpPressed = tick % 40 === 0;
        input.jumpHeld = true;
        stepGame(game, input, TICK);
      }
      expect(game.status).toBe("playing");
      expect(game.player.body.x).toBeGreaterThanOrEqual(target);
    },
  );

  it("jumps, and only once per press", () => {
    const game = createGame(11);
    run(game, 60, () => {});
    const ground = game.player.body.y;
    run(game, 20, (input, tick) => {
      input.jumpPressed = tick === 0;
      input.jumpHeld = true;
    });
    expect(game.player.body.y).toBeGreaterThan(ground + 1.5);
  });

  it("sends the player back to the last beacon after a fall", () => {
    const game = createGame(11);
    const beacon = game.level.checkpoints[0];
    expect(beacon).toBeDefined();
    game.checkpoint = { x: beacon!.x, y: beacon!.y };
    game.player.body.y = DEATH_Y - 1;
    run(game, 1, () => {});
    expect(game.status).toBe("dead");
    run(game, 300, () => {});
    expect(game.status).toBe("playing");
    expect(game.player.body.x).toBeCloseTo(beacon!.x, 5);
    expect(game.player.health).toBe(MAX_HEALTH);
  });

  it("counts a kill when the shooting connects", () => {
    const game = createGame(11);
    game.zombies.push(createZombie("walker", game.player.body.x + 7, GROUND_TOP, 0));
    run(game, 180, (input) => {
      input.shoot = true;
      const zombie = game.zombies[0];
      if (zombie) {
        input.aimX = zombie.body.x;
        input.aimY = zombie.body.y + zombie.body.h / 2;
      }
    });
    expect(game.kills).toBe(1);
  });

  it("takes a heart off the player a zombie walks into", () => {
    const game = createGame(11);
    game.zombies.push(createZombie("walker", game.player.body.x + 3, GROUND_TOP, 0));
    run(game, 180, () => {});
    expect(game.player.health).toBe(MAX_HEALTH - 1);
  });

  it("keeps the gear that was picked across a respawn", () => {
    const game = createGame(11, "jetpack");
    expect(game.player.ability).toBe("jetpack");
    game.player.body.y = DEATH_Y - 1;
    run(game, 1, () => {});
    run(game, 300, () => {});
    expect(game.status).toBe("playing");
    expect(game.player.ability).toBe("jetpack");
  });

  it("declares the run won at the helipad", () => {
    const game = createGame(11);
    game.player.body.x = game.level.goalX;
    game.player.body.y = game.level.goalY + 1;
    run(game, 1, () => {});
    expect(game.status).toBe("won");
  });

  it("survives a long unattended run without throwing", () => {
    const game = createGame(2024);
    expect(() =>
      run(game, 3000, (input, tick) => {
        input.right = tick % 300 < 220;
        input.jumpPressed = tick % 47 === 0;
        input.jumpHeld = tick % 47 < 12;
        input.shoot = tick % 13 === 0;
      }),
    ).not.toThrow();
  });
});
