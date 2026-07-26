import type { World } from "./world";

// "Free mons" 24x24 pack (public/mons/mons.png): a 7x6 grid of creatures in
// 30x26 cells, with 4 idle-bob frames stacked vertically (156px each).
const CW = 30;
const CH = 26;
const BLOCK_H = 156;
const FRAMES = 4;
const MON_FPS = 6;

// A few distinct creatures picked from the top rows (which sit cleanly in-cell).
const MONSTER_TYPES: [number, number][] = [
  [3, 0], // yellow
  [2, 2], // green
  [0, 2], // orange
];

const MAX_MONSTERS = 1;
const SPEED = 2.6; // cells/sec — slower than the hero, so you can kite them
const CONTACT = 0.55; // stop advancing this close: the "bump"
const MELEE = 1.3; // a swing kills monsters within this radius
const FADE = 0.4; // seconds to fade out on death
const SPAWN_MIN = 7;
const SPAWN_MAX = 12;

interface Pos {
  col: number;
  row: number;
}

export interface Monster {
  col: number;
  row: number;
  type: [number, number];
  animT: number;
  dying: boolean;
  fade: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export class MonsterField {
  private sheet = new Image();
  private mons: Monster[] = [];
  ready = false;

  constructor(base: string = import.meta.env.BASE_URL) {
    this.sheet.onload = () => {
      this.ready = true;
    };
    this.sheet.src = `${base}mons/mons.png`;
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
      type: MONSTER_TYPES[Math.floor(Math.random() * MONSTER_TYPES.length)]!,
      animT: Math.random(),
      dying: false,
      fade: 1,
    });
  }

  update(dt: number, hero: Pos, world: World): void {
    if (!this.ready) return;
    for (const m of this.mons) {
      m.animT += dt;
      if (m.dying) {
        m.fade -= dt / FADE;
        continue;
      }
      // Home in on the hero; stop at contact distance and keep bumping.
      const dx = hero.col - m.col;
      const dy = hero.row - m.row;
      const d = Math.hypot(dx, dy);
      if (d > CONTACT) {
        const step = SPEED * dt;
        m.col += (dx / d) * step;
        m.row += (dy / d) * step;
      }
    }
    this.mons = this.mons.filter((m) => !(m.dying && m.fade <= 0));
    while (this.mons.length < MAX_MONSTERS) this.spawn(hero, world);
  }

  /** A swing at (col, row): every alive monster within melee range dies. */
  attackAt(col: number, row: number): void {
    for (const m of this.mons) {
      if (!m.dying && Math.hypot(m.col - col, m.row - row) <= MELEE) m.dying = true;
    }
  }

  /** Draw one monster with its feet at (feetX, feetY). */
  draw(ctx: CanvasRenderingContext2D, m: Monster, feetX: number, feetY: number): void {
    if (!this.ready) return;
    const frame = Math.floor(m.animT * MON_FPS) % FRAMES;
    const sx = m.type[0] * CW;
    const sy = m.type[1] * CH + frame * BLOCK_H;
    const dw = CW * 2;
    const dh = CH * 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, m.fade);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.sheet, sx, sy, CW, CH, Math.round(feetX - dw / 2), Math.round(feetY - dh), dw, dh);
    ctx.restore();
  }
}
