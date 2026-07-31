import type { PanDir, PanRoom } from "../../panPad";
import type { Cell } from "../editor/view";
import { FIELD_PX, TILE } from "../field";
import type { Pos } from "../walker";

// Where the outline editor is looking. The island editor never needs this — it
// shows the whole island and nothing else — but a coastline is drawn a tile at a
// time along the very edge, so this one has to be able to lean in.

/** Zooms worth stopping at. Whole numbers only: pixel art at 1.5 is mush. */
export const ZOOM_STEPS = [1, 2, 3, 4];

export interface View {
  zoom: number;
  /** The field's top-left corner, in canvas pixels. */
  origin: Pos;
}

/**
 * The zooms available in a `w` x `h` canvas.
 *
 * The way out stops at the whole island: there is nothing past it to see, and a
 * drawing swimming in sea is harder to read, not easier. So the loosest zoom is
 * whatever fits, and the steps above it are the ones that still mean something.
 */
export function zoomLadder(w: number, h: number): number[] {
  const fits = Math.min(w, h) / FIELD_PX;
  // Halves below life size, so a short window still gets the whole island.
  const out = Math.max(0.5, Math.floor(fits * 2) / 2);
  return [out, ...ZOOM_STEPS.filter((z) => z > out)];
}

/** The next zoom along the ladder, or the same one at either end. */
export function stepZoom(ladder: readonly number[], zoom: number, by: 1 | -1): number {
  const at = ladder.indexOf(nearest(ladder, zoom));
  return ladder[Math.min(ladder.length - 1, Math.max(0, at + by))] ?? zoom;
}

const nearest = (ladder: readonly number[], zoom: number): number =>
  ladder.reduce((best, z) => (Math.abs(z - zoom) < Math.abs(best - zoom) ? z : best), ladder[0]!);

/**
 * The origin that keeps `anchor` — a point on the canvas — over the same place
 * on the island as the zoom changes. Zooming under the pointer, so leaning in on
 * a corner does not throw it off the screen.
 */
export function zoomAbout(origin: Pos, from: number, to: number, anchor: Pos): Pos {
  const scale = to / from;
  return {
    x: anchor.x - (anchor.x - origin.x) * scale,
    y: anchor.y - (anchor.y - origin.y) * scale,
  };
}

/**
 * Keep the island on screen: centred on an axis it fits, and otherwise never
 * dragged so far that its edge comes inside the canvas.
 */
export function clampOrigin(origin: Pos, zoom: number, w: number, h: number): Pos {
  const span = FIELD_PX * zoom;
  const axis = (at: number, size: number): number =>
    span <= size ? Math.round((size - span) / 2) : Math.min(0, Math.max(size - span, at));
  return { x: axis(origin.x, w), y: axis(origin.y, h) };
}

/** Tiles an arrow moves the view, whatever the zoom. Far enough to get somewhere. */
export const PAN_TILES = 6;

// Screen directions, as the pan pad's arrows are: looking up means dragging the
// island down, so the origin goes the other way from the name.
const STEPS: Record<PanDir, Pos> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
};

/** Move the view a step that way, stopping at the island's edge. */
export function pan(view: View, dir: PanDir, w: number, h: number): View {
  const step = PAN_TILES * TILE * view.zoom;
  const { x, y } = STEPS[dir];
  const origin = { x: view.origin.x + x * step, y: view.origin.y + y * step };
  return { zoom: view.zoom, origin: clampOrigin(origin, view.zoom, w, h) };
}

/**
 * Which ways there is any island left to go — what greys the arrows out. A view
 * showing the whole thing has nowhere to go at all.
 */
export function roomToPan(view: View, w: number, h: number): PanRoom {
  const span = FIELD_PX * view.zoom;
  const { x, y } = view.origin;
  // A hair's tolerance: the origin is rounded when an axis is centred, so an
  // exact comparison would leave an arrow lit with nothing behind it.
  const slack = 0.5;
  return {
    left: x < -slack,
    right: x + span > w + slack,
    up: y < -slack,
    down: y + span > h + slack,
  };
}

/** Which cell a canvas point is over. */
export const cellAt = (point: Pos, view: View): Cell => ({
  col: Math.floor((point.x - view.origin.x) / (TILE * view.zoom)),
  row: Math.floor((point.y - view.origin.y) / (TILE * view.zoom)),
});

/** The camera `screenAt` wants, for a field parked at `view.origin`. */
export const cameraFor = (view: View): Pos => ({
  x: -view.origin.x / view.zoom,
  y: -view.origin.y / view.zoom,
});
