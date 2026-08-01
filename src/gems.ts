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
export const POP_UP = 5; // levels/sec out of the body
export const GRAVITY = 34; // levels/sec² — the hero's own fall, so a gem drops like one
/**
 * How near the hero has to be to sweep a gem up, in cells. Has to cover the whole
 * of `MELEE`: gems gate the level ladder, so one left lying where a monster died
 * at the tip of the blade would stall the run. `gems.test.ts` pins the pair.
 */
export const PICKUP_RANGE = 2;

export const gemUrl = (base: string = import.meta.env.BASE_URL): string => `${base}sunnyside/gem.png`;

export interface Gem {
  col: number;
  row: number;
  z: number;
  vz: number;
  /** The ground it fell from and comes back down to. */
  ground: number;
  resting: boolean;
}

export class Gems {
  private gems: Gem[] = [];
  collected = 0;

  reset(): void {
    this.gems = [];
    this.collected = 0;
  }

  /** A kill's worth, thrown straight up out of a body standing at `ground`. */
  spawn(col: number, row: number, ground: number): void {
    for (let i = 0; i < GEMS_PER_KILL; i++) {
      this.gems.push({ col, row, z: ground, vz: POP_UP, ground, resting: false });
    }
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
      if (gem.z > gem.ground) continue;
      gem.z = gem.ground;
      gem.vz = 0;
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
