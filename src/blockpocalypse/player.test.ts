import { beforeEach, describe, expect, it } from "vitest";
import { CONCRETE, STEEL } from "./blocks";
import { emptyInput, type InputState } from "./input";
import {
  createPlayer,
  hurtPlayer,
  HOOK_RANGE,
  JET_FUEL,
  JET_MAX_RISE,
  JUMP_SPEED,
  MAX_HEALTH,
  chestY,
  stepPlayer,
  type Player,
} from "./player";
import { World } from "./world";

const TICK = 1 / 120;

/** A floor at row 4 and a girder at row 20, ten blocks over the player's head. */
function swingRoom(): World {
  const world = new World(60, 40);
  world.fill(0, 0, 59, 4, CONCRETE);
  world.fill(0, 20, 59, 20, STEEL);
  return world;
}

function grappleAt(x: number, y: number): InputState {
  const input = emptyInput();
  input.grapple = true;
  input.aimX = x;
  input.aimY = y;
  return input;
}

function run(world: World, player: Player, ticks: number, input: InputState): void {
  for (let tick = 0; tick < ticks; tick++) stepPlayer(world, player, input, TICK);
}

describe("the grappling hook", () => {
  let world: World;
  let player: Player;

  beforeEach(() => {
    world = swingRoom();
    player = createPlayer(30, 5);
  });

  it("bites into the girder it is aimed at", () => {
    run(world, player, 60, grappleAt(30, 25));
    expect(player.rope).not.toBeNull();
    expect(player.rope?.by).toBe(20);
  });

  it("comes back empty when it is fired at open sky", () => {
    const open = new World(60, 40);
    open.fill(0, 0, 59, 4, CONCRETE);
    const falling = createPlayer(30, 5);
    run(open, falling, 60, grappleAt(30, 25));
    expect(falling.rope).toBeNull();
  });

  it("does not reach past its own range", () => {
    const world = new World(60, 60);
    world.fill(0, 0, 59, 4, CONCRETE);
    world.fill(0, 50, 59, 50, STEEL);
    const short = createPlayer(30, 5);
    expect(50 - chestY(short)).toBeGreaterThan(HOOK_RANGE);
    run(world, short, 120, grappleAt(30, 55));
    expect(short.rope).toBeNull();
  });

  it("catches a fall that would otherwise have ended on the floor", () => {
    player.body.y = 8;
    run(world, player, 240, grappleAt(30, 25));
    expect(player.rope).not.toBeNull();
    expect(player.body.onGround).toBe(false);

    const dropped = createPlayer(30, 8);
    run(world, dropped, 240, emptyInput());
    expect(dropped.body.onGround).toBe(true);
    expect(player.body.y).toBeGreaterThan(dropped.body.y + 2);
  });

  it("swings sideways when the run keys are held on the rope", () => {
    player.body.y = 8;
    run(world, player, 60, grappleAt(30, 25));
    const startX = player.body.x;
    const input = grappleAt(30, 25);
    input.right = true;
    run(world, player, 120, input);
    expect(player.body.x).toBeGreaterThan(startX + 1);
  });

  it("climbs the rope on reel-in and lets it back out", () => {
    player.body.y = 8;
    run(world, player, 60, grappleAt(30, 25));
    const slack = player.rope?.length ?? 0;
    const up = grappleAt(30, 25);
    up.reelIn = true;
    run(world, player, 60, up);
    expect(player.rope?.length).toBeLessThan(slack);
  });

  it("drops the rope the moment the button is let go", () => {
    player.body.y = 8;
    run(world, player, 60, grappleAt(30, 25));
    expect(player.rope).not.toBeNull();
    run(world, player, 1, emptyInput());
    expect(player.rope).toBeNull();
  });

  it("launches off the rope on jump instead of cutting it dead", () => {
    player.body.y = 8;
    run(world, player, 90, grappleAt(30, 25));
    const input = grappleAt(30, 25);
    input.jumpPressed = true;
    input.jumpHeld = true;
    stepPlayer(world, player, input, TICK);
    expect(player.rope).toBeNull();
    expect(player.body.vy).toBeGreaterThan(0);
  });

  it("drops the rope when the block it bit is shot away", () => {
    player.body.y = 8;
    run(world, player, 60, grappleAt(30, 25));
    const rope = player.rope;
    expect(rope).not.toBeNull();
    world.set(rope!.bx, rope!.by, 0);
    run(world, player, 1, grappleAt(30, 25));
    expect(player.rope).toBeNull();
  });
});

