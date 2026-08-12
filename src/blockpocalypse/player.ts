import { applyRope, raycast, ROPE_MIN, ROPE_REEL_SPEED, type Rope } from "./grapple";
import type { InputState } from "./input";
import { createBody, moveBody, overlapsSolid, restingOnGround, type Body } from "./physics";
import type { World } from "./world";

export const PLAYER_WIDTH = 0.7;
export const PLAYER_HEIGHT = 1.7;
export const MAX_HEALTH = 5;

export const RUN_SPEED = 7.5;
export const GROUND_ACCEL = 70;
export const AIR_ACCEL = 34;
export const FRICTION = 60;
export const GRAVITY = 34;
export const MAX_FALL = 36;
/** Straight up this clears about three and a bit blocks. */
export const JUMP_SPEED = 15;
/** Fraction of the jump kept when the button is let go early, so a tap hops. */
export const JUMP_CUT = 0.35;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.12;

export const FIRE_INTERVAL = 0.14;
export const BULLET_SPEED = 42;
export const RECOIL = 0.8;

export const HOOK_RANGE = 17;
export const HOOK_SPEED = 70;
/** Sideways push while swinging: the difference between hanging and flying. */
export const SWING_ACCEL = 26;
/** Jumping off a taut rope kicks you up as well as letting go. */
export const SWING_LAUNCH = 6.5;

/**
 * Strong enough to arrest a full-speed fall in about half a second — the
 * jetpack is the forgiving option, and one that needs anticipating is not.
 */
export const JET_THRUST = 92;
/** Climb rate it settles at. A rocket would be harder to aim than the hook. */
export const JET_MAX_RISE = 8;
/** Seconds of burn in a full tank: about twelve blocks of climb. */
export const JET_FUEL = 1.6;
/** Seconds of fuel won back per second stood on something solid. */
export const JET_REFILL = 1.4;

/** Joyride: the pace it sets off at, what it works up to, and how fast. */
export const JOY_SPEED = 11.5;
export const JOY_TOP_SPEED = 18;
/** Blocks flown per extra block per second of pace. */
export const JOY_RAMP = 190;
export const JOY_THRUST = 68;
export const JOY_MAX_RISE = 11;
/** A gentler terminal drop than the city's, so a dive stays recoverable. */
export const JOY_MAX_FALL = 24;

export const INVULN_TIME = 1.1;
/** Where the rope ties on, as a fraction of the player's height. */
export const CHEST = 0.62;

export interface Hook {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  bx: number;
  by: number;
  sticks: boolean;
}

/**
 * The one piece of kit that gets you over what you cannot jump. A run is
 * played with exactly one of them, chosen before it starts.
 */
export type Ability = "hook" | "jetpack";

export const ABILITIES: readonly Ability[] = ["hook", "jetpack"];

export function isAbility(value: string): value is Ability {
  return (ABILITIES as readonly string[]).includes(value);
}

/**
 * Which game is being played. `city` is the one you walk; `joyride` runs east
 * on its own and leaves you only one thing to do — hold to climb, let go to
 * drop — which is the whole of an auto-runner.
 */
export type Mode = "city" | "joyride";

