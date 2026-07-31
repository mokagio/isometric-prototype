import type { Outline } from "../outline";

// Undo for the outline editor. A drawing is a small array of characters, so the
// simplest thing works: keep whole copies and step between them. A stroke is one
// step however many cells it crossed, which is what somebody dragging a shore
// means by "that one, back".

/** Steps kept. Deep enough to walk a mistake back, shallow enough to forget. */
export const DEPTH = 60;

const copy = (outline: Outline): Outline => outline.slice();
const same = (a: Outline, b: Outline): boolean => a.length === b.length && a.every((code, i) => code === b[i]);

export class History {
  private states: Outline[];
  private at = 0;

  constructor(initial: Outline) {
    this.states = [copy(initial)];
  }

  get canUndo(): boolean {
    return this.at > 0;
  }

  get canRedo(): boolean {
    return this.at < this.states.length - 1;
  }

  /**
   * Remember where the drawing has got to. A state no different from the one
   * already held is not a step: a click that painted the tile already there
   * should not cost an undo.
   */
  record(outline: Outline): boolean {
    if (same(outline, this.states[this.at]!)) return false;
    // Drawing after undoing abandons what was undone, as everything else does.
    this.states.length = this.at + 1;
    this.states.push(copy(outline));
    if (this.states.length > DEPTH) this.states.shift();
    this.at = this.states.length - 1;
    return true;
  }

  /** The state before the last step, or null at the beginning. */
  undo(): Outline | null {
    if (!this.canUndo) return null;
    this.at--;
    return copy(this.states[this.at]!);
  }

  /** The state undone away from, or null if nothing was undone. */
  redo(): Outline | null {
    if (!this.canRedo) return null;
    this.at++;
    return copy(this.states[this.at]!);
  }

  /** Throw the past away and start again from here — opening a file, or starting over. */
  reset(outline: Outline): void {
    this.states = [copy(outline)];
    this.at = 0;
  }
}
