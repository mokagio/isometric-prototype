// Top-down movement: the grid axes are the screen axes, so W/↑ is -row and
// D/→ is +col.
export interface Axis {
  dc: number;
  dr: number;
}

const MOVE_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "]);
const ATTACK_KEYS = new Set(["j", " "]);

export class Input {
  private keys = new Set<string>();
  private stick: Axis | null = null;
  private attackHandlers: Array<() => void> = [];

  /** Analog axis from an on-screen stick; `null` hands steering back to the keys. */
  setStick(axis: Axis | null): void {
    this.stick = axis;
  }

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (MOVE_KEYS.has(k)) e.preventDefault();
      // A held key auto-repeats keydown. Whether the set already has it is what
      // separates a repeat from a fresh press.
      const fresh = !this.keys.has(k);
      this.keys.add(k);
      if (fresh && ATTACK_KEYS.has(k)) for (const fn of this.attackHandlers) fn();
    });
    target.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    // Dropped keypresses (e.g. window blur) would otherwise stick "held".
    target.addEventListener("blur", () => this.keys.clear());
  }

  /** Runs on every fresh press of an attack key; leaning on one does not re-fire. */
  onAttack(fn: () => void): void {
    this.attackHandlers.push(fn);
  }

  private any(...ks: string[]): boolean {
    return ks.some((k) => this.keys.has(k));
  }

  /** Grid delta from the stick if it is being held, else from the keys (not normalised). */
  get axis(): Axis {
    if (this.stick) return this.stick;
    let dc = 0;
    let dr = 0;
    if (this.any("w", "arrowup")) dr -= 1;
    if (this.any("s", "arrowdown")) dr += 1;
    if (this.any("a", "arrowleft")) dc -= 1;
    if (this.any("d", "arrowright")) dc += 1;
    return { dc, dr };
  }
}
