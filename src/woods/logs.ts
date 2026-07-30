import type { Pos } from "./walker";

// The logs a felled tree leaves. They burst out of the stump, hop once or twice,
// and then lie there until someone walks over them. World pixels throughout, plus
// a `z` that is only ever height off the ground — nothing else in Whispering
// Woods leaves the floor.

export const LOGS_PER_TREE = 3;

export const BURST_OUT = 34; // sideways speed out of the stump, world px/s
export const BURST_UP = 52; // and upwards
export const GRAVITY = 260; // world px/s²
export const BOUNCE = 0.4; // share of the fall kept on each bounce
export const REST_SPEED = 8; // below this a bounce is not worth drawing
export const DRAG = 0.6; // sideways speed kept per bounce, so they stop rolling

/** How near the feet have to be to sweep a log up, in world pixels. */
export const PICKUP_RANGE = 10;

// Out and towards the front of the stump: logs landing behind it would sit under
// the next tree's crown, where nobody would find them.
const SPREAD: ReadonlyArray<Pos> = [
  { x: -0.9, y: 0.45 },
  { x: 0, y: 1 },
  { x: 0.9, y: 0.45 },
];

export interface Log {
  x: number;
  y: number;
  z: number; // height off the ground
  vx: number;
  vy: number;
  vz: number;
  resting: boolean;
}

export class Logs {
  private logs: Log[] = [];
  collected = 0;

  /** Burst `LOGS_PER_TREE` logs out of a stump. */
  spawn(at: Pos): void {
    for (let i = 0; i < LOGS_PER_TREE; i++) {
      const dir = SPREAD[i % SPREAD.length]!;
      this.logs.push({
        x: at.x,
        y: at.y,
        z: 0,
        vx: dir.x * BURST_OUT,
        vy: dir.y * BURST_OUT,
        vz: BURST_UP,
        resting: false,
      });
    }
  }

  list(): readonly Log[] {
    return this.logs;
  }

  /** Move the logs, then sweep up any the feet are standing over. Returns how many. */
  update(dt: number, feet: Pos): number {
    for (const log of this.logs) {
      if (log.resting) continue;
      log.vz -= GRAVITY * dt;
      log.x += log.vx * dt;
      log.y += log.vy * dt;
      log.z += log.vz * dt;
      if (log.z > 0) continue;
      // Landed: bounce back up with less of everything, or give up and lie still.
      log.z = 0;
      const rebound = -log.vz * BOUNCE;
      if (rebound < REST_SPEED) {
        log.resting = true;
        log.vx = 0;
        log.vy = 0;
        log.vz = 0;
      } else {
        log.vz = rebound;
        log.vx *= DRAG;
        log.vy *= DRAG;
      }
    }

    const before = this.logs.length;
    // Only what has settled: a log still in the air is on its way out of the
    // stump, and snatching it mid-flight looks like it was never thrown.
    this.logs = this.logs.filter(
      (log) => !(log.resting && Math.hypot(log.x - feet.x, log.y - feet.y) <= PICKUP_RANGE),
    );
    const taken = before - this.logs.length;
    this.collected += taken;
    return taken;
  }
}
