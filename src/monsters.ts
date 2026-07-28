import type { World } from "./world";
import { blitFrame, frameAt, SheetLoader, type Sheet } from "./sprites";

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

export const WAVE_SIZE = 3; // monsters per wave
export const WAVE_BREAK = 1.5; // seconds of calm once a wave is cleared
export const WAVE_STAGGER = 1.4; // seconds between arrivals inside a wave
// Under 2 * CONTACT * sin(60 degrees) on purpose: that is how far apart three
// monsters stand when all three are touching the hero, so a wider berth than
// this would hold the last of them off the hero and stop it ever landing a bump.
export const SEPARATION = 0.8; // cells monsters keep between each other
const SEPARATION_RATE = 8; // per second — how quickly a stack eases apart
const SPREAD = 0.4; // share of its slice a spawn bearing may wander

export const SPEED = 2.6; // cells/sec — slower than the hero, so you can kite them
export const CONTACT = 0.55; // stop advancing this close: the "bump"
// Reach has to cover the ground a monster crosses between swings, or it can
// step from outside the blade to bumping the hero in a gap and take a heart
// however well the swing was timed. `encounter.test.ts` pins the relationship.
export const MELEE = 2; // a swing kills monsters within this radius
export const FADE = 0.6; // death: seconds to play the deflate animation out
const FADE_TAIL = 0.3; // last fraction of the death that fades — the rest is full opacity
export const KNOCKBACK = 1.6; // cells a killed monster is thrown, over the fade
export const SPAWN_MIN = 7;
export const SPAWN_MAX = 12;
// "lurk" mode: the monster guards a 5x5 square (this many cells each way).
export const AGGRO_HALF = 2;
// It wakes when the hero's footprint (one cell) *touches* that square, not once
// the hero is fully inside it — the Minkowski sum of the square's edge (+0.5)
// and the footprint's half-width (0.5). "hunt" mode ignores this.
export const AGGRO_REACH = AGGRO_HALF + 0.5 + 0.5;

// hunt: always close on the hero. lurk: only once the hero enters the square.
export type AggroMode = "hunt" | "lurk";

interface Pos {
  col: number;
  row: number;
}

/** Where a killing blow caught the monster, and the way it threw the body. */
export interface Knock {
  col: number;
  row: number;
  dx: number;
  dy: number;
}

