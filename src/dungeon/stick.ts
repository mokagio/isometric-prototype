import type { Axis } from "./input";

// Half the well minus half the knob, so the knob stays inside its square.
const RADIUS = 44;
const DEADZONE = 0.18; // fraction of RADIUS that still reads as centred

// Across the well; smaller reads as a coarser staircase.
const CELLS = 16;
const RIM = 1; // rim thickness, in cells

export interface StickInput {
  setStick(axis: Axis | null): void;
}

/** Half-width, in cells, of each row of a circle of `radius` rasterised on the grid. */
function halfWidths(cells: number, radius: number): number[] {
  const r = cells / 2;
  return Array.from({ length: cells }, (_, row) => {
    const dy = row + 0.5 - r; // sample each row at its centre
    return Math.round(Math.sqrt(Math.max(0, radius * radius - dy * dy)));
  });
}

/** Trace one staircase outline clockwise: down the right edge, up the left. */
function trace(cells: number, radius: number): Array<[number, number]> {
  const r = cells / 2;
  const right: Array<[number, number]> = [];
  const left: Array<[number, number]> = [];
  halfWidths(cells, radius).forEach((half, row) => {
    right.push([r + half, row], [r + half, row + 1]);
    left.push([r - half, row], [r - half, row + 1]);
  });
  return [...right, ...left.reverse()];
}

function toPolygon(cells: number, pts: Array<[number, number]>): string {
  const pct = (v: number): string => `${((v / cells) * 100).toFixed(3)}%`;
  return `polygon(${pts.map(([x, y]) => `${pct(x)} ${pct(y)}`).join(", ")})`;
}

/**
 * A circle rasterised onto a `cells` square grid, as a `clip-path` polygon.
 * Rounding each row's half-width to whole cells is what leaves the staircase
 * edge that `border-radius: 50%` would smooth away.
 */
export function steppedCircle(cells: number): string {
  return toPolygon(cells, trace(cells, cells / 2));
}

/**
 * The same outline as a ring `thickness` cells thick. The hole is traced the
 * other way round so the nonzero fill rule cancels it out — a solid disc here
 * would sit under the translucent well and blot out the dungeon behind it.
 */
export function steppedRing(cells: number, thickness: number): string {
  const outer = trace(cells, cells / 2);
  const inner = trace(cells, cells / 2 - thickness).reverse();
  return toPolygon(cells, [...outer, ...inner]);
}

/** Bottom-left analog stick: any heading, unlike the four a button pad affords. */
export function createStick(input: StickInput): void {
  const base = document.createElement("div");
  base.className = "ad-stick";
  base.style.setProperty("--ad-stick-clip", steppedCircle(CELLS));
  base.style.setProperty("--ad-stick-ring", steppedRing(CELLS, RIM));
  const knob = document.createElement("div");
  knob.className = "ad-stick-knob";
  base.appendChild(knob);

  let held: number | null = null;

  const steer = (e: PointerEvent): void => {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy);
    if (dist > RADIUS) {
      dx = (dx / dist) * RADIUS;
      dy = (dy / dist) * RADIUS;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // Screen axes are the grid axes here, and `Hero.update` normalises, so the
    // stick steers without throttling.
    input.setStick(dist < RADIUS * DEADZONE ? null : { dc: dx, dr: dy });
  };

  const release = (e: PointerEvent): void => {
    if (held !== e.pointerId) return;
    held = null;
    knob.style.transform = "";
    input.setStick(null);
  };

  base.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    held = e.pointerId;
    // Capture so a thumb that slides past the base keeps steering rather than
    // dropping the input mid-move.
    base.setPointerCapture(e.pointerId);
    steer(e);
  });
  base.addEventListener("pointermove", (e) => {
    if (held === e.pointerId) steer(e);
  });
  base.addEventListener("pointerup", release);
  base.addEventListener("pointercancel", release);
  base.addEventListener("contextmenu", (e) => e.preventDefault());

  document.body.appendChild(base);
}
