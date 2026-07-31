import { SX, SY, type Origin } from "./iso";
import { render } from "./renderer";
import type { Tileset } from "./tileset";
import { generateWorld, MEADOW, type GroundPalette, type Tile } from "./world";

// A field of the game's own grass tiles, drawn behind the page that lists the
// games. The same seed every time, so a resize redraws the same meadow.
const SEED = 20260730;

/**
 * Grounds to choose between, while somebody decides which one the page wears.
 *
 * The sheet lays its surfaces out in families down a column — green through
 * olive to pale stone to ice — so a backdrop is a column picked, a couple of its
 * rows sprinkled over it, and how thickly.
 */
export interface Backdrop {
  id: string;
  ground: GroundPalette;
}

// Not every surface on the sheet can be ground. Rows 3, 6 and 9 of the green,
// olive and ice columns are tufts drawn to sit *on* a tile, so their top face is
// a sixth of a diamond — lay one as ground and the page shows through the hole.
const TUFT_COLS = [1, 4, 7];
const TUFT_ROWS = [3, 6, 9];

/** Whether a tile's top face fills its cell, and so can be laid as ground. */
export const coversItsCell = (tile: Tile): boolean =>
  !(TUFT_COLS.includes(tile[0]) && TUFT_ROWS.includes(tile[1]));

/** Every tile a backdrop lays. */
export const backdropTiles = (backdrop: Backdrop): Tile[] => [
  backdrop.ground.base,
  ...backdrop.ground.variants,
  ...backdrop.ground.specks,
];

export const BACKDROPS: Backdrop[] = [
  // The one the page has always worn.
  { id: "meadow", ground: MEADOW },
  // No sprinkling at all: one tile, edge to edge.
  { id: "lawn", ground: { base: [1, 1], variants: [], specks: [] } },
  // The same green, laid on much thicker.
  {
    id: "wildflower",
    ground: {
      base: [1, 1],
      variants: [
        [1, 2],
        [1, 5],
      ],
      specks: [
        [1, 8],
        [2, 2],
      ],
      variantShare: 0.32,
      speckShare: 0.12,
    },
  },
  // The same green, deeper: the darker tiles in the majority for once.
  {
    id: "pasture",
    ground: {
      base: [1, 2],
      variants: [
        [1, 5],
        [1, 7],
      ],
      specks: [[1, 8]],
    },
  },
  {
    id: "trodden",
    ground: {
      base: [1, 1],
      variants: [
        [2, 1],
        [2, 4],
      ],
      specks: [[3, 2]],
      variantShare: 0.22,
    },
  },
  // The olive column: late summer, gone to seed.
  {
    id: "savannah",
    ground: {
      base: [4, 1],
      variants: [
        [4, 2],
        [4, 5],
      ],
      specks: [[4, 8]],
    },
  },
  // Olive with the green still in patches.
  {
    id: "heath",
    ground: {
      base: [4, 1],
      variants: [
        [1, 1],
        [1, 4],
      ],
      specks: [[1, 8]],
      variantShare: 0.2,
    },
  },
  // Pale stone, with grass coming up through it.
  {
    id: "flagstone",
    ground: {
      base: [6, 1],
      variants: [
        [5, 1],
        [5, 4],
      ],
      specks: [[2, 2]],
    },
  },
  // The ice column.
  {
    id: "frost",
    ground: {
      base: [7, 1],
      variants: [
        [7, 2],
        [7, 5],
      ],
      specks: [[8, 1]],
    },
  },
  {
    id: "glacier",
    ground: {
      base: [9, 1],
      variants: [
        [8, 2],
        [8, 5],
      ],
      specks: [[7, 1]],
      speckShare: 0.06,
    },
  },
];

export const backdropById = (id: string | null): Backdrop => BACKDROPS.find((b) => b.id === id) ?? BACKDROPS[0]!;

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

/** Paints the ground over the whole context. */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  tileset: Tileset,
  width: number,
  height: number,
  backdrop: Backdrop = BACKDROPS[0]!,
): void {
  const { size, origin } = backdropGrid(width, height);
  const world = generateWorld(size, size, SEED, { flat: true, water: false, ground: backdrop.ground });
  render(ctx, tileset, world, origin, width, height);
}