export interface Monster {
  col: number;
  row: number;
  animT: number;
  dying: boolean;
  dyingT: number;
  faceLeft: boolean;
  knock: Knock | null;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export class MonsterField {
  private walk: Sheet;
  private death: Sheet;
  private mons: Monster[] = [];
  private loader = new SheetLoader(2);
  // Starts spent so the first wave walks in as soon as the sheets are ready.
  private calm = WAVE_BREAK;
  private mode: AggroMode = "hunt";

  get ready(): boolean {
    return this.loader.ready;
  }

  setMode(mode: AggroMode): void {
    this.mode = mode;
  }

  constructor(base: string = import.meta.env.BASE_URL) {
    this.walk = this.loader.load(`${base}oboro/slime/walk.png`);
    this.death = this.loader.load(`${base}oboro/slime/death.png`);
  }

  reset(): void {
    this.mons = [];
    this.calm = WAVE_BREAK;
  }

  list(): readonly Monster[] {
    return this.mons;
  }

  private spawnWave(hero: Pos, world: World): void {
    const bearing = Math.random() * Math.PI * 2;
    const slice = (Math.PI * 2) / WAVE_SIZE;
    const base = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
    for (let i = 0; i < WAVE_SIZE; i++) {
      // One slice of the ring each, so a wave closes in from several bearings
      // instead of as a single clump. The jitter stays inside its own slice.
      const angle = bearing + i * slice + (Math.random() - 0.5) * slice * SPREAD;
      // Each starts a stagger's worth of walking further out than the last, so
      // they arrive one at a time rather than as one wall.
      const dist = base + i * SPEED * WAVE_STAGGER;
      let col = clamp(hero.col + Math.cos(angle) * dist, 1, world.cols - 2);
      let row = clamp(hero.row + Math.sin(angle) * dist, 1, world.rows - 2);
      // Don't strand a spawn in the water — draw it in toward the hero to dry land.
      for (let k = 0; k < 20 && world.isWater?.(Math.round(col), Math.round(row)); k++) {
        col = clamp(col + (hero.col - col) * 0.15, 1, world.cols - 2);
        row = clamp(row + (hero.row - row) * 0.15, 1, world.rows - 2);
      }
      this.mons.push({
        col,
        row,
        animT: Math.random(),
        dying: false,
        dyingT: 0,
        faceLeft: false,
        knock: null,
      });
    }
  }

  // Every monster homes on the same point, so without this a wave ends up stacked
  // into what reads as one slime. Easing a share of the overlap away each frame
  // settles them around the hero rather than jittering against each other.
  private separate(dt: number): void {
    const ease = Math.min(1, SEPARATION_RATE * dt);
    for (let i = 0; i < this.mons.length; i++) {
      const a = this.mons[i]!;
      if (a.dying) continue;
      for (let j = i + 1; j < this.mons.length; j++) {
        const b = this.mons[j]!;
        if (b.dying) continue;
        let dx = b.col - a.col;
        let dy = b.row - a.row;
        let d = Math.hypot(dx, dy);
        if (d >= SEPARATION) continue;
        if (d === 0) {
          dx = 1; // exactly stacked leaves no axis to push along
          dy = 0;
          d = 1;
        }
        const shift = ((SEPARATION - d) / 2) * ease;
        const ux = (dx / d) * shift;
        const uy = (dy / d) * shift;
        a.col -= ux;
        a.row -= uy;
        b.col += ux;
        b.row += uy;
      }
    }
  }

  update(dt: number, hero: Pos, world: World): void {
    if (!this.ready) return;
    for (const m of this.mons) {
      m.animT += dt;
      if (m.dying) {
        m.dyingT += dt;
        if (m.knock) {
          // Anchored to where the blow landed rather than integrated per frame,
          // so the throw covers the same ground whatever the frame rate.
          const p = Math.min(1, m.dyingT / FADE);
          const eased = p * (2 - p); // ease-out: thrown hard, settling as it fades
          m.col = m.knock.col + m.knock.dx * KNOCKBACK * eased;
          m.row = m.knock.row + m.knock.dy * KNOCKBACK * eased;
        }
        continue;
      }
      // Home in on the hero; stop at contact distance and keep bumping.
      const dx = hero.col - m.col;
      const dy = hero.row - m.row;
      const d = Math.hypot(dx, dy);
      m.faceLeft = dx - dy < 0; // the hero's screen-x direction from the monster
      // In lurk mode a monster only stirs once the hero is inside its square.
      const awake = this.mode === "hunt" || (Math.abs(dx) <= AGGRO_REACH && Math.abs(dy) <= AGGRO_REACH);
      if (awake && d > CONTACT) {
        const step = SPEED * dt;
        // Per-axis, blocked by water, so a slime slides along the shore.
        const nc = m.col + (dx / d) * step;
        if (!world.isWater?.(Math.round(nc), Math.round(m.row))) m.col = nc;
        const nr = m.row + (dy / d) * step;
        if (!world.isWater?.(Math.round(m.col), Math.round(nr))) m.row = nr;
      }
    }
    this.mons = this.mons.filter((m) => !(m.dying && m.dyingT >= FADE));
    this.separate(dt);

    // Waves, not a trickle: the field stays empty until the whole batch is gone,
    // then the next one walks in after a breather.
    if (this.mons.length > 0) {
      this.calm = 0;
      return;
    }
    this.calm += dt;
    if (this.calm < WAVE_BREAK) return;
    this.spawnWave(hero, world);
    this.calm = 0;
  }

  /** The live monster bumping (col, row), if any. They stop at `CONTACT`, so that is the bump radius. */
  contactAt(col: number, row: number): Monster | null {
    return this.mons.find((m) => !m.dying && Math.hypot(m.col - col, m.row - row) <= CONTACT) ?? null;
  }

  /** A swing at (col, row): every alive monster within melee range dies, thrown clear of the blow. */
  attackAt(col: number, row: number): void {
    for (const m of this.mons) {
      if (m.dying) continue;
      const dx = m.col - col;
      const dy = m.row - row;
      const d = Math.hypot(dx, dy);
      if (d > MELEE) continue;
      m.dying = true;
      m.dyingT = 0;
      // A blow landing dead-on leaves no direction to throw along; pick one.
      const away = d > 0 ? { dx: dx / d, dy: dy / d } : { dx: 0, dy: 1 };
      m.knock = { col: m.col, row: m.row, ...away };
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
      // Full opacity through the deflate, fading only over the tail, so the
      // death reads as an animation rather than a fade.
      alpha = p < 1 - FADE_TAIL ? 1 : Math.max(0, (1 - p) / FADE_TAIL);
    } else {
      frame = frameAt(m.animT, MON_FPS, FRAMES, true);
    }

    blitFrame(ctx, sheet.img, feetX, feetY, {
      cell: CELL,
      scale: SCALE,
      anchorX: ANCHOR_X,
      anchorY: ANCHOR_Y,
      frame,
      flip: m.faceLeft,
      alpha,
    });
  }
}
