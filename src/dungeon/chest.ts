import type { Atlas, TileName } from "./atlas";
import type { Dungeon } from "./dungeon";
import { roomCentre } from "./dungeon";
import type { Cell, FlowField } from "./flow";
import { ZOOM } from "./grid";

// The treasure Amelia is looking for. Reaching it clears the dungeon.
//
// The sheet has no shut-lid frame — `f0` already shows gold through the gap — so
// f0 doubles as the closed chest and the strip runs f0 to f2 as it opens.
const CLOSED: TileName = "chest_full_open_anim_f0";
const OPENING: readonly TileName[] = [
  "chest_full_open_anim_f0",
  "chest_full_open_anim_f1",
  "chest_full_open_anim_f2",
];

export const OPEN_TIME = 0.5; // seconds the lid takes
/** Cells. Generous, so a six-year-old does not have to stand on exactly the right pixel. */
export const REACH = 1;

/**
 * Where to hide the treasure: the room centre furthest from where Amelia starts,
 * measured through the dungeon rather than across it, so the chest is always
 * somewhere she can walk to and never just over the wall behind her.
 *
 * `flow` must be flooded from her spawn. Dungeons built in the builder carry no
 * rooms, so those fall back to the furthest reachable floor cell.
 */
export function placeChest(flow: FlowField, dungeon: Dungeon): Cell {
  let best: Cell | null = null;
  let bestDist = -1;

  for (const room of dungeon.rooms) {
    const centre = roomCentre(room);
    const d = flow.distance(centre.col, centre.row);
    if (Number.isFinite(d) && d > bestDist) {
      bestDist = d;
      best = centre;
    }
  }
  if (best) return best;

  for (let row = 0; row < dungeon.rows; row++) {
    for (let col = 0; col < dungeon.cols; col++) {
      const d = flow.distance(col, row);
      if (Number.isFinite(d) && d > bestDist) {
        bestDist = d;
        best = { col, row };
      }
    }
  }
  return best ?? { col: 0, row: 0 };
}

export class Chest {
  readonly col: number;
  readonly row: number;
  private t: number | null = null; // seconds since the lid started moving

  constructor(cell: Cell) {
    this.col = cell.col;
    this.row = cell.row;
  }

  /** True once the lid has started moving, whether or not it has finished. */
  get opening(): boolean {
    return this.t !== null;
  }

  /** True once the lid is all the way up — the moment the dungeon is cleared. */
  get open(): boolean {
    return this.t !== null && this.t >= OPEN_TIME;
  }

  /** Start opening if Amelia is close enough. True on the frame it begins. */
  tryOpen(heroCol: number, heroRow: number): boolean {
    if (this.t !== null) return false;
    if (Math.hypot(this.col - heroCol, this.row - heroRow) > REACH) return false;
    this.t = 0;
    return true;
  }

  update(dt: number): void {
    if (this.t !== null) this.t += dt;
  }

  /** Draw with the chest's own top-left at `(x, y)` — it fills exactly one cell. */
  draw(ctx: CanvasRenderingContext2D, atlas: Atlas, x: number, y: number): void {
    if (this.t === null) {
      atlas.draw(ctx, CLOSED, x, y, ZOOM);
      return;
    }
    const at = Math.min(OPENING.length - 1, Math.floor((this.t / OPEN_TIME) * OPENING.length));
    atlas.draw(ctx, OPENING[at]!, x, y, ZOOM);
  }
}
