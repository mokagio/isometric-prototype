export const ATTACK_DURATION = 0.5; // 7 frames at 14fps
// The blade connects partway in rather than on the last frame. A monster covers
// the gap from melee range to contact in ~0.3s, so a blow that waits for the
// animation to finish always arrives after the bump it was meant to prevent.
export const ATTACK_HIT_AT = 0.2;

/** One swing of the sword: its animation clock, and the moment the blade connects. */
export class Swing {
  private t: number | null = null;
  private landed = false;

  get active(): boolean {
    return this.t !== null;
  }

  /** Seconds into the current swing, for picking the animation frame. */
  get time(): number {
    return this.t ?? 0;
  }

  /** Begin a swing. False if one is already underway. */
  start(): boolean {
    if (this.t !== null) return false;
    this.t = 0;
    this.landed = false;
    return true;
  }

  /** Advance the clock. True on the single frame the blade connects. */
  update(dt: number): boolean {
    if (this.t === null) return false;
    this.t += dt;
    const connects = !this.landed && this.t >= ATTACK_HIT_AT;
    if (connects) this.landed = true;
    if (this.t >= ATTACK_DURATION) this.t = null;
    return connects;
  }

  cancel(): void {
    this.t = null;
  }
}
