import { assetUrl, loadSheet, type Sheet } from "./assets";
import type { Dungeon } from "./dungeon";
import { lineClear, type Cell, type FlowField } from "./flow";
import { ZOOM } from "./grid";
import type { FloorAt } from "./hero";

// The enemy pack draws every creature side-on in a 32x32 frame, standing on
// cell-y 29, one animation per horizontal strip. Left is a horizontal flip.
const FRAME = 32;
const FEET_Y = 29;

export type Action = "idle" | "walk" | "attack" | "death";

interface Anim {
  frames: number;
  fps: number;
  loop: boolean;
}

export interface Kind {
  name: string;
  anims: Record<Action, Anim>;
}

export const KINDS: readonly Kind[] = [
  {
    name: "skeleton",
    anims: {
      idle: { frames: 6, fps: 8, loop: true },
      walk: { frames: 10, fps: 12, loop: true },
      attack: { frames: 9, fps: 12, loop: true },
      death: { frames: 17, fps: 16, loop: false },
    },
  },
  {
    name: "skeleton2",
    anims: {
      idle: { frames: 6, fps: 8, loop: true },
      walk: { frames: 10, fps: 12, loop: true },
      attack: { frames: 15, fps: 16, loop: true },
      death: { frames: 15, fps: 14, loop: false },
    },
  },
  {
    name: "vampire",
    anims: {
      idle: { frames: 6, fps: 8, loop: true },
      walk: { frames: 8, fps: 12, loop: true },
      attack: { frames: 16, fps: 16, loop: true },
      death: { frames: 14, fps: 12, loop: false },
    },
  },
];

const ACTIONS: readonly Action[] = ["idle", "walk", "attack", "death"];

// Each dungeon is stocked once, at generation, and never refills: what is in
// there is what Amelia has to get past. Everything is measured in flood steps
// through the dungeon rather than distance across it, so a wall between her and
// an enemy counts for something.
//
// Nothing is placed this close to where she starts, so the first room is hers.
export const SAFE_STEPS = 14;
// How near she has to get before an enemy notices her. The camera shows roughly
// ten cells across, so anything still asleep is off the edge of the screen and
// waking reads as walking in on it.
export const WAKE_STEPS = 9;
// Enemies per room, and the extra granted per dungeon cleared.
export const ROSTER_PER_ROOM = 2;
export const ROSTER_STEP = 0.5;
export const ROSTER_MAX_PER_ROOM = 5;

export const SPEED = 2.8; // cells/sec — slower than the hero, so you can kite them
export const CONTACT = 0.7; // stop advancing this close, and start swinging
// Reach has to cover the ground an enemy crosses between swings, or it can step
// from outside the blade to touching the hero in a gap and take a heart however
// well the swing was timed.
export const MELEE = 1.9; // a swing kills anything within this radius
export const DEATH_TIME = 1.1; // seconds the death animation is given
const FADE_TAIL = 0.25; // last share of the death that fades; the rest is full opacity
export const KNOCKBACK = 1.4; // cells a killed enemy is thrown, over the death
// Under 2 * CONTACT * sin(60 degrees) on purpose: that is how far apart three
// enemies stand when all three are touching the hero, so a wider berth would
// hold the last of them off and stop it ever landing a blow.
export const SEPARATION = 1;
const SEPARATION_RATE = 8; // per second — how quickly a stack eases apart
export const RADIUS = 0.32; // half an enemy's footprint, for wall collision

// What a woken enemy does when Amelia gets away: "hunt" follows her across the
// dungeon, "lurk" loses interest and settles back down.
export type AggroMode = "hunt" | "lurk";

interface Pos {
  col: number;
  row: number;
}

export interface Enemy {
  kind: Kind;
  col: number;
  row: number;
  animT: number;
  /** Has not noticed Amelia yet: idles in place and is not chasing anything. */
  asleep: boolean;
  attacking: boolean;
  dying: boolean;
  dyingT: number;
  faceLeft: boolean;
  /** Where the killing blow landed and the way it threw the body. */
  knock: { col: number; row: number; dx: number; dy: number } | null;
}

const fits = (isFloor: FloorAt, col: number, row: number): boolean =>
  isFloor(Math.round(col - RADIUS), Math.round(row - RADIUS)) &&
  isFloor(Math.round(col + RADIUS), Math.round(row - RADIUS)) &&
  isFloor(Math.round(col - RADIUS), Math.round(row + RADIUS)) &&
  isFloor(Math.round(col + RADIUS), Math.round(row + RADIUS));

export class EnemyField {
  private sheets = new Map<string, Sheet>();
  private list_: Enemy[] = [];
  private settled = 0;
  private readonly total = KINDS.length * ACTIONS.length;
  private mode: AggroMode = "hunt";
  ready = false;

