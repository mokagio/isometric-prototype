import type { World } from "./world";
import { createMonsterSkin, type MonsterSkin, type MonsterSkinKind } from "./monsterSkin";
import { drawHearts } from "./hearts";

// Monsters home in on the hero and bump; enough blows plays their end while fading
// out. What they look like is the skin's business — this file is the wave, the
// chase and the death, and knows nothing about a sheet.
export { FADE, MONSTER_SKIN } from "./monsterSkin";
import { FADE } from "./monsterSkin";

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
export const MELEE = 2; // a swing takes a heart off monsters within this radius
export const KNOCKBACK = 1.6; // cells a killed monster is thrown, over the fade
// Every blow shoves a monster back, not just the killing one. A survivor left
// standing where it was hit is still bumping the hero with its blow already
// spent, so a creature that takes more than one hit always traded a heart for
// each of them, however well the swing was timed. Reeling, it neither advances
// nor bumps, and by the time it is over it has ground to make up: that gap is
// what a player who keeps swinging is buying. `encounter.test.ts` pins it.
export const RECOIL = 1.2; // cells a monster is shoved by a blow it survives
export const RECOIL_TIME = 0.15; // seconds the shove takes
// A monster that survives a blow blinks, the way the boss does: the mons pack
// draws no hurt pose, so the blink is the whole tell that the blow landed.
export const HURT = 0.3; // seconds of blinking per blow survived
export const BLINK_HZ = 14;
export const BLINK_ALPHA = 0.3;
// The heart row over a monster's head, in screen pixels. Deliberately smaller
// than the boss's: it sits over a 62px creature, not a 300px battler.
export const HEART_SCALE = 1.2;
export const HEART_LIFT = 8; // clear of the top of the art, which the skin's `lift` gives
export const SPAWN_MIN = 7;
export const SPAWN_MAX = 12;
// "lurk" mode: the monster watches a 9x9 square (this many cells each way),
// centred on where it spawned rather than on where it currently stands, so an
// ambling monster cannot walk its own watch square across the map.
export const AGGRO_HALF = 4;
// It wakes when the hero's footprint (one cell) *touches* that square, not once
// the hero is fully inside it — the Minkowski sum of the square's edge (+0.5)
// and the footprint's half-width (0.5). "hunt" mode ignores this.
export const AGGRO_REACH = AGGRO_HALF + 0.5 + 0.5;

/**
 * Seconds a chasing monster will grind against something before giving up and
 * leaving. Long enough that rounding a corner never triggers it, short enough
 * that a wave stranded across a river does not hold the ladder up.
 */
export const GIVE_UP = 6;
/**
 * How fast that count falls again once the way is clear. It decays rather than
 * resetting because a monster juddering against a shore comes free for the odd
 * frame — it ends up sitting right on a cell's rounding boundary — and a hard
 * reset would let one such frame in twenty wipe the record and strand it there
 * for good.
 */
export const GIVE_UP_RECOVER = 2;

// Idle wandering while it lurks: amble to a waypoint near the post, stand still
// for a beat, pick another. Displaced monsters wander home again, since every
// waypoint is drawn from the square around `home`.
// Deliberately tighter than the watch square: a monster notices the hero from
// further off than it strays, so it stays recognisably posted where it spawned.
export const WANDER_HALF = 2; // cells each way it ambles from its post
export const WANDER_SPEED = 0.9; // cells/sec — an amble, well under a chase
export const WANDER_PAUSE = 1.6; // max seconds of stillness between legs
export const WANDER_ARRIVE = 0.15; // cells: close enough to call the waypoint reached

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
  /** Which of the skin's cast this one is. The level says, so a wave is all one creature. */
  kind: number;
  /** Blows it has left. What it spawned with is the level's, and shows as hearts over its head. */
  hp: number;
  hpMax: number;
  /** Seconds left of the blink that says a blow landed without felling it. */
  hurtT: number;
  /** Seconds left of the shove a survived blow put it into. */
  reelT: number;
  /** Seconds it has spent chasing with something in the way. */
  stuckT: number;
  knock: Knock | null;
  /** Where it spawned: the centre of the square it guards and wanders inside. */
  home: Pos;
  waypoint: Pos;
  /** Seconds it stands still before setting off for the waypoint. */
  pause: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/**
 * Where a throw has carried a monster by `p` (0 to 1) of its run. Anchored to
 * where the blow landed rather than integrated per frame, so it covers the same
 * ground whatever the frame rate.
 */
function thrownTo(k: Knock, dist: number, p: number): Pos {
  const eased = p * (2 - p); // ease-out: thrown hard, settling as it goes
  return { col: k.col + k.dx * dist * eased, row: k.row + k.dy * dist * eased };
}

