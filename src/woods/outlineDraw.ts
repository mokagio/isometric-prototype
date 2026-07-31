import type { Sheet } from "../sprites";
import { coastTile, type CoastSheetId, type CoastTile } from "./coastTiles";
import type { CoastSheets, OutlineSheets } from "./ground";
import type { Pos } from "./walker";

// Drawing a coastline someone placed by hand, as against working one out from
// its neighbours. There is no cleverness here on purpose: a cell says which tile
// it holds, and that tile goes down. Whatever it looks like in the editor is
// what it looks like in the game, because both come through here.

/** The sheet a tile is cut from, following the surf's swap for the shore ring. */
const sheetFor = (sheets: CoastSheets & OutlineSheets, id: CoastSheetId, surf: Sheet): Sheet | undefined =>
  id === "shore" ? surf : sheets[id];

export interface OutlineCellPaint {
  /** Whatever the caller lays as ground: the game's grass, or the editor's. */
  grass: (at: Pos) => void;
  sand: (at: Pos) => void;
  tile: (sheet: Sheet, src: { col: number; row: number }, at: Pos, flipV: boolean) => void;
}

/** One cell of a drawn outline: its ground, then the tile placed on it. */
export function paintOutlineCell(code: string, at: Pos, surf: Sheet, sheets: CoastSheets & OutlineSheets, paint: OutlineCellPaint): void {
  const placed: CoastTile = coastTile(code);
  if (placed.under === "grass") paint.grass(at);
  else if (placed.under === "sand") paint.sand(at);
  if (!placed.sheet) return;
  const sheet = sheetFor(sheets, placed.sheet, surf);
  if (!sheet?.ok) return;
  paint.tile(sheet, { col: placed.col ?? 0, row: placed.row ?? 0 }, at, placed.flipV ?? false);
}
