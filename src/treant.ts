import { drawHearts } from "./hearts";
import { blitFrame, frameAt, SheetLoader, type Sheet } from "./sprites";

/**
 * Holder's animated battler (`public/treant/treant.png`), vendored whole: a 4x14
 * grid of 160px cells, one pose to a row. Row 13 is the pack's credit plate.
 *
 * The pack ships no origin, but every pose bottoms out on the same line — rows 0,
 * 4, 7 and 12 all end at y=149 despite standing different heights — so that line
 * is the feet. Re-measure with
 * `magick treant.png -crop 160x160+0+0 +repage -format %@ info:` if it is redrawn.
 *
 * It is a battler: one facing, front-on, and no walk cycle anywhere in the sheet.
 * That is why the boss is rooted rather than chasing anybody.
 */
export const CELL = 160;
export const FRAMES = 4; // every pose is four frames wide
export const ANCHOR_X = 80; // frame centre
export const ANCHOR_Y = 149; // the line every pose stands on

export const IDLE_ROW = 0;
export const RECOIL_ROW = 4;
export const ROAR_ROW = 7;
// Runs dark-to-lit on the sheet, so it is played backwards: the fire going out.
export const EMBER_ROW = 11;
export const FALLEN_ROW = 12; // slumped and unlit, all four frames alike

export const IDLE_FPS = 6; // a slow breath, not a walk cycle

export const HP = 5; // blows to fell it, sword or axe alike — one per heart on show
export const HURT = 0.36; // seconds of recoil per blow
/** Seconds it stands quiet between roars. */
export const ROAR_EVERY = 1.2;
export const ROAR = 0.9; // seconds the roar itself takes
// The roar peaks partway through the rear-up rather than at the end: what follows
// is the treant settling back down. Same shape as `Swing`'s `ATTACK_HIT_AT`.
export const ROAR_HIT_AT = 0.5;
export const DYING = 1; // seconds the fire takes to go out
// It blinks through the recoil, the way the hero blinks through their own
// immunity window — the recoil pose alone is a subtle read on a sprite this dark,
// and a blow that lands has to be unmistakable.
export const BLINK_HZ = 14;
export const BLINK_ALPHA = 0.3;
/** Clear of the tallest pose, which tops out 92 sheet pixels above the feet. */
export const HEART_LIFT = 100;

export type Stance = "idle" | "roar" | "hurt" | "dying" | "fallen";

export interface Pose {
  row: number;
  frame: number;
}

/**
 * The boss of Whispering Woods: a rooted treant that stands, roars on a clock,
 * staggers when hit, and burns out. Pure state — the game says where it stands and
 * what a blow costs, and does not own the animation.
 */
export class Treant {
  hp = HP;
  private stance: Stance = "idle";
  private t = 0; // seconds into the current stance
  private breath = 0; // never reset — the idle glow keeps pulsing across stances
  private quiet = 0; // seconds since the last roar
  private lashed = false;

  get alive(): boolean {
    return this.hp > 0;
  }

  /** Burnt out and slumped: the fight is over. */
  get down(): boolean {
    return this.stance === "fallen";
  }

  /** Reared up — the cue to get clear before the lash lands. */
  get roaring(): boolean {
    return this.stance === "roar";
  }

  private enter(stance: Stance): void {
    this.stance = stance;
    this.t = 0;
  }

  /** Advance the clock. True on the single frame the lash connects. */
  update(dt: number): boolean {
    this.t += dt;
    this.breath += dt;
    switch (this.stance) {
      case "fallen":
        return false;
      case "dying":
        if (this.t >= DYING) this.enter("fallen");
        return false;
      case "roar": {
        const lands = !this.lashed && this.t >= ROAR_HIT_AT;
        if (lands) this.lashed = true;
        if (this.t >= ROAR) this.enter("idle");
        return lands;
      }
      // The roar clock runs through a stagger, so a blow delays the next roar by
      // the recoil and no more.
      case "hurt":
        this.quiet += dt;
        if (this.t >= HURT) this.enter("idle");
        return false;
      case "idle":
        this.quiet += dt;
        if (this.quiet >= ROAR_EVERY) {
          this.quiet = 0;
          this.lashed = false;
          this.enter("roar");
        }
        return false;
    }
  }

  /** Land a blow. True when that was the one that felled it. */
  hit(): boolean {
    if (!this.alive) return false;
    this.hp -= 1;
    if (!this.alive) {
      this.enter("dying");
      return true;
    }
    // A roar under way is seen through: it absorbs the blow rather than recoiling
    // from it. Otherwise a hero who simply keeps swinging cancels every roar
    // before it lands and the boss is a punching bag. The way past a lash is to
    // be somewhere else when it arrives, which is what the rear-up telegraphs.
    if (this.stance !== "roar") this.enter("hurt");
    return false;
  }

  /** How solidly it draws: it blinks while recoiling, and stands full otherwise. */
  alpha(): number {
    if (this.stance !== "hurt") return 1;
    return Math.floor(this.t * BLINK_HZ) % 2 === 0 ? BLINK_ALPHA : 1;
  }

  /** The cell of the sheet to draw this frame. */
  pose(): Pose {
    switch (this.stance) {
      case "fallen":
        return { row: FALLEN_ROW, frame: 0 };
      case "dying":
        return { row: EMBER_ROW, frame: FRAMES - 1 - frameAt(this.t, FRAMES / DYING, FRAMES, false) };
      case "roar":
        return { row: ROAR_ROW, frame: frameAt(this.t, FRAMES / ROAR, FRAMES, false) };
      case "hurt":
        return { row: RECOIL_ROW, frame: frameAt(this.t, FRAMES / HURT, FRAMES, false) };
      case "idle":
        return { row: IDLE_ROW, frame: frameAt(this.breath, IDLE_FPS, FRAMES, true) };
    }
  }
}

/** The sheet, and the one way to put a treant on screen. */
export class TreantArt {
  private sheet: Sheet;
  private loader = new SheetLoader(1);

  constructor(base: string = import.meta.env.BASE_URL) {
    this.sheet = this.loader.load(`${base}treant/treant.png`);
  }

  get ready(): boolean {
    return this.loader.ready && this.sheet.ok;
  }

  /**
   * Draw with the roots at (feetX, feetY). `scale` is per game: the sheet is drawn
   * at a finer resolution than either world, so each picks what makes it a boss
   * rather than a wall. `alphaScale` dims the whole sprite — the blit sets alpha
   * outright, so a caller cannot dim it from outside.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    treant: Treant,
    feetX: number,
    feetY: number,
    scale: number,
    alphaScale = 1,
  ): void {
    if (!this.ready) return;
    const { row, frame } = treant.pose();
    blitFrame(ctx, this.sheet.img, feetX, feetY, {
      cell: CELL,
      scale,
      anchorX: ANCHOR_X,
      anchorY: ANCHOR_Y,
      row,
      frame,
      alpha: treant.alpha() * alphaScale,
    });
    // The hearts hold steady through the recoil blink — a health count that
    // flickers is one nobody can read — and go with it when it goes down.
    if (treant.alive) drawHearts(ctx, treant.hp, HP, feetX, feetY - HEART_LIFT * scale, scale, alphaScale);
  }
}
