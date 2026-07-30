import { TILE, treeAt } from "./field";
import type { Pos } from "./walker";

// What the wood remembers between frames: which trees have been hit, how often,
// and which are still shuddering from the last blow. The field itself is a pure
// function of its seed, so everything that changes lives here.

export const CHOPS_TO_FELL = 3;

/**
 * How near a trunk has to be to swing at it, in world pixels — as far as the art
 * reaches, and no further.
 *
 * At the impact frame the drawn swing spans to x=85 of the 96px frame while the
 * figure stands on x=48, so axe and star together carry 37px from the feet. This
 * has to stay inside that or the blow lands on nothing — just under two tiles,
 * which brings the chop live before you are up against the bark without letting
 * you swing at a tree an arm's length past the axe.
 */
export const AXE_REACH = 31;

// Cells to search for something choppable: enough that a trunk a full reach away
// is still in the net.
const REACH_CELLS = 3;

// The pack's 4-frame sway, played once and fast: a shudder, not a breeze. Trees
// stand still until something hits them.
export const BOUNCE_FPS = 14;
export const BOUNCE_FRAMES = 4;

const key = (col: number, row: number): string => `${col},${row}`;

export interface Cell {
  col: number;
  row: number;
}

export class Wood {
  private chops = new Map<string, number>();
  private shaking = new Map<string, number>(); // seconds into the shudder

  /**
   * Where the trees are. The generated wood is a pure function of the field, but
   * a built island's trees are wherever someone stood them up, so the wood is
   * told rather than working it out.
   */
  constructor(private readonly hasTree: (col: number, row: number) => boolean = treeAt) {}

  /** Chopped through: what is left is a trunk in the ground. */
  isStump(col: number, row: number): boolean {
    return (this.chops.get(key(col, row)) ?? 0) >= CHOPS_TO_FELL;
  }

  /** Blows landed on a tree so far — what a progress cue would read. */
  chopsOn(col: number, row: number): number {
    return this.chops.get(key(col, row)) ?? 0;
  }

  /**
   * The tree the character could swing at: the nearest standing one whose trunk
   * is within arm's reach of the feet. Null when there is nothing to chop.
   */
  inReach(feet: Pos): Cell | null {
    const col0 = Math.floor(feet.x / TILE);
    const row0 = Math.floor(feet.y / TILE);
    let best: Cell | null = null;
    let nearest = Infinity;
    for (let dr = -REACH_CELLS; dr <= REACH_CELLS; dr++) {
      for (let dc = -REACH_CELLS; dc <= REACH_CELLS; dc++) {
        const col = col0 + dc;
        const row = row0 + dr;
        if (!this.hasTree(col, row) || this.isStump(col, row)) continue;
        const dx = feet.x - (col * TILE + TILE / 2);
        const dy = feet.y - (row * TILE + TILE / 2);
        const away = Math.hypot(dx, dy);
        if (away > AXE_REACH) continue;
        if (away < nearest) {
          nearest = away;
          best = { col, row };
        }
      }
    }
    return best;
  }

  /** Land a blow. True when that was the one that took the tree down. */
  hit(col: number, row: number): boolean {
    const k = key(col, row);
    const chops = (this.chops.get(k) ?? 0) + 1;
    this.chops.set(k, chops);
    if (chops < CHOPS_TO_FELL) this.shaking.set(k, 0);
    else this.shaking.delete(k); // a stump has nothing left to shake
    return chops >= CHOPS_TO_FELL;
  }

  update(dt: number): void {
    for (const [k, t] of this.shaking) {
      const next = t + dt;
      if (next >= BOUNCE_FRAMES / BOUNCE_FPS) this.shaking.delete(k);
      else this.shaking.set(k, next);
    }
  }

  /** Frame of the sway strip a tree is showing — 0 unless it was just hit. */
  frame(col: number, row: number): number {
    const t = this.shaking.get(key(col, row));
    if (t === undefined) return 0;
    return Math.min(BOUNCE_FRAMES - 1, Math.floor(t * BOUNCE_FPS));
  }
}

// The character's swing, from the pack's 10-frame axe strip. Frame 6 is the one
// with the impact star on it, so that is when the tree feels it.
export const CHOP_FPS = 12;
export const CHOP_FRAMES = 10;
export const IMPACT_FRAME = 6;

/** One swing of the axe: holds the clock and says when the blow lands. */
export class Chop {
  private t = 0;
  private landed = false;
  target: Cell | null = null;

  get active(): boolean {
    return this.target !== null;
  }

  start(target: Cell): void {
    if (this.active) return; // mid-swing: let it finish
    this.target = target;
    this.t = 0;
    this.landed = false;
  }

  /** Advances the swing. True on the single frame the axe lands. */
  update(dt: number): boolean {
    if (!this.active) return false;
    this.t += dt;
    if (this.t >= CHOP_FRAMES / CHOP_FPS) {
      this.target = null;
      return false;
    }
    if (this.landed || this.frame() < IMPACT_FRAME) return false;
    this.landed = true;
    return true;
  }

  frame(): number {
    return Math.min(CHOP_FRAMES - 1, Math.floor(this.t * CHOP_FPS));
  }
}
