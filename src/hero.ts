import type { World } from "./world";

// Tuning, in grid units. z is measured in elevation levels (same as the world's
// column heights); horizontal in cells.
const SPEED = 5; // cells per second
const GRAVITY = 34; // levels per second^2
const JUMP_V = 9; // launch velocity, levels per second
const CLIMB = 1.05; // max step-up (levels) while walking; taller = a wall
// Worth more than it looks: the monster is already closing at SPEED, so it wins
// back most of the shove while the shove is still playing. Much under a cell and
// the hit does not read on screen at all.
export const KNOCKBACK = 1.5; // cells the hero is shoved by a hit
const KNOCKBACK_DECAY = 12; // per second — the shove launches fast and eases off
const KNOCKBACK_MIN = 0.001; // cells left below which the slide reads as stopped

export interface HeroControls {
  axis: { dc: number; dr: number };
  jump: boolean;
}

// Just enough of the world for the hero to stand on.
type Terrain = Pick<World, "cols" | "rows" | "heightAt"> & { blocks?: World["blocks"] };

export class Hero {
  col: number;
  row: number;
  z: number;
  vz = 0;
  grounded = true;
  private kdc = 0; // knockback heading, a unit vector
  private kdr = 0;
  private kLeft = 0; // cells of shove still to travel

  constructor(col: number, row: number, world: Terrain) {
    this.col = col;
    this.row = row;
    this.z = this.groundAt(col, row, world);
  }

  private groundAt(col: number, row: number, world: Terrain): number {
    return world.heightAt(Math.round(col), Math.round(row));
  }

  // Can the hero's feet occupy this cell? Yes if its surface is no more than a
  // climb-step above the current z (so jumping, which raises z, reaches higher).
  private canStand(col: number, row: number, world: Terrain): boolean {
    const c = Math.round(col);
    const r = Math.round(row);
    if (c < 0 || r < 0 || c >= world.cols || r >= world.rows) return false;
    // Hazards are deliberately absent here: water and lava can be waded into,
    // and `hazard.ts` charges for the privilege.
    if (world.blocks?.(c, r)) return false;
    return world.heightAt(c, r) <= this.z + CLIMB;
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
  // velocity, so the shove covers KNOCKBACK whatever the frame rate. Walls stop
  // it the same way they stop walking.
  private slide(dt: number, world: Terrain): void {
    if (this.kLeft === 0) return;
    const step = this.kLeft * (1 - Math.exp(-KNOCKBACK_DECAY * dt));
    const nc = this.col + this.kdc * step;
    if (this.canStand(nc, this.row, world)) this.col = nc;
    const nr = this.row + this.kdr * step;
    if (this.canStand(this.col, nr, world)) this.row = nr;
    this.kLeft -= step;
    if (this.kLeft < KNOCKBACK_MIN) this.kLeft = 0;
  }

  update(dt: number, ctrl: HeroControls, world: Terrain): void {
    let { dc, dr } = ctrl.axis;
    const len = Math.hypot(dc, dr);
    if (len > 0) {
      dc /= len;
      dr /= len;
      const step = SPEED * dt;
      // Resolve axes independently so the hero slides along walls.
      const nc = this.col + dc * step;
      if (this.canStand(nc, this.row, world)) this.col = nc;
      const nr = this.row + dr * step;
      if (this.canStand(this.col, nr, world)) this.row = nr;
    }

    this.slide(dt, world);

    if (ctrl.jump && this.grounded) {
      this.vz = JUMP_V;
      this.grounded = false;
    }
    this.vz -= GRAVITY * dt;
    this.z += this.vz * dt;

    const ground = this.groundAt(this.col, this.row, world);
    if (this.z <= ground) {
      this.z = ground; // landed or stepped up onto a terrace
      this.vz = 0;
      this.grounded = true;
    } else {
      this.grounded = false; // airborne, or walked off a ledge
    }
  }
}

/** Ground shadow, drawn at the cell centre under the hero (not its jump height). */
export function drawHeroShadow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Fallback figure while the LPC sprite loads (or if it fails): a little capsule.
 * `feetX/feetY` is the anchor — the centre of the tile the hero stands on.
 */
export function drawHeroPlaceholder(ctx: CanvasRenderingContext2D, feetX: number, feetY: number): void {
  ctx.save();
  const bw = 20;
  const bh = 28;
  const bx = feetX - bw / 2;
  const by = feetY - bh - 4;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#3a0f0a";
  ctx.fillStyle = "#c0392b"; // tunic
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f0c9a0"; // head
  ctx.beginPath();
  ctx.arc(feetX, by - 3, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
