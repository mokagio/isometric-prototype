import { actionColumn, backLinks, hint, swatchGrid, tabRow, toolRow } from "../../editorUi";
import { drawAsset, swatchExtent, type SheetBook } from "../../sunnyside/draw";
import type { Asset, CategoryId } from "../../sunnyside/library";
import { BRUSHES, CATEGORIES, PROPS } from "../../sunnyside/manifest";

// The library, down the side of the screen: a row of category buttons and a grid
// of what is in the one you picked. Everything is drawn from the same sheets the
// island is, so a swatch is the thing itself rather than a picture of it.

const SWATCH = 48;

/** A small canvas with the asset drawn on it, sized to fit. */
function swatch(book: SheetBook, asset: Asset): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SWATCH;
  c.height = SWATCH;
  const g = c.getContext("2d");
  if (!g) return c;
  g.imageSmoothingEnabled = false;
  const size = swatchExtent(asset);
  const scale = Math.max(1, Math.min(SWATCH / size.w, SWATCH / size.h));
  drawAsset(g, book, asset, (SWATCH - size.w * scale) / 2, (SWATCH - size.h * scale) / 2, scale);
  return c;
}

export interface PaletteActions {
  onPick: (asset: Asset) => void;
  onErasing: (on: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onGrid: (on: boolean) => void;
  onPlay: () => void;
  onSave: () => void;
  onOpen: () => void;
  onClear: () => void;
}

export interface PaletteHandle {
  /** Show the rubber as picked up, or put back down. */
  syncErasing(erasing: boolean, holding: Asset | null): void;
  /** Grey out whichever of undo and redo has nowhere to go. */
  syncHistory(canUndo: boolean, canRedo: boolean): void;
  /** Draw the swatches again, once the sheets they are cut from have loaded. */
  refresh(): void;
}

export function buildPalette(
  root: HTMLElement,
  book: SheetBook,
  actions: PaletteActions,
  startWith: Asset,
): PaletteHandle {
  root.innerHTML = "";
  backLinks(root, [
    ["woods.html", "← Woods"],
    ["library.html", "All the things →"],
  ]);

  const assets = [...BRUSHES, ...PROPS];
  // Tabs first, since they sit above the grid, and nothing is shown until the
  // grid below them exists to show it in.
  const tabs = tabRow<CategoryId>(root, CATEGORIES, (id) =>
    things.show(assets.filter((a) => a.category === id)),
  );
  const things = swatchGrid<Asset>(root, {
    key: (asset) => asset.id,
    label: (asset) => asset.label,
    face: (asset) => swatch(book, asset),
    onPick: (asset) => actions.onPick(asset),
  });
  tabs.show(CATEGORIES[0]!.id);
  things.select(startWith.id);

  const steps = toolRow(root, [
    { id: "undo", label: "↶ Undo", onClick: actions.onUndo },
    { id: "redo", label: "↷ Redo", onClick: actions.onRedo },
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
    { label: "▶ Play this island", onClick: actions.onPlay, go: true },
    { label: "Save island", onClick: actions.onSave },
    { label: "Open island…", onClick: actions.onOpen },
    { label: "Start again", onClick: actions.onClear },
  ]);

  hint(
    root,
    "Pick something, then paint. The rubber and the right button both rub out. Empty ground becomes grass when you play.",
  );

  return {
    syncErasing(on, holding) {
      erasing = on;
      tools.setActive("rubber", on);
      things.select(on ? null : (holding?.id ?? null));
    },
    syncHistory(canUndo, canRedo) {
      steps.setEnabled("undo", canUndo);
      steps.setEnabled("redo", canRedo);
    },
    refresh: () => things.refresh(),
  };
}
