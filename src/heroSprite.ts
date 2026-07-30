import type { HeroAction, HeroSkin } from "./heroSkin";
import { SX, SY } from "./iso";
import { frameAt, SheetLoader, type Sheet } from "./sprites";

// Composites an LPC (Universal LPC Spritesheet) walk cycle for the hero.
//
// The art is NOT vendored — licensing is unresolved (see SPRITE-HANDOVER.md),
// so layers load at runtime from the canonical repo. Point LPC_BASE at local
// assets once that's settled; nothing else changes.
//
// Sheet contract: 64x64 cells, 9 frames per row, rows 0=up 1=left 2=down
// 3=right. Layers draw in `zPos` order; the two sword sheets carry complementary
// rows (behind for up/left/right, in front for down), so drawing both is safe.

export const LPC_BASE =
  "https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/master/spritesheets/";

export const CELL = 64;
export const FRAMES = 9;
export const WALK_FPS = 9;

interface LayerDef {
  path: string;
  zPos: number;
}

// Unarmed base + longsword. White garments — LPC base sheets are uncoloured;
// palette recolouring is a later step. Sorted by zPos before drawing.
const LAYER_DEFS: LayerDef[] = [
  { path: "weapon/sword/longsword/universal_behind/walk/longsword.png", zPos: 9 },
  { path: "body/bodies/male/walk.png", zPos: 10 },
  { path: "legs/pants/male/walk.png", zPos: 20 },
  { path: "torso/clothes/longsleeve/longsleeve/male/walk.png", zPos: 35 },
  // The body sheet is neck-down; the head is its own layer in this repo.
  { path: "head/heads/human/male/walk.png", zPos: 100 },
  { path: "weapon/sword/longsword/walk/longsword.png", zPos: 150 },
];

export type Facing = 0 | 1 | 2 | 3; // up, left, down, right

/**
 * Movement direction → the nearest of LPC's four facings, or null when still.
 *
 * Measured in pixels rather than grid steps: a step along screen-x covers SX and
 * one along screen-y only SY, so holding two keys walks a shallow diagonal that
 * is mostly sideways. Comparing raw steps called those diagonals up or down, and
 * the hero slid across the screen showing its back.
 */
export function facingFromAxis(dc: number, dr: number): Facing | null {
  const screenX = (dc - dr) * SX;
  const screenY = (dc + dr) * SY;
  if (screenX === 0 && screenY === 0) return null;
  // A dead-on 45 degree screen diagonal turns sideways: facing the camera or
  // away from it while visibly travelling across is the worse-looking half.
  if (Math.abs(screenY) > Math.abs(screenX)) return screenY > 0 ? 2 : 0;
  return screenX > 0 ? 3 : 1;
}

export class HeroSprite implements HeroSkin {
  private layers: Sheet[] = [];
  private loader = new SheetLoader(LAYER_DEFS.length);

  get ready(): boolean {
    return this.loader.ready;
  }

  constructor(base = LPC_BASE) {
    const defs = [...LAYER_DEFS].sort((a, b) => a.zPos - b.zPos);
    for (const def of defs) {
      this.layers.push(this.loader.load(base + def.path, "anonymous"));
    }
  }

  // Only `walk` sheets are loaded, so run cycles frames 1..8 and everything else
  // (idle, and attack — no LPC slash sheet is wired) shows the neutral frame 0.
  private frame(action: HeroAction, actionTime: number): number {
    if (action !== "run") return 0;
    return 1 + frameAt(actionTime, WALK_FPS, FRAMES - 1, true);
  }

  /**
   * Draws the composited figure at 2x nearest with its feet at `(feetX, feetY)`.
   * Returns false if nothing is loaded yet, so the caller can fall back.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    feetX: number,
    feetY: number,
    facing: Facing,
    action: HeroAction,
    actionTime: number,
  ): boolean {
    if (!this.ready) return false;
    const sx = this.frame(action, actionTime) * CELL;
    const sy = facing * CELL;
    // Figure feet sit at cell-y 61 of 64; drawn at 2x that is y 122.
    const dx = Math.round(feetX - CELL);
    const dy = Math.round(feetY - 122);
    for (const layer of this.layers) {
      if (layer.ok) ctx.drawImage(layer.img, sx, sy, CELL, CELL, dx, dy, CELL * 2, CELL * 2);
    }
    return true;
  }
}