export interface Player {
  mode: Mode;
  ability: Ability;
  body: Body;
  facing: number;
  aimAngle: number;
  health: number;
  invuln: number;
  coyote: number;
  jumpBuffer: number;
  fireCooldown: number;
  hook: Hook | null;
  rope: Rope | null;
  /** Seconds of burn left. Full and idle for anyone carrying the hook. */
  fuel: number;
  thrusting: boolean;
  walkPhase: number;
  alive: boolean;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function createPlayer(
  x: number,
  y: number,
  ability: Ability = "hook",
  mode: Mode = "city",
): Player {
  return {
    mode,
    ability,
    body: createBody(x, y, PLAYER_WIDTH, PLAYER_HEIGHT),
    facing: 1,
    aimAngle: 0,
    health: MAX_HEALTH,
    invuln: 0,
    coyote: 0,
    jumpBuffer: 0,
    fireCooldown: 0,
    hook: null,
    rope: null,
    fuel: JET_FUEL,
    thrusting: false,
    walkPhase: 0,
    alive: true,
  };
}

export function chestY(player: Player): number {
  return player.body.y + PLAYER_HEIGHT * CHEST;
}

/**
 * Advances the player one tick and returns the shot fired this tick, if any.
 * Everything the player can do lives here; the caller only decides what the
 * bullet then hits.
 */
export function stepPlayer(
  world: World,
  player: Player,
  input: InputState,
  dt: number,
): Shot | null {
  const body = player.body;
  const joyride = player.mode === "joyride";
  // A joyride has no crosshair: there is one direction to shoot, and the
  // difficulty is which height you are at when the shot goes off.
  const aimDx = joyride ? 1 : input.aimX - body.x;
  const aimDy = joyride ? 0 : input.aimY - chestY(player);
  player.aimAngle = joyride ? 0 : Math.atan2(aimDy, aimDx);
  if (!joyride && Math.abs(aimDx) > 0.2) player.facing = aimDx > 0 ? 1 : -1;
  if (joyride) player.facing = 1;

  player.invuln = Math.max(0, player.invuln - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);

  if (player.mode === "joyride") flyOn(player, input, dt);
  else steerCity(world, player, input, aimDx, aimDy, dt);

  moveBody(world, body, dt);
  if (player.rope) holdRope(world, player);

  const grounded = restingOnGround(world, body);
  body.onGround = grounded;
  if (grounded && player.mode === "city") {
    player.fuel = Math.min(JET_FUEL, player.fuel + JET_REFILL * dt);
  }
  player.coyote = grounded ? COYOTE_TIME : Math.max(0, player.coyote - dt);
  player.walkPhase += Math.abs(body.vx) * dt * 1.8;

  if (input.shoot && player.fireCooldown === 0) {
    player.fireCooldown = FIRE_INTERVAL;
    const angle = player.aimAngle;
    // No recoil on a joyride: it fights the auto-run, and a gun that slows you
    // down turns "shoot the thing" into a trade nobody asked for.
    if (!joyride) body.vx -= Math.cos(angle) * RECOIL;
    return {
      x: body.x + Math.cos(angle) * 0.7,
      y: chestY(player) + Math.sin(angle) * 0.7,
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
    };
  }
  return null;
}

/** Running, jumping, the hook and the tank: everything the city run can do. */
function steerCity(
  world: World,
  player: Player,
  input: InputState,
  aimDx: number,
  aimDy: number,
  dt: number,
): void {
  const body = player.body;
  if (player.ability === "hook") stepHook(world, player, input, aimDx, aimDy, dt);

  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (player.rope) swing(player, direction, dt);
  else walk(body, direction, dt);

  body.vy -= GRAVITY * dt;
  if (body.vy < -MAX_FALL) body.vy = -MAX_FALL;

  player.jumpBuffer = input.jumpPressed ? JUMP_BUFFER : Math.max(0, player.jumpBuffer - dt);
  if (player.jumpBuffer > 0 && (player.coyote > 0 || player.rope)) {
    if (player.rope) {
      player.rope = null;
      body.vy = Math.max(body.vy, 0) + SWING_LAUNCH;
    } else {
      body.vy = JUMP_SPEED;
    }
    player.jumpBuffer = 0;
    player.coyote = 0;
  }
  const cut = JUMP_SPEED * JUMP_CUT;
  if (!input.jumpHeld && !player.rope && body.vy > cut) body.vy = cut;
  if (player.ability === "jetpack") thrust(player, input, dt);
}

/**
 * The whole of the joyride: east on its own, at a pace that creeps up with
 * the distance flown, and one button that decides only whether you are going
 * up or coming down. No jump, no tank, and nothing to aim.
 */
function flyOn(player: Player, input: InputState, dt: number): void {
  const body = player.body;
  const pace = Math.min(JOY_TOP_SPEED, JOY_SPEED + body.x / JOY_RAMP);
  body.vx += (pace - body.vx) * Math.min(1, dt * 6);

  player.thrusting = input.jumpHeld;
  if (player.thrusting && body.vy < JOY_MAX_RISE) {
    body.vy = Math.min(body.vy + JOY_THRUST * dt, JOY_MAX_RISE);
  } else {
    body.vy -= GRAVITY * dt;
  }
  if (body.vy < -JOY_MAX_FALL) body.vy = -JOY_MAX_FALL;
}

function walk(body: Body, direction: number, dt: number): void {
  const accel = body.onGround ? GROUND_ACCEL : AIR_ACCEL;
  if (direction !== 0) {
    body.vx += direction * accel * dt;
    body.vx = Math.max(-RUN_SPEED, Math.min(RUN_SPEED, body.vx));
  } else if (body.onGround) {
    const drop = FRICTION * dt;
    body.vx = Math.abs(body.vx) <= drop ? 0 : body.vx - Math.sign(body.vx) * drop;
  }
}

/**
 * Holding the jump key in the air burns fuel and lifts. It runs after the
 * jump so the two stack — a jump then a held key is one continuous climb —
 * and it only pushes a body that is rising slower than the climb rate, so it
 * never brakes the jump it is stacked on.
 */
function thrust(player: Player, input: InputState, dt: number): void {
  player.thrusting = false;
  if (!input.jumpHeld || player.body.onGround || player.fuel <= 0) return;
  player.thrusting = true;
  player.fuel = Math.max(0, player.fuel - dt);
  if (player.body.vy < JET_MAX_RISE) {
    player.body.vy = Math.min(player.body.vy + JET_THRUST * dt, JET_MAX_RISE);
  }
}

/**
 * On a rope the keys push sideways and nothing else: `applyRope` spends
 * whatever of that pull runs along the rope, leaving the arc. Pushing along
 * the tangent directly would need a sign rule for hanging above the anchor,
 * and would feel like steering rather than pumping a swing.
 */
function swing(player: Player, direction: number, dt: number): void {
  if (direction === 0) return;
  player.body.vx += direction * SWING_ACCEL * dt;
}

function stepHook(
  world: World,
  player: Player,
  input: InputState,
  aimDx: number,
  aimDy: number,
  dt: number,
): void {
  if (!input.grapple) {
    player.hook = null;
    player.rope = null;
    return;
  }

  if (player.rope) {
    if (!world.isSolid(player.rope.bx, player.rope.by)) {
      player.rope = null;
      return;
    }
    if (input.reelIn) player.rope.length = Math.max(ROPE_MIN, player.rope.length - ROPE_REEL_SPEED * dt);
    if (input.reelOut) player.rope.length = Math.min(HOOK_RANGE, player.rope.length + ROPE_REEL_SPEED * dt);
    return;
  }

  if (!player.hook) {
    player.hook = fireHook(world, player, aimDx, aimDy);
    return;
  }

  const hook = player.hook;
  const dx = hook.targetX - hook.x;
  const dy = hook.targetY - hook.y;
  const remaining = Math.hypot(dx, dy);
  const travel = HOOK_SPEED * dt;
  if (remaining > travel) {
    hook.x += (dx / remaining) * travel;
    hook.y += (dy / remaining) * travel;
    return;
  }
  hook.x = hook.targetX;
  hook.y = hook.targetY;
  if (!hook.sticks) {
    player.hook = null;
    return;
  }
  player.hook = null;
  player.rope = {
    anchorX: hook.x,
    anchorY: hook.y,
    bx: hook.bx,
    by: hook.by,
    length: Math.max(ROPE_MIN, Math.hypot(player.body.x - hook.x, chestY(player) - hook.y)),
  };
}

function fireHook(world: World, player: Player, aimDx: number, aimDy: number): Hook {
  const ox = player.body.x;
  const oy = chestY(player);
  const hit = raycast(world, ox, oy, aimDx, aimDy, HOOK_RANGE);
  if (hit) {
    return { x: ox, y: oy, targetX: hit.x, targetY: hit.y, bx: hit.bx, by: hit.by, sticks: true };
  }
  const length = Math.hypot(aimDx, aimDy) || 1;
  return {
    x: ox,
    y: oy,
    targetX: ox + (aimDx / length) * HOOK_RANGE,
    targetY: oy + (aimDy / length) * HOOK_RANGE,
    bx: -1,
    by: -1,
    sticks: false,
  };
}

/** Pulls the player back to rope's length, unless that would push them into a wall. */
function holdRope(world: World, player: Player): void {
  const rope = player.rope;
  if (!rope) return;
  const body = player.body;
  const held = applyRope(rope, body.x, chestY(player), body.vx, body.vy);
  if (!held.taut) return;
  body.vx = held.vx;
  body.vy = held.vy;
  const y = held.y - PLAYER_HEIGHT * CHEST;
  if (!overlapsSolid(world, held.x, y, body.w, body.h)) {
    body.x = held.x;
    body.y = y;
  }
}

/** Returns false when the hit was shrugged off because the player is still flashing. */
export function hurtPlayer(player: Player, damage: number, fromX: number): boolean {
  if (player.invuln > 0 || !player.alive) return false;
  player.health -= damage;
  player.invuln = INVULN_TIME;
  player.body.vx = player.body.x < fromX ? -7 : 7;
  player.body.vy = 7;
  player.rope = null;
  player.hook = null;
  if (player.health <= 0) {
    player.health = 0;
    player.alive = false;
  }
  return true;
}
