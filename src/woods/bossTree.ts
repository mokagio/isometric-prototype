import { Treant } from "../treant";
import { FIELD, TILE } from "./field";
import type { Pos } from "./walker";
import { AXE_REACH, type Cell } from "./wood";

// The one thing in this wood that fights back — as far as a rooted tree can. It
// takes the axe the ordinary trees take, and a great many more blows.

/**
 * Where it stands: three tiles east of where the character starts, inside the
 * square `field.ts` keeps clear of ordinary trees. So it is in view from the
 * first frame, and nothing is standing in it.
 */
export const BOSS_CELL: Cell = { col: FIELD / 2 + 3, row: FIELD / 2 };

/**
 * Drawn at half the world's pixel density. The treant is a 160px battler beside
 * 16px Sunnyside tiles; at the world's own 4x it would be 62 world pixels across —
 * four tiles, and most of a phone screen. At 2x it takes a tree's footprint and
 * twice a tree's presence, and the scale stays whole so the pixels stay square.
 */
export const BOSS_SCALE = 2;

/**
 * What its roots block, in world pixels around the cell it stands on — the same
 * shape as `field.ts`'s `TRUNK`, and drawn by the debug overlay beside it.
 * Measured off the sheet's last few rows, where the roots meet the ground: 37
 * source pixels across, so 18 world pixels at 2x.
 */
export const BOSS_TRUNK = { halfW: 9, top: 6, bottom: 3 };

/** Logs the boss bursts when it goes down, against a tree's `LOGS_PER_TREE`. */
export const BOSS_LOGS = 9;

/** The point on the ground it stands on. */
export const bossBase = (): Pos => ({
  x: BOSS_CELL.col * TILE + TILE / 2,
  y: BOSS_CELL.row * TILE + TILE / 2,
});

/** The boss tree, and what the walker and the axe need to know about it. */
export class BossTree {
  readonly treant = new Treant();

  get down(): boolean {
    return !this.treant.alive;
  }

  /** Whether the axe reaches it from here. False once it has been felled. */
  inReach(feet: Pos): boolean {
    if (this.down) return false;
    const base = bossBase();
    return Math.hypot(feet.x - base.x, feet.y - base.y) <= AXE_REACH;
  }

  /** Whether the roots stand where the feet are trying to go. A slumped one still does. */
  blocks(feet: Pos): boolean {
    const base = bossBase();
    return (
      Math.abs(feet.x - base.x) < BOSS_TRUNK.halfW &&
      feet.y > base.y - BOSS_TRUNK.top &&
      feet.y < base.y + BOSS_TRUNK.bottom
    );
  }

  /**
   * Advance its clock. It rears up and roars on the same schedule it does in the
   * other game and lands nothing: there are no hearts here to take. What it buys
   * is a tree that is plainly awake while you are chopping it.
   */
  update(dt: number): void {
    this.treant.update(dt);
  }

  /** Land an axe blow. True when that was the one that felled it. */
  hit(): boolean {
    return this.treant.hit();
  }
}
