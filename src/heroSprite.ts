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

const CELL = 64;
const FRAMES = 9;
const WALK_FPS = 9;

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

interface Layer {
  img: HTMLImageElement;
  ok: boolean;
}

export type Facing = 0 | 1 | 2 | 3; // up, left, down, right

/** Movement direction → the nearest of LPC's four facings, or null when still. */
export function facingFromAxis(dc: number, dr: number): Facing | null {
  const screenX = dc - dr;
  const screenY = dc + dr;
  if (screenX === 0 && screenY === 0) return null;
  if (Math.abs(screenY) >= Math.abs(screenX)) return screenY > 0 ? 2 : 0;
  return screenX > 0 ? 3 : 1;
}

export class HeroSprite {
  private layers: Layer[] = [];
  private settled = 0;
  private walkTime = 0;
  ready = false;

  constructor(base = LPC_BASE) {
    const defs = [...LAYER_DEFS].sort((a, b) => a.zPos - b.zPos);
    for (const def of defs) {
      const layer: Layer = { img: new Image(), ok: false };
      layer.img.crossOrigin = "anonymous";
      layer.img.onload = () => {
        layer.ok = true;
        this.settle(defs.length);
      };
      layer.img.onerror = () => this.settle(defs.length); // a missing layer just drops
      layer.img.src = base + def.path;
      this.layers.push(layer);
    }
  }

  private settle(total: number): void {
    if (++this.settled === total) this.ready = true;
  }

  /** Advance the walk cycle while moving; snap to the idle pose when still. */
  update(dt: number, moving: boolean): void {
    this.walkTime = moving ? this.walkTime + dt : 0;
  }

  private frame(moving: boolean): number {
    if (!moving) return 0; // frame 0 is the neutral standing pose
    return 1 + (Math.floor(this.walkTime * WALK_FPS) % (FRAMES - 1));
  }

  /**
   * Draws the composited figure at 2x nearest with its feet at `(feetX, feetY)`.
   * Returns false if nothing is loaded yet, so the caller can fall back.
   */
  draw(ctx: CanvasRenderingContext2D, feetX: number, feetY: number, facing: Facing, moving: boolean): boolean {
    if (!this.ready) return false;
    const sx = this.frame(moving) * CELL;
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