// Monsters keep out of every pool, walls and hazards alike. The hero can wade
// lava at a heart a second; nothing follows them in, which is the point.
const barred = (world: World, col: number, row: number): boolean =>
  world.blocks?.(col, row) === true || world.isHazard?.(col, row) === true;

export class MonsterField {
  private skin: MonsterSkin;
  private mons: Monster[] = [];
  // Starts spent so the first wave walks in as soon as the sheets are ready.
  private calm = WAVE_BREAK;
  private mode: AggroMode = "hunt";
  // What the next wave will be. The ladder sets it; a wave already walking keeps
  // whatever it spawned with, so levelling up never re-skins what is on the field.
  private hp = 1;
  private kind = 0;

  get ready(): boolean {
    return this.skin.ready;
  }

  /** How many creatures the art holds, so the ladder knows what it may pick from. */
  get cast(): number {
    return this.skin.cast;
  }

  setMode(mode: AggroMode): void {
    this.mode = mode;
  }

  /** What the next wave is made of: one creature, and how many blows each takes. */
  setLevel(hp: number, kind: number): void {
    this.hp = Math.max(1, Math.floor(hp));
    this.kind = kind;
  }

  constructor(base?: string, kind?: MonsterSkinKind) {
    this.skin = createMonsterSkin(kind, base);
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
      for (let k = 0; k < 20 && barred(world, Math.round(col), Math.round(row)); k++) {
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
        kind: this.kind,
        hp: this.hp,
        hpMax: this.hp,
        hurtT: 0,
        reelT: 0,
        stuckT: 0,
        knock: null,
        home: { col, row },
        waypoint: { col, row },
        // Staggered, or a wave would amble off in lockstep.
        pause: Math.random() * WANDER_PAUSE,
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

  /** A fresh waypoint near the post, and a beat of stillness before it sets off. */
  private restWaypoint(m: Monster, world: World): void {
    m.pause = Math.random() * WANDER_PAUSE;
    m.waypoint = {
      col: clamp(m.home.col + (Math.random() * 2 - 1) * WANDER_HALF, 1, world.cols - 2),
      row: clamp(m.home.row + (Math.random() * 2 - 1) * WANDER_HALF, 1, world.rows - 2),
    };
  }

  /** Amble toward the current waypoint, then rest and pick another. */
  private wander(m: Monster, dt: number, world: World): void {
    if (m.pause > 0) {
      m.pause -= dt;
      return;
    }
    const dx = m.waypoint.col - m.col;
    const dy = m.waypoint.row - m.row;
    const d = Math.hypot(dx, dy);
    if (d <= WANDER_ARRIVE) {
      this.restWaypoint(m, world);
      return;
    }
    m.faceLeft = dx - dy < 0;
    const step = Math.min(WANDER_SPEED * dt, d);
    const before = { col: m.col, row: m.row };
    const nc = m.col + (dx / d) * step;
    if (!barred(world, Math.round(nc), Math.round(m.row))) m.col = nc;
    const nr = m.row + (dy / d) * step;
    if (!barred(world, Math.round(m.col), Math.round(nr))) m.row = nr;
    // Walled off from the waypoint by water: rest and choose somewhere reachable
    // instead of grinding against the shore for the rest of the wave.
    if (m.col === before.col && m.row === before.row) this.restWaypoint(m, world);
  }

  update(dt: number, hero: Pos, world: World): void {
    if (!this.ready) return;
    for (const m of this.mons) {
      m.animT += dt;
      if (m.hurtT > 0) m.hurtT = Math.max(0, m.hurtT - dt);
      if (m.dying) {
        m.dyingT += dt;
        if (m.knock) {
          const to = thrownTo(m.knock, KNOCKBACK, Math.min(1, m.dyingT / FADE));
          // A body on its way out is not stopped by the ground: it is fading.
          m.col = to.col;
          m.row = to.row;
        }
        continue;
      }
      if (m.reelT > 0 && m.knock) {
        m.reelT = Math.max(0, m.reelT - dt);
        const to = thrownTo(m.knock, RECOIL, 1 - m.reelT / RECOIL_TIME);
        // Per-axis and blocked like a walk, so one shoved towards a river ends up
        // on the bank rather than reeling into water it could never have entered.
        if (!barred(world, Math.round(to.col), Math.round(m.row))) m.col = to.col;
        if (!barred(world, Math.round(m.col), Math.round(to.row))) m.row = to.row;
        continue;
      }
      // Home in on the hero; stop at contact distance and keep bumping.
      const dx = hero.col - m.col;
      const dy = hero.row - m.row;
      const d = Math.hypot(dx, dy);
      // In lurk mode a monster only stirs once the hero enters its square, and
      // ambles around inside it until then.
      const awake =
        this.mode === "hunt" ||
        (Math.abs(hero.col - m.home.col) <= AGGRO_REACH && Math.abs(hero.row - m.home.row) <= AGGRO_REACH);
      if (!awake) {
        this.wander(m, dt, world);
        continue;
      }
      m.faceLeft = dx - dy < 0; // the hero's screen-x direction from the monster
      if (d > CONTACT) {
        const step = SPEED * dt;
        // Per-axis, blocked by water, so a slime slides along the shore.
        const nc = m.col + (dx / d) * step;
        const colFree = !barred(world, Math.round(nc), Math.round(m.row));
        if (colFree) m.col = nc;
        const nr = m.row + (dy / d) * step;
        const rowFree = !barred(world, Math.round(m.col), Math.round(nr));
        if (rowFree) m.row = nr;
        // Something is in the way. Brushing a corner clears in a frame or two;
        // grinding against the same shore for GIVE_UP seconds means the hero is
        // across water this monster cannot cross, and it stops trying.
        m.stuckT = colFree && rowFree ? Math.max(0, m.stuckT - dt * GIVE_UP_RECOVER) : m.stuckT + dt;
        if (m.stuckT >= GIVE_UP) this.giveUp(m);
      } else {
        m.stuckT = 0; // arrived: bumping is not being stuck
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

  /**
   * A monster that cannot reach the hero fades out and leaves, dropping nothing —
   * only a killing blow does that. Without this a wave stranded across a river
   * never empties the field, no next wave comes, and since gems gate the ladder
   * the run is over without ever saying so.
   */
  private giveUp(m: Monster): void {
    m.dying = true;
    m.dyingT = 0;
    m.knock = null; // nothing threw it: it just walks out of the story
  }

  /**
   * The live monster bumping (col, row), if any. They stop at `CONTACT`, so that
   * is the bump radius. One still reeling from a blow is not bumping anybody:
   * without that the blow and the bump land on the same frame, and the shove
   * would arrive a frame too late to have saved the hero from anything.
   */
  contactAt(col: number, row: number): Monster | null {
    return (
      this.mons.find(
        (m) => !m.dying && m.reelT <= 0 && Math.hypot(m.col - col, m.row - row) <= CONTACT,
      ) ?? null
    );
  }

  /**
   * A swing at (col, row): every alive monster within melee range loses a heart,
   * and the ones that run out die, thrown clear of the blow. Returns those, still
   * standing where the blow caught them — which is where whatever they drop
   * belongs, rather than wherever the knockback carries the body.
   *
   * One swing lands on a single frame (`Swing.update`), so a monster cannot lose
   * two hearts to one blow and needs no immunity window of its own.
   */
  attackAt(col: number, row: number): Monster[] {
    const felled: Monster[] = [];
    for (const m of this.mons) {
      if (m.dying) continue;
      const dx = m.col - col;
      const dy = m.row - row;
      const d = Math.hypot(dx, dy);
      if (d > MELEE) continue;
      // A blow landing dead-on leaves no direction to throw along; pick one.
      const away = d > 0 ? { dx: dx / d, dy: dy / d } : { dx: 0, dy: 1 };
      m.knock = { col: m.col, row: m.row, ...away };
      m.hp -= 1;
      if (m.hp > 0) {
        m.hurtT = HURT;
        m.reelT = RECOIL_TIME;
        continue;
      }
      m.dying = true;
      m.dyingT = 0;
      felled.push(m);
    }
    return felled;
  }

  /** How solidly one draws: it blinks while smarting from a blow it survived. */
  private alphaOf(m: Monster): number {
    if (m.hurtT <= 0) return 1;
    return Math.floor((HURT - m.hurtT) * BLINK_HZ) % 2 === 0 ? BLINK_ALPHA : 1;
  }

  /**
   * Draw one monster with its feet at (feetX, feetY), through whichever skin is in
   * play, with its remaining hearts over its head. The hearts go with it when it
   * dies, and hold steady through the hurt blink — a health count that flickers is
   * one nobody can read.
   */
  draw(ctx: CanvasRenderingContext2D, m: Monster, feetX: number, feetY: number, alphaScale = 1): void {
    this.skin.draw(ctx, m, feetX, feetY, this.alphaOf(m) * alphaScale);
    if (m.dying) return;
    const baseY = feetY - this.skin.lift(m.kind) - HEART_LIFT;
    drawHearts(ctx, m.hp, m.hpMax, feetX, baseY, HEART_SCALE, alphaScale);
  }
}
