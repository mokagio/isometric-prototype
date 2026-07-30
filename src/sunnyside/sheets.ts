// The Sunnyside sheets as vendored under `public/sunnyside/`, described once so
// the manifest can be bounds-checked against them.
//
// The two tilesets are the pack's own sheets, copied whole rather than sliced:
// the library addresses them by cell, so a wrong crop is a data fix rather than a
// re-cut PNG. The sprite strips are single sprites, one row of frames.

export type SheetId =
  | "tileset"
  | "forest"
  | "tree"
  | "treeTall"
  | "stump"
  | "log"
  | "cow"
  | "pig"
  | "sheep"
  | "chicken"
  | "duck"
  | "bird"
  | "mushroomRed"
  | "mushroomBlue"
  | "windmill"
  | "coracle"
  | "fire";

export interface Sheet {
  file: string;
  /** One cell: a tile of a tileset, or one frame of a sprite strip. */
  cellW: number;
  cellH: number;
  /** Cells across and down. A sprite strip is one row of frames. */
  cols: number;
  rows: number;
}

export const SHEETS: Record<SheetId, Sheet> = {
  tileset: { file: "tileset.png", cellW: 16, cellH: 16, cols: 64, rows: 64 },
  forest: { file: "forest.png", cellW: 32, cellH: 32, cols: 10, rows: 18 },
  tree: { file: "tree.png", cellW: 32, cellH: 34, cols: 4, rows: 1 },
  treeTall: { file: "treeTall.png", cellW: 28, cellH: 43, cols: 4, rows: 1 },
  stump: { file: "stump.png", cellW: 16, cellH: 16, cols: 1, rows: 1 },
  log: { file: "log.png", cellW: 11, cellH: 11, cols: 1, rows: 1 },
  cow: { file: "cow.png", cellW: 32, cellH: 32, cols: 4, rows: 1 },
  pig: { file: "pig.png", cellW: 32, cellH: 32, cols: 4, rows: 1 },
  sheep: { file: "sheep.png", cellW: 32, cellH: 32, cols: 4, rows: 1 },
  chicken: { file: "chicken.png", cellW: 32, cellH: 32, cols: 4, rows: 1 },
  duck: { file: "duck.png", cellW: 16, cellH: 16, cols: 4, rows: 1 },
  bird: { file: "bird.png", cellW: 16, cellH: 16, cols: 4, rows: 1 },
  mushroomRed: { file: "mushroomRed.png", cellW: 16, cellH: 16, cols: 4, rows: 1 },
  mushroomBlue: { file: "mushroomBlue.png", cellW: 16, cellH: 16, cols: 4, rows: 1 },
  windmill: { file: "windmill.png", cellW: 112, cellH: 112, cols: 9, rows: 1 },
  coracle: { file: "coracle.png", cellW: 48, cellH: 37, cols: 4, rows: 1 },
  fire: { file: "fire.png", cellW: 8, cellH: 12, cols: 4, rows: 1 },
};

/**
 * Where a sheet loads from. The site deploys to a GitHub project page served
 * from `/<repo>/`, so a root-absolute path 404s in production.
 */
export const sheetUrl = (id: SheetId): string => `${import.meta.env.BASE_URL}sunnyside/${SHEETS[id].file}`;
