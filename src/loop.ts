// Drives a per-frame callback off requestAnimationFrame, handing it the seconds
// since the last frame. The delta is clamped so a backgrounded tab resuming
// after seconds away steps once, not in one enormous jump that tunnels the hero
// through walls.
export const MAX_DT = 0.05;

export class Loop {
  private last = -1; // negative until the first frame, so a now of 0 still reads as the start
  private raf = 0;
  private running = false;

  constructor(
    private readonly step: (dt: number) => void,
    private readonly maxDt = MAX_DT,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.last = -1; // a later start restarts the clock rather than catching up
  }

  private tick = (now: number): void => {
    const dt = this.last < 0 ? 0 : Math.min((now - this.last) / 1000, this.maxDt);
    this.last = now;
    this.step(dt);
    if (this.running) this.raf = requestAnimationFrame(this.tick);
  };
}
