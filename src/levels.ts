// The ladder Peaceful Plains is climbed by. A level is one creature, a number of
// gems to collect before the next, and how many blows each of that creature takes.
//
// One dial moves per level, alternating, so neither the grind nor the fight runs
// ahead of the other:
//
//   level  1   2   3   4   5   6
//   gems   6   8   8  10  10  12
//   hearts 1   1   2   2   3   3
//
// A formula rather than a table, so the ladder never runs out of rungs.

export const FIRST_TARGET = 6; // gems to clear the first level
export const TARGET_STEP = 2; // more gems each time the target is the dial that moves
export const HP_EVERY = 2; // levels between a monster gaining a heart
/** Levels per full rung: one moves the target, the next the hearts. */
const RUNG = 2;

/** Gems to collect before `level` (0-based) is cleared. */
export const targetFor = (level: number): number => FIRST_TARGET + TARGET_STEP * Math.ceil(level / RUNG);

/** Blows each of `level`'s monsters takes. */
export const hpFor = (level: number): number => Math.floor(level / HP_EVERY) + 1;

/** How far up the ladder a run has got, and how close the current level is to done. */
export class Progress {
  level = 0; // 0-based; the HUD shows it 1-based
  banked = 0; // gems collected toward this level

  get target(): number {
    return targetFor(this.level);
  }

  get hp(): number {
    return hpFor(this.level);
  }

  /**
   * Which of a cast of `cast` creatures this level sends in. Walks the cast in
   * order and wraps, so a given level always looks the same — "I got to the horned
   * one" is then worth saying.
   */
  kind(cast: number): number {
    return cast > 0 ? this.level % cast : 0;
  }

  /**
   * Bank gems toward the current level. True when that cleared it, in which case
   * the surplus carries: picking two up at once on 5 of 6 starts the next level on 1.
   */
  bank(n: number): boolean {
    this.banked += n;
    if (this.banked < this.target) return false;
    this.banked -= this.target;
    this.level += 1;
    return true;
  }

  reset(): void {
    this.level = 0;
    this.banked = 0;
  }
}
