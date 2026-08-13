import { blitFrame, SheetLoader, type Sheet } from "./sprites";

// The experience a slain monster leaves behind: a gem per heart it had, popped
// out of the body away from whoever struck it, lying where they land until the
// hero walks over them. World coordinates are the map's own cells, and `z` is
// elevation levels, as the hero's own jump is.

/**
 * One 10x10 tile cut from the Sunnyside tileset — the blue ore nugget at cell
 * (55, 26) — trimmed to its own content, so it stands on the bottom of its frame.
 */
export const CELL = 10;
export const ANCHOR_X = 5;
export const ANCHOR_Y = 10;
/** A 10px gem at the world's own 2x is a speck beside a 96px tile. */
export const SCALE = 3;

export const POP_UP = 5; // levels/sec out of the body
export const GRAVITY = 34; // levels/sec² — the hero's own fall, so a gem drops like one
/** Seconds a hop lasts: up and back down again, which is what turns a distance into a speed. */
export const FLIGHT = (2 * POP_UP) / GRAVITY;
/**
 * How far out of the body a gem is thrown, in cells, along the bearing away from
 * whoever struck it. Further than `PICKUP_RANGE` on purpose: a kill is worth a
 * short walk, and a gem that lands under the feet of the hero who earned it is a
 * reward nobody notices. `gems.test.ts` pins the pair.
 */
export const THROW = 1.4;
/** How near the hero has to be to sweep a gem up, in cells. */
export const PICKUP_RANGE = 0.9;
/**
 * How wide a fan a drop of several gems is thrown in, in radians, centred on the
 * bearing away from the blow. Wide enough that a three-heart monster leaves three
 * things to walk over rather than one pile, narrow enough that no gem in the fan
 * comes down behind the hero who earned it.
 */
export const SPREAD = Math.PI / 2;
// How finely a blocked landing is walked back in toward the body — the same
// "draw it in to dry land" move a monster spawned in a lake makes. Where every
// step is blocked the gem drops where it fell, which is ground a monster was
// standing on and so ground the hero can fetch it from.
const WALK_BACK = 0.2;

export const gemUrl = (base: string = import.meta.env.BASE_URL): string => `${base}sunnyside/gem.png`;

interface Pos {
  col: number;
  row: number;
}

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
   * `count` gems thrown out of a body standing on (col, row), along the bearing
   * away from `from` — where the blow came from, so they land clear of the hero
   * rather than at their feet. Several fan out around that bearing, each finding
   * its own landing. The landing cell is settled here rather than found on impact,
   * so a throw over a river comes down short of the bank instead of into it.
   */
  spawn(col: number, row: number, terrain: Terrain, from: Pos, count = 1): void {
    const level = terrain.heightAt(Math.round(col), Math.round(row));
    const dc = col - from.col;
    const dr = row - from.row;
    // A blow landing dead-on leaves no bearing to throw along; pick one.
    const bearing = Math.hypot(dc, dr) > 0 ? Math.atan2(dr, dc) : Math.PI / 2;
    for (let i = 0; i < count; i++) {
      const angle = count > 1 ? bearing + SPREAD * (i / (count - 1) - 0.5) : bearing;
      const away = { dc: Math.cos(angle), dr: Math.sin(angle) };
      const reach = this.clearOf(col, row, away, terrain, level);
      const restCol = col + away.dc * reach;
      const restRow = row + away.dr * reach;
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
   * How far along `away` a gem can be thrown and still land somewhere it can be
   * fetched from. Terraces are whole levels and the hop clears well under one, so
   * a gem never leaves the level it was thrown from — which is what keeps the
   * flight honest, since `FLIGHT` is the airtime of a hop that lands where it took
   * off from.
   */
  private clearOf(
    col: number,
    row: number,
    away: { dc: number; dr: number },
    terrain: Terrain,
    level: number,
  ): number {
    for (let reach = THROW; reach > 0; reach -= WALK_BACK) {
      const c = Math.round(col + away.dc * reach);
      const r = Math.round(row + away.dr * reach);
      if (!terrain.barred(c, r) && terrain.heightAt(c, r) === level) return reach;
    }
    return 0; // hemmed in: underfoot beats in the river
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
      // Put down on the cell the throw was aimed at: a hop that overshoots its
      // airtime by a frame is not worth landing a gem in the water over.
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
