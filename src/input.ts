// Screen-aligned movement axis: W/↑ moves up the screen, etc. Each key nudges
// both grid axes so the four keys map to the four screen directions.
export interface Axis {
  dc: number;
  dr: number;
}

const MOVE_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "]);

export class Input {
  private keys = new Set<string>();
  private stick: Axis | null = null;

  /** Analog axis from an on-screen stick; `null` hands steering back to the keys. */
  setStick(axis: Axis | null): void {
    this.stick = axis;
  }

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (MOVE_KEYS.has(k)) e.preventDefault();
      this.keys.add(k);
    });
    target.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    // Dropped keypresses (e.g. window blur) would otherwise stick "held".
    target.addEventListener("blur", () => this.keys.clear());
  }

  private any(...ks: string[]): boolean {
    return ks.some((k) => this.keys.has(k));
  }

  /** Grid delta from the stick if it is being held, else from the keys (not normalised). */
  get axis(): Axis {
    if (this.stick) return this.stick;
    let dc = 0;
    let dr = 0;
    if (this.any("w", "arrowup")) (dc -= 1), (dr -= 1);
    if (this.any("s", "arrowdown")) (dc += 1), (dr += 1);
    if (this.any("a", "arrowleft")) (dc -= 1), (dr += 1);
    if (this.any("d", "arrowright")) (dc += 1), (dr -= 1);
    return { dc, dr };
  }

  get jump(): boolean {
    return this.keys.has(" ");
  }
}
