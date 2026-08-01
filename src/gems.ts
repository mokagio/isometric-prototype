import { blitFrame, SheetLoader, type Sheet } from "./sprites";

// The experience a slain monster leaves behind: a gem that pops out of the body,
// lands on the cell it died on and lies there until the hero walks over it.
// World coordinates are the map's own cells, and `z` is elevation levels, as the
// hero's own jump is.

/**
 * One 10x10 tile cut from the Sunnyside tileset — the blue ore nugget at cell
 * (55, 26) — trimmed to its own content, so it stands on the bottom of its frame.
 */
export const CELL = 10;
export const ANCHOR_X = 5;
export const ANCHOR_Y = 10;
/** A 10px gem at the world's own 2x is a speck beside a 96px tile. */
export const SCALE = 3;

export const GEMS_PER_KILL = 1;
/** What the boss is worth, against a monster's one — its own five blows and then some. */
export const BOSS_GEMS = 9;
export const POP_UP = 5; // levels/sec out of the body
export const GRAVITY = 34; // levels/sec² — the hero's own fall, so a gem drops like one
/** Seconds a hop lasts: up and back down again, which is what turns a distance into a speed. */
export const FLIGHT = (2 * POP_UP) / GRAVITY;
/** How far out the widest of a burst lands, in cells. */
export const SCATTER = 1.3;
// Thrown at one distance, a burst lands on a single ring, which reads as a fence
// rather than a scatter. Stepping through these fractions of `SCATTER` puts each
// gem down at its own distance. A single drop skips them: it falls where it fell.
const RUNGS = [1, 0.55, 0.85, 0.4, 0.7];
/** How near the hero has to be to sweep a gem up, in cells. */
export const PICKUP_RANGE = 0.9;
// How finely a blocked landing is walked back in toward the burst — the same
// "draw it in to dry land" move a monster spawned in a lake makes.
const WALK_BACK = 0.25;
// Where every step of that walk is blocked, gems still fan out this far on their
// own bearings rather than stacking on one point, which would draw as one gem
// however many are really there. Under half a cell, so the huddle cannot round
// into the neighbour that barred them in the first place.
const HUDDLE = 0.4;

export const gemUrl = (base: string = import.meta.env.BASE_URL): string => `${base}sunnyside/gem.png`;

/** What a gem needs to know about the ground it is thrown across. */
export interface Terrain {
  /** The level of the cell a gem comes down on. */
  heightAt(col: number, row: number): number;
  /** Where a gem must never come to rest: water, lava — anywhere it could not be fetched from. */
  barred(col: number, row: number): boolean;
}

export interface Gem {
  col: number;
  row: number;
  z: number;
  vz: number;
  vcol: number;
  vrow: number;
  /** The level it comes down to, and the point on it: where it is put once it lands. */
  ground: number;
  restCol: number;
  restRow: number;
  resting: boolean;
}

export class Gems {
  private gems: Gem[] = [];
  collected = 0;

  reset(): void {
    this.gems = [];
    this.collected = 0;
  }

  /**
   * A kill's worth thrown out of a body standing on (col, row) — one gem straight
   * up where it fell, a boss's burst fanned around it. Every gem's landing cell is
   * settled here rather than found on impact, so a throw over a river comes down
   * short of the bank instead of into it.
   */
  spawn(col: number, row: number, terrain: Terrain, count = GEMS_PER_KILL): void {
    const level = terrain.heightAt(Math.round(col), Math.round(row));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const reach = count > 1 ? SCATTER * RUNGS[i % RUNGS.length]! : 0;
      const away = this.clearOf(col, row, angle, reach, terrain, level);
      const restCol = col + Math.cos(angle) * away;
      const restRow = row + Math.sin(angle) * away;
      this.gems.push({
        col,
        row,
        z: level,
        vz: POP_UP,
        vcol: (restCol - col) / FLIGHT,
        vrow: (restRow - row) / FLIGHT,
        ground: level,
        restCol,
        restRow,
        resting: false,
      });
    }
  }

  /**
   * How far along `angle` a gem can be thrown and still land somewhere it can be
   * fetched from. Terraces are whole levels and the hop clears well under one, so
   * a gem never leaves the level it was thrown from — which is what keeps the
   * flight honest, since `FLIGHT` is the airtime of a hop that lands where it took
   * off from.
   */
  private clearOf(
    col: number,
    row: number,
    angle: number,
    reach: number,
    terrain: Terrain,
    level: number,
  ): number {
    for (let away = reach; away > 0; away -= WALK_BACK) {
      const c = Math.round(col + Math.cos(angle) * away);
      const r = Math.round(row + Math.sin(angle) * away);
      if (!terrain.barred(c, r) && terrain.heightAt(c, r) === level) return away;
    }
    return reach > 0 ? HUDDLE : 0; // hemmed in: underfoot beats in the river
  }

  list(): readonly Gem[] {
    return this.gems;
  }

  /** Drop the loose gems, then sweep up any the hero is standing over. Returns how many. */
  update(dt: number, hero: { col: number; row: number }): number {
    for (const gem of this.gems) {
      if (gem.resting) continue;
      gem.vz -= GRAVITY * dt;
      gem.z += gem.vz * dt;
      gem.col += gem.vcol * dt;
      gem.row += gem.vrow * dt;
      if (gem.z > gem.ground) continue;
      // Put down on the cell the throw was aimed at: a hop onto a terrace of a
      // different height is in the air for longer or shorter than `FLIGHT`, and
      // the drift that buys is not worth landing a gem in the water over.
      gem.z = gem.ground;
      gem.vz = 0;
      gem.vcol = 0;
      gem.vrow = 0;
      gem.col = gem.restCol;
      gem.row = gem.restRow;
      gem.resting = true;
    }

    const before = this.gems.length;
    // Only what has settled: a gem still in the air is on its way out of the
    // body, and snatching it mid-flight looks like it was never dropped.
    this.gems = this.gems.filter(
      (g) => !(g.resting && Math.hypot(g.col - hero.col, g.row - hero.row) <= PICKUP_RANGE),
    );
    const taken = before - this.gems.length;
    this.collected += taken;
    return taken;
  }
}

/** The sheet, and the one way to put a gem on screen. */
export class GemArt {
  private sheet: Sheet;
  private loader = new SheetLoader(1);

  constructor(base?: string) {
    this.sheet = this.loader.load(gemUrl(base));
  }

  get ready(): boolean {
    return this.loader.ready && this.sheet.ok;
  }

  /** Draw one with its base at (x, y). */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (!this.ready) return;
    blitFrame(ctx, this.sheet.img, x, y, {
      cell: CELL,
      scale: SCALE,
      anchorX: ANCHOR_X,
      anchorY: ANCHOR_Y,
      frame: 0,
    });
  }
}
