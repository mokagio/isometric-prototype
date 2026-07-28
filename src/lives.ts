export const MAX_LIVES = 10;
// A monster that reaches the hero parks there and keeps bumping, so without a
// window of immunity a single slime empties the bar in ten frames.
export const INVULN = 1; // seconds of immunity after a hit
export const DEATH_FADE = 1.2; // seconds the hero takes to fade out

const BLINK_HZ = 8;
const BLINK_ALPHA = 0.35;

/** The hero's hearts, immunity window, and death fade. */
export class Lives {
  lives = MAX_LIVES;
  private invulnT = 0;
  private deathT = 0;

  get alive(): boolean {
    return this.lives > 0;
  }

  get invulnerable(): boolean {
    return this.invulnT > 0;
  }

  /** Down and fully faded — the cue to raise the sign. */
  get gameOver(): boolean {
    return !this.alive && this.deathT >= DEATH_FADE;
  }

  /** Seconds since the hero went down — drives the defeat animation. */
  get deathTime(): number {
    return this.deathT;
  }

  /** Spend a heart. False when the hit is swallowed by immunity, or the hero is already down. */
  hit(): boolean {
    if (!this.alive || this.invulnerable) return false;
    this.lives -= 1;
    this.invulnT = INVULN;
    return true;
  }

  update(dt: number): void {
    if (this.alive) {
      this.invulnT = Math.max(0, this.invulnT - dt);
    } else {
      this.deathT += dt;
    }
  }

  /** Hero opacity: blinks through the immunity window, fades out on death. */
  alpha(): number {
    if (!this.alive) return Math.max(0, 1 - this.deathT / DEATH_FADE);
    if (!this.invulnerable) return 1;
    return Math.floor(this.invulnT * BLINK_HZ) % 2 === 0 ? BLINK_ALPHA : 1;
  }

  reset(): void {
    this.lives = MAX_LIVES;
    this.invulnT = 0;
    this.deathT = 0;
  }
}
