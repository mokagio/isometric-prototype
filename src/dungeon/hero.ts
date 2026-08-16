import { DOWN, facingFromAxis, type Facing } from "./facing";

// Tuning, in grid cells.
export const SPEED = 5.2; // cells per second
// Half the hero's footprint. Wide enough that she cannot visibly overlap a wall,
// narrow enough to walk a one-cell corridor without scraping.
export const RADIUS = 0.3;
export const KNOCKBACK = 1.2; // cells the hero is shoved by a hit
const KNOCKBACK_DECAY = 12; // per second — the shove launches fast and eases off
const KNOCKBACK_MIN = 0.001; // cells left below which the slide reads as stopped

export interface HeroControls {
  axis: { dc: number; dr: number };
}

export type FloorAt = (col: number, row: number) => boolean;

/** Whether a circle of `RADIUS` centred on (col, row) clears the rock. */
export function fits(isFloor: FloorAt, col: number, row: number): boolean {
  for (const dc of [-RADIUS, RADIUS]) {
    for (const dr of [-RADIUS, RADIUS]) {
      if (!isFloor(Math.round(col + dc), Math.round(row + dr))) return false;
    }
  }
  return true;
}

export class Hero {
  col: number;
  row: number;
  /** Held from the last step taken, so standing still keeps the last heading. */
  facing: Facing = DOWN;
  private kdc = 0; // knockback heading, a unit vector
  private kdr = 0;
  private kLeft = 0; // cells of shove still to travel

  constructor(col: number, row: number) {
    this.col = col;
    this.row = row;
  }

  /** Shove the hero along (dc, dr) — the direction away from whatever landed the blow. */
  knockback(dc: number, dr: number): void {
    const len = Math.hypot(dc, dr);
    if (len === 0) return;
    this.kdc = dc / len;
    this.kdr = dr / len;
    this.kLeft = KNOCKBACK;
  }

  // Eats a decaying share of the distance still owed rather than integrating a
  // velocity, so the shove covers KNOCKBACK whatever the frame rate.
  private slide(dt: number, isFloor: FloorAt): void {
    if (this.kLeft === 0) return;
    const step = this.kLeft * (1 - Math.exp(-KNOCKBACK_DECAY * dt));
    this.move(this.kdc * step, this.kdr * step, isFloor);
    this.kLeft -= step;
    if (this.kLeft < KNOCKBACK_MIN) this.kLeft = 0;
  }

  // Axes resolve independently so the hero slides along a wall instead of sticking.
  private move(dc: number, dr: number, isFloor: FloorAt): void {
    const nc = this.col + dc;
    if (fits(isFloor, nc, this.row)) this.col = nc;
    const nr = this.row + dr;
    if (fits(isFloor, this.col, nr)) this.row = nr;
  }

  update(dt: number, ctrl: HeroControls, isFloor: FloorAt): void {
    let { dc, dr } = ctrl.axis;
    const len = Math.hypot(dc, dr);
    if (len > 0) {
      dc /= len;
      dr /= len;
      const heading = facingFromAxis(dc, dr);
      if (heading !== null) this.facing = heading;
      const step = SPEED * dt;
      this.move(dc * step, dr * step, isFloor);
    }
    this.slide(dt, isFloor);
  }
}
