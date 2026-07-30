import { SX, SY, type Origin } from "./iso";
import { render } from "./renderer";
import type { Tileset } from "./tileset";
import { generateWorld } from "./world";

// A field of the game's own grass tiles, drawn behind the page that lists the
// games. The same seed every time, so a resize redraws the same meadow.
const SEED = 20260730;

/**
 * A square field, and the origin that centres it, big enough that its diamond
 * covers a `width` x `height` screen corner to corner.
 *
 * The field spans `2(size - 1)` half-steps each way, so the two screen axes each
 * eat into the same budget: hence the sum, and the margin over it for the
 * rounding in `unproject`.
 */
export function backdropGrid(width: number, height: number): { size: number; origin: Origin } {
  const size = Math.ceil(width / (2 * SX) + height / (2 * SY)) + 3;
  return { size, origin: { x: width / 2, y: height / 2 - (size - 1) * SY } };
}

/** Paints the grass field over the whole context. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, tileset: Tileset, width: number, height: number): void {
  const { size, origin } = backdropGrid(width, height);
  const world = generateWorld(size, size, SEED, { flat: true, water: false });
  render(ctx, tileset, world, origin, width, height);
}
