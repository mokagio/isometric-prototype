export type FloorAt = (col: number, row: number) => boolean;

export interface Cell {
  col: number;
  row: number;
}

const UNREACHABLE = -1;

// Four-way steps for the flood, eight for the walk out of it: the flood only
// needs to rank cells, but a body following it looks stiff on four headings.
const FLOOD: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const WALK: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * Steps-to-the-hero for every floor cell, flooded out from where she stands.
 *
 * Homing straight at the hero walks a body into the first wall between them and
 * leaves it there; following this downhill takes it round. The buffers are
 * reused across recomputes, so the flood costs nothing per frame beyond the walk
 * itself.
 */
export class FlowField {
  readonly cols: number;
  readonly rows: number;
  private dist: Int32Array;
  private queue: Int32Array;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.dist = new Int32Array(cols * rows);
    this.queue = new Int32Array(cols * rows);
  }

  private index(col: number, row: number): number {
    return row * this.cols + col;
  }

  private inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  recompute(isFloor: FloorAt, goalCol: number, goalRow: number): void {
    this.dist.fill(UNREACHABLE);
    const goal = { col: Math.round(goalCol), row: Math.round(goalRow) };
    if (!this.inBounds(goal.col, goal.row) || !isFloor(goal.col, goal.row)) return;

    let head = 0;
    let tail = 0;
    this.dist[this.index(goal.col, goal.row)] = 0;
    this.queue[tail++] = this.index(goal.col, goal.row);

    while (head < tail) {
      const at = this.queue[head++]!;
      const col = at % this.cols;
      const row = (at - col) / this.cols;
      const next = this.dist[at]! + 1;
      for (const [dc, dr] of FLOOD) {
        const c = col + dc;
        const r = row + dr;
        if (!this.inBounds(c, r) || !isFloor(c, r)) continue;
        const to = this.index(c, r);
        if (this.dist[to] !== UNREACHABLE) continue;
        this.dist[to] = next;
        this.queue[tail++] = to;
      }
    }
  }

  /** Steps from a cell to the goal, or Infinity where there is no way through. */
  distance(col: number, row: number): number {
    if (!this.inBounds(col, row)) return Infinity;
    const d = this.dist[this.index(col, row)]!;
    return d === UNREACHABLE ? Infinity : d;
  }

  /**
   * The neighbouring cell one step closer to the goal, or null when the cell is
   * the goal or cut off from it. Diagonals need both their sides open, so a body
   * never slips through the corner where two walls meet.
   */
  next(col: number, row: number): Cell | null {
    const c0 = Math.round(col);
    const r0 = Math.round(row);
    const here = this.distance(c0, r0);
    if (!Number.isFinite(here) || here === 0) return null;

    let best: Cell | null = null;
    let bestDist = here;
    for (const [dc, dr] of WALK) {
      const c = c0 + dc;
      const r = r0 + dr;
      if (dc !== 0 && dr !== 0) {
        if (!Number.isFinite(this.distance(c0 + dc, r0))) continue;
        if (!Number.isFinite(this.distance(c0, r0 + dr))) continue;
      }
      const d = this.distance(c, r);
      if (d < bestDist) {
        bestDist = d;
        best = { col: c, row: r };
      }
    }
    return best;
  }

  /** Every cell between `min` and `max` steps from the goal — all of them reachable. */
  cellsInRange(min: number, max: number): Cell[] {
    const found: Cell[] = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const d = this.dist[this.index(col, row)]!;
        if (d >= min && d <= max) found.push({ col, row });
      }
    }
    return found;
  }
}

/**
 * Whether a body of `radius` can walk straight from one point to the other.
 * Sampled at half a radius, which is fine enough that no gap between two cells
 * of rock is ever stepped over.
 */
export function lineClear(
  isFloor: FloorAt,
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
  radius: number,
): boolean {
  const dc = toCol - fromCol;
  const dr = toRow - fromRow;
  const span = Math.hypot(dc, dr);
  const steps = Math.max(1, Math.ceil(span / (radius / 2)));
  for (let i = 0; i <= steps; i++) {
    const col = fromCol + (dc * i) / steps;
    const row = fromRow + (dr * i) / steps;
    if (
      !isFloor(Math.round(col - radius), Math.round(row - radius)) ||
      !isFloor(Math.round(col + radius), Math.round(row - radius)) ||
      !isFloor(Math.round(col - radius), Math.round(row + radius)) ||
      !isFloor(Math.round(col + radius), Math.round(row + radius))
    ) {
      return false;
    }
  }
  return true;
}
