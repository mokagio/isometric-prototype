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
 * That is why the boss is rooted in both games rather than chasing anybody.
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
/**
 * Seconds it stands quiet between roars. Has to be well under the time five
 * swings take, or a hero who simply holds the button kills it before it ever
 * threatens them — `encounter.test.ts` fights it at point blank to hold that.
 */
export const ROAR_EVERY = 1.2;
export const ROAR = 0.9; // seconds the roar itself takes
// The lash lands partway through the rear-up rather than at the end: what follows
// is the treant settling back down, and nobody should have to wait that out to
// know whether they were caught. Same shape as `Swing`'s `ATTACK_HIT_AT`.
export const ROAR_HIT_AT = 0.5;
export const DYING = 1; // seconds the fire takes to go out
// It blinks through the recoil, the way the hero blinks through their own
// immunity window — the recoil pose alone is a subtle read on a sprite this dark,
// and a blow that lands has to be unmistakable.
export const BLINK_HZ = 14;
export const BLINK_ALPHA = 0.3;
/**
 * Cells the roar hurts inside. Peaceful Plains is the only game that reads it:
 * Whispering Woods has no hearts to take, so there the boss is a tree to chop.
 */
export const LASH_REACH = 2.6;

/** Cells from the hero's own spawn to the boss's post: a short walk, in plain sight. */
export const BOSS_WALK = 6;
const BOSS_BEARINGS = 12; // ways out from the spawn to try before giving up

export interface Post {
  col: number;
  row: number;
}

/**
 * Where the boss stands. Circles the hero's spawn at arm's length, and on any
 * bearing that runs into water or lava steps back in toward the hero until the
 * ground is standable — the same "walk it back to dry land" move `MonsterField`
 * makes for a spawn that lands in a lake.
 *
 * Deterministic: the world is a pure function of its seed, so the boss should be
 * in the same place every time that seed is played.
 */
export function bossPost(
  spawn: Post,
  bounds: { cols: number; rows: number },
  barred: (col: number, row: number) => boolean,
): Post {
  for (let i = 0; i < BOSS_BEARINGS; i++) {
    const angle = (i / BOSS_BEARINGS) * Math.PI * 2;
    for (let away = BOSS_WALK; away >= 2; away--) {
      const col = Math.round(spawn.col + Math.cos(angle) * away);
      const row = Math.round(spawn.row + Math.sin(angle) * away);
      if (col < 1 || row < 1 || col > bounds.cols - 2 || row > bounds.rows - 2) continue;
      if (!barred(col, row)) return { col, row };
    }
  }
  return spawn; // an island too small to stand a boss on: better underfoot than gone
}

/**
 * The hearts over its head: how many blows it has left, in the same emoji the
 * hero's own row uses. Sized in sheet pixels so they scale with the sprite, and
 * spent ones are dimmed rather than dropped, so the row keeps its width and the
 * count stays readable at a glance — as `game.html` does for the hero.
 */
const HEART = "❤️";
export const HEART_SIZE = 11; // sheet pixels
export const HEART_GAP = 2;
// Clear of the tallest pose, which tops out 92 sheet pixels above the feet.
export const HEART_LIFT = 100;
export const HEART_SPENT_ALPHA = 0.28;

/** Lay a row of hearts, centred on `midX`, `left` of them still to be taken. */
export function drawHearts(
  ctx: CanvasRenderingContext2D,
  left: number,
  total: number,
  midX: number,
  baseY: number,
  scale: number,
  alphaScale = 1,
): void {
  const size = HEART_SIZE * scale;
  const step = size + HEART_GAP * scale;
  const start = midX - ((total - 1) * step) / 2;
  ctx.save();
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  for (let i = 0; i < total; i++) {
    ctx.globalAlpha = (i < left ? 1 : HEART_SPENT_ALPHA) * alphaScale;
    ctx.fillText(HEART, start + i * step, baseY);
  }
  ctx.restore();
}

export type Stance = "idle" | "roar" | "hurt" | "dying" | "fallen";

export interface Pose {
  row: number;
  frame: number;
}

/**
 * The boss: a rooted treant that stands, roars on a clock, staggers when hit, and
 * burns out. Pure state — both games drive it the same way and neither owns the
 * animation, so a pose that reads wrong is fixed in one place.
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
