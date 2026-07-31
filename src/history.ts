// Undo, for every editor. What is being edited is small enough in all three that
// the simplest thing works: keep whole copies and step between them. A stroke is
// one step however many cells it crossed, which is what somebody dragging a
// brush means by "that one, back".

/** Steps kept. Deep enough to walk a mistake back, shallow enough to forget. */
export const DEPTH = 60;

/** What a snapshot costs. Cheap for an array of characters, less so for a board. */
export interface Steps<T> {
  clone(state: T): T;
  same(a: T, b: T): boolean;
}

/** For anything that is plain data and no bigger than a map. */
export const jsonSteps = <T>(): Steps<T> => ({
  clone: (state) => JSON.parse(JSON.stringify(state)) as T,
  same: (a, b) => JSON.stringify(a) === JSON.stringify(b),
});

export class History<T> {
  private states: T[];
  private at = 0;

  constructor(
    initial: T,
    private readonly steps: Steps<T>,
  ) {
    this.states = [steps.clone(initial)];
  }

  get canUndo(): boolean {
    return this.at > 0;
  }

  get canRedo(): boolean {
    return this.at < this.states.length - 1;
  }

  /**
   * Remember where the work has got to. A state no different from the one
   * already held is not a step: a click that painted the tile already there
   * should not cost an undo.
   */
  record(state: T): boolean {
    if (this.steps.same(state, this.states[this.at]!)) return false;
    // Drawing after undoing abandons what was undone, as everything else does.
    this.states.length = this.at + 1;
    this.states.push(this.steps.clone(state));
    if (this.states.length > DEPTH) this.states.shift();
    this.at = this.states.length - 1;
    return true;
  }

  /** The state before the last step, or null at the beginning. */
  undo(): T | null {
    if (!this.canUndo) return null;
    this.at--;
    return this.steps.clone(this.states[this.at]!);
  }

  /** The state undone away from, or null if nothing was undone. */
  redo(): T | null {
    if (!this.canRedo) return null;
    this.at++;
    return this.steps.clone(this.states[this.at]!);
  }

  /** Throw the past away and start again from here — opening a file, or clearing. */
  reset(state: T): void {
    this.states = [this.steps.clone(state)];
    this.at = 0;
  }
}