  constructor(url: (path: string) => string = assetUrl) {
    const settle = (): void => {
      if (++this.settled === this.total) this.ready = true;
    };
    for (const kind of KINDS) {
      for (const action of ACTIONS) {
        this.sheets.set(`${kind.name}/${action}`, loadSheet(url(`dungeon/enemies/${kind.name}/${action}.png`), settle));
      }
    }
  }

  setMode(mode: AggroMode): void {
    this.mode = mode;
  }

  reset(): void {
    this.list_ = [];
  }

  list(): readonly Enemy[] {
    return this.list_;
  }

  /** Live enemies left in the dungeon, asleep ones included. */
  remaining(): number {
    return this.list_.filter((e) => !e.dying).length;
  }

  /** How many an enemy-per-room a dungeon gets, given how many have been cleared. */
  static rosterPerRoom(cleared: number): number {
    return Math.min(ROSTER_MAX_PER_ROOM, Math.floor(ROSTER_PER_ROOM + cleared * ROSTER_STEP));
  }

  /**
   * Stock the dungeon once, asleep. `flow` must be flooded from Amelia's start,
   * which is what `SAFE_STEPS` is measured against — and what keeps a spawn from
   * landing in a sealed pocket, since anything the flood never reached is out.
   *
   * Rooms are the preferred home so enemies are found in chambers rather than
   * strung along corridors. Dungeons out of the builder have no rooms, so those
   * fall back to any reachable floor.
   */
  populate(dungeon: Dungeon, flow: FlowField, isFloor: FloorAt, cleared = 0): void {
    this.list_ = [];
    const perRoom = EnemyField.rosterPerRoom(cleared);
    const eligible = (cell: Cell): boolean =>
      flow.distance(cell.col, cell.row) >= SAFE_STEPS && fits(isFloor, cell.col, cell.row);

    if (dungeon.rooms.length > 0) {
      for (const room of dungeon.rooms) {
        const cells: Cell[] = [];
        for (let row = room.row; row < room.row + room.rows; row++) {
          for (let col = room.col; col < room.col + room.cols; col++) {
            if (eligible({ col, row })) cells.push({ col, row });
          }
        }
        for (let i = 0; i < perRoom && cells.length > 0; i++) {
          this.add(cells[Math.floor(Math.random() * cells.length)]!);
        }
      }
      if (this.list_.length > 0) return;
    }

    // No rooms, or a dungeon so small that every room sat inside the safe radius.
    const open = flow.cellsInRange(SAFE_STEPS, Infinity).filter((c) => fits(isFloor, c.col, c.row));
    const wanted = Math.max(perRoom, Math.min(open.length, perRoom * 3));
    for (let i = 0; i < wanted && open.length > 0; i++) {
      this.add(open[Math.floor(Math.random() * open.length)]!);
    }
  }

  private add(cell: Cell): void {
    this.list_.push({
      kind: KINDS[Math.floor(Math.random() * KINDS.length)]!,
      col: cell.col,
      row: cell.row,
      animT: Math.random(),
      asleep: true,
      attacking: false,
      dying: false,
      dyingT: 0,
      faceLeft: false,
      knock: null,
    });
  }

  // Every woken enemy homes on the same point, so without this a group ends up
  // stacked into what reads as one creature.
  private separate(dt: number): void {
    const ease = Math.min(1, SEPARATION_RATE * dt);
    for (let i = 0; i < this.list_.length; i++) {
      const a = this.list_[i]!;
      if (a.dying || a.asleep) continue;
      for (let j = i + 1; j < this.list_.length; j++) {
        const b = this.list_[j]!;
        if (b.dying || b.asleep) continue;
        const dx = b.col - a.col;
        const dy = b.row - a.row;
        const d = Math.hypot(dx, dy);
        if (d >= SEPARATION) continue;
        // Exactly stacked leaves no axis to push along, so pick one — and keep
        // the overlap at its full width rather than pretending they are apart.
        const ux = d > 0 ? dx / d : 1;
        const uy = d > 0 ? dy / d : 0;
        const shift = ((SEPARATION - d) / 2) * ease;
        a.col -= ux * shift;
        a.row -= uy * shift;
        b.col += ux * shift;
        b.row += uy * shift;
      }
    }
  }

