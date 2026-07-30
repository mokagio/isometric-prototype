import { SY, SZ } from "./iso";
import type { World } from "./world";

// Draw order puts columns in front of a figure over the top of it, which is
// correct — and a problem only because the camera pins the hero to the middle of
// the screen, so "in front of the hero" is also "where you are looking". The
// caller draws a ghost of anything this reports hidden.
//
// Depth buys height: a column one cell nearer the camera sits SY lower on screen
// while a level of height lifts a tile by SZ, so each cell of nearness is worth
// SY / SZ of a level.
const LEVELS_PER_CELL = SY / SZ;

/** A figure stands about this many levels tall on screen. */
export const FIGURE_LEVELS = 2;

/** Cells in front, per axis, whose tile can overlap a one-cell-wide figure. */
export const OCCLUSION_WINDOW = 2;

type Terrain = Pick<World, "heightAt">;

/**
 * Whether anything in front of (col, row) stands tall enough to cover at least
 * half of a figure whose feet are at `z`. Half, not any: a low ledge clipping the
 * boots is normal, and ghosting on that would flicker across every terrace.
 */
export function isHidden(world: Terrain, col: number, row: number, z: number): boolean {
  const c = Math.round(col);
  const r = Math.round(row);
  for (let i = 0; i <= OCCLUSION_WINDOW; i++) {
    for (let j = 0; j <= OCCLUSION_WINDOW; j++) {
      if (i === 0 && j === 0) continue; // a figure draws after its own column
      const covering = z + (i + j) * LEVELS_PER_CELL + FIGURE_LEVELS / 2;
      if (world.heightAt(c + i, r + j) > covering) return true;
    }
  }
  return false;
}
