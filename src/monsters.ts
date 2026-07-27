import type { World } from "./world";

// oboropixel slime (public/oboro/slime/): 96x96 side-view frames, one row per
// animation. Monsters home in on the hero and bump; a hit plays the death
// animation while fading out. Same pack as the "slime" hero skin.
const CELL = 96;
const SCALE = 3;
const ANCHOR_X = 48; // frame centre
const ANCHOR_Y = 56; // feet baseline within the 96px frame
const DEATH_FRAMES = 10;

export const FRAMES = 8; // slime walk frames
export const MON_FPS = 10; // walk playback rate

export const MAX_MONSTERS = 1;
export const SPEED = 2.6; // cells/sec — slower than the hero, so you can kite them
export const CONTACT = 0.55; // stop advancing this close: the "bump"
export const MELEE = 1.3; // a swing kills monsters within this radius
export const FADE = 0.4; // death: seconds to play the death anim and fade out
export const SPAWN_MIN = 7;
export const SPAWN_MAX = 12;

interface Pos {
  col: number;
  row: number;
}

export interface Monster {
  col: number;
  row: number;
  animT: number;
  dying: boolean;
  dyingT: number;
  faceLeft: boolean;
}

interface Sheet {
  img: HTMLImageElement;
  ok: boolean;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export class MonsterField {
  private walk: Sheet;
  private death: Sheet;
  private mons: Monster[] = [];
  private settled = 0;
  ready = false;

  constructor(base: string = import.meta.env.BASE_URL) {
    const load = (file: string): Sheet => {
      const sheet: Sheet = { img: new Image(), ok: false };
      const settle = (ok: boolean): void => {
        sheet.ok = ok;
        if (++this.settled === 2) this.ready = true;
      };
      sheet.img.onload = () => settle(true);
      sheet.img.onerror = () => settle(false);
      sheet.img.src = `${base}oboro/slime/${file}`;
      return sheet;
    };
    this.walk = load("walk.png");
    this.death = load("death.png");
  }

  reset(): void {
    this.mons = [];
  }

  list(): readonly Monster[] {
    return this.mons;
  }

  private spawn(hero: Pos, world: World): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
    this.mons.push({
      col: clamp(hero.col + Math.cos(angle) * dist, 1, world.cols - 2),
      row: clamp(hero.row + Math.sin(angle) * dist, 1, world.rows - 2),
      animT: Math.random(),
      dying: false,
      dyingT: 0,
      faceLeft: false,
    });
  }

  update(dt: number, hero: Pos, world: World): void {
    if (!this.ready) return;
    for (const m of this.mons) {
      m.animT += dt;
      if (m.dying) {
        m.dyingT += dt;
        continue;
      }
      // Home in on the hero; stop at contact distance and keep bumping.
      const dx = hero.col - m.col;
      const dy = hero.row - m.row;
      const d = Math.hypot(dx, dy);
      m.faceLeft = dx - dy < 0; // the hero's screen-x direction from the monster
      if (d > CONTACT) {
        const step = SPEED * dt;
        m.col += (dx / d) * step;
        m.row += (dy / d) * step;
      }
    }
    this.mons = this.mons.filter((m) => !(m.dying && m.dyingT >= FADE));
    while (this.mons.length < MAX_MONSTERS) this.spawn(hero, world);
  }

  /** Is a live monster bumping (col, row)? `CONTACT` is where they stop, so it is the bump radius. */
  touching(col: number, row: number): boolean {
    return this.mons.some((m) => !m.dying && Math.hypot(m.col - col, m.row - row) <= CONTACT);
  }

  /** A swing at (col, row): every alive monster within melee range dies. */
  attackAt(col: number, row: number): void {
    for (const m of this.mons) {
      if (!m.dying && Math.hypot(m.col - col, m.row - row) <= MELEE) {
        m.dying = true;
        m.dyingT = 0;
      }
    }
  }

  /** Draw one monster with its feet at (feetX, feetY). */
  draw(ctx: CanvasRenderingContext2D, m: Monster, feetX: number, feetY: number): void {
    if (!this.ready) return;
    const sheet = m.dying ? this.death : this.walk;
    if (!sheet.ok) return;

    let frame: number;
    let alpha = 1;
    if (m.dying) {
      const p = Math.min(1, m.dyingT / FADE);
      frame = Math.min(DEATH_FRAMES - 1, Math.floor(p * DEATH_FRAMES));
      alpha = 1 - p;
    } else {
      frame = Math.floor(m.animT * MON_FPS) % FRAMES;
    }

    const dx = Math.round(feetX - ANCHOR_X * SCALE);
    const dy = Math.round(feetY - ANCHOR_Y * SCALE);
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.imageSmoothingEnabled = false;
    if (m.faceLeft) {
      ctx.translate(feetX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-feetX, 0);
    }
    ctx.drawImage(sheet.img, frame * CELL, 0, CELL, CELL, dx, dy, CELL * SCALE, CELL * SCALE);
    ctx.restore();
  }
}
