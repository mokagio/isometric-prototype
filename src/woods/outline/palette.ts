import { actionColumn, backLinks, hint, swatchGrid, tabRow, toolRow } from "../../editorUi";
import type { Sheet } from "../../sprites";
import { COAST_GROUPS, coastTilesIn, type CoastGroupId, type CoastTile } from "../coastTiles";
import { TILE } from "../field";
import type { CoastSheets, OutlineSheets } from "../ground";

// The coast tiles down the side of the screen, a tab to a group. Every swatch is
// cut from the sheet it will be drawn from, so what you pick is the thing itself
// rather than a picture of it.

const SWATCH = 44;

/** Everything the coast is drawn from, plus the grass a swatch shows under a tile. */
export type PaletteSheets = CoastSheets & OutlineSheets & { grassUnder?: Sheet };

/** The strip a swatch is cut from. Either frame of the surf will do standing still. */
const sheetOf = (sheets: PaletteSheets, tile: CoastTile): Sheet | undefined =>
  tile.sheet ? sheets[tile.sheet] : undefined;

function swatch(sheets: PaletteSheets, tile: CoastTile): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SWATCH;
  c.height = SWATCH;
  const g = c.getContext("2d");
  if (!g) return c;
  g.imageSmoothingEnabled = false;
  const scale = SWATCH / TILE;
  // The sea under it, as on the island: half these tiles are mostly transparent
  // and would otherwise read as a blank square.
  if (sheets.sea.ok) g.drawImage(sheets.sea.img, 0, 0, TILE, TILE, 0, 0, SWATCH, SWATCH);
  if (tile.under === "grass" && sheets.grassUnder?.ok) {
    g.drawImage(sheets.grassUnder.img, 0, 0, TILE, TILE, 0, 0, SWATCH, SWATCH);
  }
  if (tile.under === "sand" && sheets.sand?.ok) {
    g.drawImage(sheets.sand.img, 0, 0, TILE, TILE, 0, 0, SWATCH, SWATCH);
  }
  const sheet = sheetOf(sheets, tile);
  if (sheet?.ok) {
    g.save();
    if (tile.flipV) {
      g.translate(0, SWATCH);
      g.scale(1, -1);
    }
    g.drawImage(sheet.img, (tile.col ?? 0) * TILE, (tile.row ?? 0) * TILE, TILE, TILE, 0, 0, TILE * scale, TILE * scale);
    g.restore();
  }
  return c;
}

export interface PaletteActions {
  onPick: (tile: CoastTile) => void;
  onErasing: (on: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (by: 1 | -1) => void;
  onGrid: (on: boolean) => void;
  onSave: () => void;
  onOpen: () => void;
  onPlay: () => void;
  onReset: () => void;
}

export interface PaletteHandle {
  /** Draw the swatches again, once the sheets they are cut from have loaded. */
  refresh(): void;
  /** Show the rubber as picked up, or put back down. */
  syncErasing(erasing: boolean, brush: CoastTile): void;
  /** Grey out whichever of undo and redo has nowhere to go. */
  syncHistory(canUndo: boolean, canRedo: boolean): void;
  /** The same, for the two ends of the zoom. */
  syncZoom(canOut: boolean, canIn: boolean): void;
}

export function buildPalette(
  root: HTMLElement,
  sheets: PaletteSheets,
  actions: PaletteActions,
  startWith: CoastTile,
): PaletteHandle {
  root.innerHTML = "";
  backLinks(root, [
    ["woods.html", "← Woods"],
    ["woodsEditor.html", "Island editor →"],
  ]);

  // Tabs first, since they sit above the grid, and nothing is shown until the
  // grid below them exists to show it in.
  const tabs = tabRow<CoastGroupId>(root, COAST_GROUPS, (id) => tiles.show(coastTilesIn(id)));
  const tiles = swatchGrid<CoastTile>(root, {
    key: (tile) => tile.code,
    label: (tile) => `${tile.label}  (${tile.code})`,
    face: (tile) => swatch(sheets, tile),
    onPick: (tile) => actions.onPick(tile),
  });
  tabs.show(COAST_GROUPS[0]!.id);
  tiles.select(startWith.code);

  const steps = toolRow(root, [
    { id: "undo", label: "↶ Undo", onClick: actions.onUndo },
    { id: "redo", label: "↷ Redo", onClick: actions.onRedo },
  ]);
  const zooms = toolRow(root, [
    { id: "out", label: "− Out", onClick: () => actions.onZoom(-1) },
    { id: "in", label: "+ In", onClick: () => actions.onZoom(1) },
  ]);
  let erasing = false;
  let gridOn = true;
  const tools = toolRow(root, [
    { id: "rubber", label: "Rubber", onClick: () => actions.onErasing(!erasing) },
    {
      id: "grid",
      label: "Grid",
      active: true,
      onClick: () => {
        gridOn = !gridOn;
        tools.setActive("grid", gridOn);
        actions.onGrid(gridOn);
      },
    },
  ]);

  actionColumn(root, [
    { label: "▶ Try it out", onClick: actions.onPlay, go: true },
    { label: "Save outline", onClick: actions.onSave },
    { label: "Open outline…", onClick: actions.onOpen },
    { label: "Start again", onClick: actions.onReset },
  ]);

  hint(
    root,
    "Pick a tile, then paint it. The rubber and the right button both clear back to open water. Scroll to zoom, the arrows to get about. Only the band outside the fence is yours — inside it is where the game is played.",
  );

  return {
    refresh: () => tiles.refresh(),
    syncErasing(on, brush) {
      erasing = on;
      tools.setActive("rubber", on);
      tiles.select(on ? null : brush.code);
    },
    syncHistory(canUndo, canRedo) {
      steps.setEnabled("undo", canUndo);
      steps.setEnabled("redo", canRedo);
    },
    syncZoom(canOut, canIn) {
      zooms.setEnabled("out", canOut);
      zooms.setEnabled("in", canIn);
    },
  };
}
