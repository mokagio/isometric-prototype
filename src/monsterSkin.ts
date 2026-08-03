import { blitFrame, frameAt, SheetLoader, type Sheet } from "./sprites";

// A monster skin owns one creature's sheets and knows how to draw it. All skins
// share the same mechanics — feet anchor, walk cycle, death fade — and differ
// only in sheet geometry and in how many creatures they hold, so they are
// interchangeable behind `createMonsterSkin`. The field owns the clock and the
// state; the skin maps that to a frame. Same split `heroSkin.ts` makes.

export const FADE = 0.6; // death: seconds to play the end out
// Only the last fraction of a slime's death fades; the rest is the deflate at
// full opacity. A skin with no death animation has nothing to hold up for.
const SLIME_FADE_TAIL = 0.3;

/**
 * What a skin needs off a monster to draw it — deliberately less than the whole
 * `Monster`, so a skin never reaches into the field's own bookkeeping.
 */
export interface Figure {
  animT: number;
  dying: boolean;
  dyingT: number;
  faceLeft: boolean;
  /** Which of the skin's cast this one is. Always 0 for a skin of one. */
  kind: number;
}

export interface MonsterSkin {
  readonly ready: boolean;
  /** How many creatures the skin holds. The level picks one of them for its wave. */
  readonly cast: number;
  /**
   * Screen pixels above the feet that creature `kind`'s art tops out, so a caller
   * can put something over its head — the heart row — without knowing any of the
   * sheet's geometry. Per creature, not per sheet: a cast stands on one baseline
   * in a cell cut for the tallest of them, so a single figure would float the row
   * most of a creature's height above a small one.
   */
  lift(kind: number): number;
  /**
   * Draw one monster with its feet at (feetX, feetY). `alphaScale` dims the whole
   * sprite — the blit sets alpha outright, so a caller cannot dim it from outside.
   */
  draw(ctx: CanvasRenderingContext2D, m: Figure, feetX: number, feetY: number, alphaScale?: number): void;
}

// oboropixel slime (public/oboro/slime/): 96x96 side-view frames, one sheet per
// animation. Same pack as the "slime" hero skin.
const SLIME_CELL = 96;
const SLIME_SCALE = 3;
const SLIME_ANCHOR_X = 48; // frame centre
const SLIME_ANCHOR_Y = 56; // feet baseline within the 96px frame
const SLIME_ART_TOP = 44; // highest row the walk cycle reaches: the slime is short in a tall frame
export const SLIME_FRAMES = 8; // walk frames
const SLIME_DEATH_FRAMES = 10;
export const SLIME_FPS = 10; // walk playback rate

export class SlimeSkin implements MonsterSkin {
  readonly cast = 1;
  private walk: Sheet;
  private death: Sheet;
  private loader = new SheetLoader(2);

  constructor(base: string = import.meta.env.BASE_URL) {
    this.walk = this.loader.load(`${base}oboro/slime/walk.png`);
    this.death = this.loader.load(`${base}oboro/slime/death.png`);
  }

  get ready(): boolean {
    return this.loader.ready;
  }

  lift(): number {
    return (SLIME_ANCHOR_Y - SLIME_ART_TOP) * SLIME_SCALE;
  }

  draw(ctx: CanvasRenderingContext2D, m: Figure, feetX: number, feetY: number, alphaScale = 1): void {
    if (!this.ready) return;
    const sheet = m.dying ? this.death : this.walk;
    if (!sheet.ok) return;

    let frame: number;
    let alpha = 1;
    if (m.dying) {
      const p = Math.min(1, m.dyingT / FADE);
      frame = Math.min(SLIME_DEATH_FRAMES - 1, Math.floor(p * SLIME_DEATH_FRAMES));
      alpha = p < 1 - SLIME_FADE_TAIL ? 1 : Math.max(0, (1 - p) / SLIME_FADE_TAIL);
    } else {
      frame = frameAt(m.animT, SLIME_FPS, SLIME_FRAMES, true);
    }

    blitFrame(ctx, sheet.img, feetX, feetY, {
      cell: SLIME_CELL,
      scale: SLIME_SCALE,
      anchorX: SLIME_ANCHOR_X,
      anchorY: SLIME_ANCHOR_Y,
      frame,
      flip: m.faceLeft,
      alpha: alpha * alphaScale,
    });
  }
}

/**
 * Akoro's pixel mons, re-cut to `public/mons/monsCast.png`: one creature per row,
 * four frames across. The pack's own sheet lays the whole cast out once per frame
 * on a grid 30 wide and 31.2 tall — a fraction, so nothing can index it by
 * multiplication — which is why this one is cut rather than vendored whole. Each
 * creature is centred on its cell and stands on a fixed baseline, so one anchor
 * serves all 35, and the box is taken across a creature's four frames together so
 * its bob survives the cut.
 */
const MON_CELL = 32;
const MON_SCALE = 2;
const MON_ANCHOR_X = 16;
const MON_ANCHOR_Y = 31;
const MON_FRAMES = 4;
export const MON_BOB_FPS = 8;
export const MONS_IN_CAST = 35;
// The row each creature's art starts on inside its cell. The cell is cut for the
// tallest of the 35 and they all stand on one baseline, so this is the only thing
// that says how tall any one of them is. `scripts/cutMonsCast.py` prints it.
export const MON_ART_TOP = [
  18, 17, 15, 12, 15, 11, 10, 11, 14, 11, 15, 13, 11, 13, 7, 8, 12, 13, 10, 7, 4, 14, 9, 12, 8, 10,
  9, 9, 10, 10, 9, 11, 6, 8, 8,
];

/** Which row of the cast a `kind` names, whatever it is handed. */
function castRow(kind: number): number {
  return Math.min(MONS_IN_CAST - 1, Math.max(0, Math.floor(kind)));
}

export class MonSkin implements MonsterSkin {
  readonly cast = MONS_IN_CAST;
  private sheet: Sheet;
  private loader = new SheetLoader(1);

  constructor(base: string = import.meta.env.BASE_URL) {
    this.sheet = this.loader.load(`${base}mons/monsCast.png`);
  }

  get ready(): boolean {
    return this.loader.ready;
  }

  lift(kind: number): number {
    return (MON_ANCHOR_Y - MON_ART_TOP[castRow(kind)]!) * MON_SCALE;
  }

  draw(ctx: CanvasRenderingContext2D, m: Figure, feetX: number, feetY: number, alphaScale = 1): void {
    if (!this.ready || !this.sheet.ok) return;
    // The pack draws no death, so the end is the fade alone, spread over the
    // whole of it rather than saved for a tail with nothing behind it.
    const alpha = (m.dying ? Math.max(0, 1 - m.dyingT / FADE) : 1) * alphaScale;
    blitFrame(ctx, this.sheet.img, feetX, feetY, {
      cell: MON_CELL,
      scale: MON_SCALE,
      anchorX: MON_ANCHOR_X,
      anchorY: MON_ANCHOR_Y,
      row: castRow(m.kind),
      frame: frameAt(m.animT, MON_BOB_FPS, MON_FRAMES, true),
      flip: m.faceLeft,
      alpha,
    });
  }
}

export type MonsterSkinKind = "mons" | "slime";

// The active enemy art. Flip this to send the slimes back in.
export const MONSTER_SKIN: MonsterSkinKind = "mons";

export function createMonsterSkin(kind: MonsterSkinKind = MONSTER_SKIN, base?: string): MonsterSkin {
  return kind === "slime" ? new SlimeSkin(base) : new MonSkin(base);
}