  update(dt: number, hero: Pos, isFloor: FloorAt, flow: FlowField): void {
    if (!this.ready) return;
    for (const e of this.list_) {
      e.animT += dt;
      if (e.dying) {
        e.dyingT += dt;
        if (e.knock) {
          // Anchored to where the blow landed rather than integrated per frame,
          // so the throw covers the same ground whatever the frame rate.
          const p = Math.min(1, e.dyingT / DEATH_TIME);
          const eased = p * (2 - p);
          const col = e.knock.col + e.knock.dx * KNOCKBACK * eased;
          const row = e.knock.row + e.knock.dy * KNOCKBACK * eased;
          if (fits(isFloor, col, e.row)) e.col = col;
          if (fits(isFloor, e.col, row)) e.row = row;
        }
        continue;
      }
      // Measured through the dungeon, so an enemy two cells away behind a wall
      // stays asleep until she has actually walked round to it.
      const steps = flow.distance(Math.round(e.col), Math.round(e.row));
      if (e.asleep) {
        if (steps > WAKE_STEPS) continue;
        e.asleep = false;
      } else if (this.mode === "lurk" && steps > WAKE_STEPS) {
        e.asleep = true;
        e.attacking = false;
        continue;
      }

      const dx = hero.col - e.col;
      const dy = hero.row - e.row;
      const d = Math.hypot(dx, dy);
      e.faceLeft = dx < 0;
      e.attacking = d <= CONTACT;
      if (d > CONTACT) {
        const aim = this.heading(e, hero, isFloor, flow);
        const step = SPEED * dt;
        const nc = e.col + aim.dc * step;
        if (fits(isFloor, nc, e.row)) e.col = nc;
        const nr = e.row + aim.dr * step;
        if (fits(isFloor, e.col, nr)) e.row = nr;
      }
    }
    this.list_ = this.list_.filter((e) => !(e.dying && e.dyingT >= DEATH_TIME));
    this.separate(dt);
  }

  /**
   * A unit heading toward the hero. Walking straight at her is what reads as an
   * enemy that has seen you, so that wins whenever there is nothing in the way;
   * otherwise it follows the flow field, which is what gets a body out of the
   * corner it would otherwise press itself into.
   */
  private heading(e: Enemy, hero: Pos, isFloor: FloorAt, flow: FlowField): { dc: number; dr: number } {
    const toward = (col: number, row: number): { dc: number; dr: number } => {
      const dc = col - e.col;
      const dr = row - e.row;
      const len = Math.hypot(dc, dr);
      return len === 0 ? { dc: 0, dr: 0 } : { dc: dc / len, dr: dr / len };
    };
    if (lineClear(isFloor, e.col, e.row, hero.col, hero.row, RADIUS)) {
      return toward(hero.col, hero.row);
    }
    const next = flow.next(e.col, e.row);
    // Cut off from the hero entirely — keep pressing toward her so a body walled
    // in by the builder still crowds the wall between them rather than freezing.
    return next ? toward(next.col, next.row) : toward(hero.col, hero.row);
  }

  /** The live enemy touching (col, row), if any. */
  contactAt(col: number, row: number): Enemy | null {
    return this.list_.find((e) => !e.dying && Math.hypot(e.col - col, e.row - row) <= CONTACT) ?? null;
  }

  /** A swing at (col, row): every live enemy within reach dies, thrown clear of the blow. */
  attackAt(col: number, row: number): number {
    let killed = 0;
    for (const e of this.list_) {
      if (e.dying) continue;
      const dx = e.col - col;
      const dy = e.row - row;
      const d = Math.hypot(dx, dy);
      if (d > MELEE) continue;
      e.dying = true;
      e.dyingT = 0;
      e.attacking = false;
      // A blow landing dead-on leaves no direction to throw along; pick one.
      const away = d > 0 ? { dx: dx / d, dy: dy / d } : { dx: 0, dy: 1 };
      e.knock = { col: e.col, row: e.row, ...away };
      killed++;
    }
    return killed;
  }

  /** Draw one enemy with its feet at (feetX, feetY). */
  draw(ctx: CanvasRenderingContext2D, e: Enemy, feetX: number, feetY: number): void {
    const action: Action = e.dying ? "death" : e.attacking ? "attack" : e.asleep ? "idle" : "walk";
    const sheet = this.sheets.get(`${e.kind.name}/${action}`);
    if (!sheet?.ok) return;
    const anim = e.kind.anims[action];

    let frame: number;
    let alpha = 1;
    if (e.dying) {
      const p = Math.min(1, e.dyingT / DEATH_TIME);
      frame = Math.min(anim.frames - 1, Math.floor(p * anim.frames));
      // Full opacity through the animation, fading only over the tail, so the
      // death reads as an animation rather than a fade.
      alpha = p < 1 - FADE_TAIL ? 1 : Math.max(0, (1 - p) / FADE_TAIL);
    } else {
      frame = Math.floor(e.animT * anim.fps) % anim.frames;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(feetX), Math.round(feetY));
    if (e.faceLeft) ctx.scale(-1, 1);
    ctx.drawImage(
      sheet.img,
      frame * FRAME,
      0,
      FRAME,
      FRAME,
      (-FRAME / 2) * ZOOM,
      -FEET_Y * ZOOM,
      FRAME * ZOOM,
      FRAME * ZOOM,
    );
    ctx.restore();
  }
}