describe("the jetpack", () => {
  const flying = (): InputState => {
    const input = emptyInput();
    input.jumpHeld = true;
    return input;
  };

  it("climbs while the key is held, instead of falling", () => {
    const world = swingRoom();
    const player = createPlayer(30, 12, "jetpack");
    run(world, player, 60, flying());
    expect(player.body.y).toBeGreaterThan(12);
    expect(player.thrusting).toBe(true);
  });

  it("settles at its climb rate rather than accelerating away", () => {
    const world = swingRoom();
    const player = createPlayer(30, 8, "jetpack");
    run(world, player, 90, flying());
    expect(player.body.vy).toBeLessThanOrEqual(JET_MAX_RISE + 1e-6);
  });

  it("does not brake the jump it is stacked on", () => {
    const world = swingRoom();
    const player = createPlayer(30, 5, "jetpack");
    const input = flying();
    input.jumpPressed = true;
    stepPlayer(world, player, input, TICK);
    input.jumpPressed = false;
    stepPlayer(world, player, input, TICK);
    expect(player.body.vy).toBeGreaterThan(JET_MAX_RISE);
  });

  it("burns the tank dry and then falls", () => {
    const world = swingRoom();
    const player = createPlayer(30, 12, "jetpack");
    run(world, player, Math.ceil((JET_FUEL + 0.2) / TICK), flying());
    expect(player.fuel).toBe(0);
    expect(player.thrusting).toBe(false);
    expect(player.body.vy).toBeLessThan(0);
  });

  it("fills the tank back up on the ground", () => {
    const world = swingRoom();
    const player = createPlayer(30, 12, "jetpack");
    run(world, player, Math.ceil(JET_FUEL / TICK) + 60, flying());
    expect(player.fuel).toBe(0);
    run(world, player, 600, emptyInput());
    expect(player.body.onGround).toBe(true);
    expect(player.fuel).toBe(JET_FUEL);
  });

  it("stays on the ground when the key is held there", () => {
    const world = swingRoom();
    const player = createPlayer(30, 5, "jetpack");
    const input = emptyInput();
    input.jumpHeld = true; // held, but never pressed, so no jump either
    run(world, player, 120, input);
    expect(player.body.onGround).toBe(true);
    expect(player.thrusting).toBe(false);
    expect(player.fuel).toBe(JET_FUEL);
  });

  it("is the only gear in play: no hook comes out", () => {
    const world = swingRoom();
    const player = createPlayer(30, 8, "jetpack");
    run(world, player, 120, grappleAt(30, 25));
    expect(player.rope).toBeNull();
    expect(player.hook).toBeNull();
  });

  it("leaves a hook carrier's jump and fuel alone", () => {
    const world = swingRoom();
    const player = createPlayer(30, 12, "hook");
    run(world, player, 60, flying());
    expect(player.thrusting).toBe(false);
    expect(player.body.y).toBeLessThan(12);
  });
});

describe("stepPlayer", () => {
  it("jumps roughly three blocks from a standstill", () => {
    const world = swingRoom();
    const player = createPlayer(30, 5);
    const input = emptyInput();
    input.jumpPressed = true;
    input.jumpHeld = true;
    let peak = player.body.y;
    for (let tick = 0; tick < 240; tick++) {
      stepPlayer(world, player, input, TICK);
      input.jumpPressed = false;
      peak = Math.max(peak, player.body.y);
    }
    expect(peak - 5).toBeGreaterThan(3);
    expect(peak - 5).toBeLessThan(4);
  });

  it("cuts the jump short when the button is let go", () => {
    const world = swingRoom();
    const player = createPlayer(30, 5);
    const press = emptyInput();
    press.jumpPressed = true;
    press.jumpHeld = true;
    stepPlayer(world, player, press, TICK);
    let peak = player.body.y;
    for (let tick = 0; tick < 240; tick++) {
      stepPlayer(world, player, emptyInput(), TICK);
      peak = Math.max(peak, player.body.y);
    }
    expect(peak - 5).toBeLessThan(3);
    expect(player.body.vy).toBeLessThanOrEqual(JUMP_SPEED);
  });

  it("fires along the line to the crosshair", () => {
    const world = swingRoom();
    const player = createPlayer(30, 5);
    const input = emptyInput();
    input.shoot = true;
    input.aimX = 40;
    input.aimY = chestY(player);
    const shot = stepPlayer(world, player, input, TICK);
    expect(shot).not.toBeNull();
    expect(shot!.vx).toBeGreaterThan(0);
    expect(shot!.vy).toBeCloseTo(0, 6);
  });

  it("shrugs off a second hit while it is still flashing", () => {
    const player = createPlayer(30, 5);
    expect(hurtPlayer(player, 1, 32)).toBe(true);
    expect(hurtPlayer(player, 1, 32)).toBe(false);
    expect(player.health).toBe(MAX_HEALTH - 1);
    expect(player.body.vx).toBeLessThan(0);
  });
});
