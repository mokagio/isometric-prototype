import { drawProp, drawSheetTile, type SheetBook } from "../../sunnyside/draw";
import { isProp, type Asset, type CategoryId } from "../../sunnyside/library";
import { BRUSHES, CATEGORIES, PROPS } from "../../sunnyside/manifest";
import { SHEETS } from "../../sunnyside/sheets";

// The library, down the side of the screen: a row of category buttons and a grid
// of what is in the one you picked. Everything is drawn from the same sheets the
// island is, so a swatch is the thing itself rather than a picture of it.

const SWATCH = 48;

/** How wide and tall a thing draws, in sheet pixels. */
function extent(asset: Asset): { w: number; h: number } {
  if (!isProp(asset)) return { w: 16, h: 16 };
  if (asset.art.kind === "sprite") {
    const { cellW, cellH } = SHEETS[asset.art.sheet];
    return { w: cellW, h: cellH };
  }
  if (asset.art.kind === "tileStrip") return { w: 16, h: 16 };
  return { w: asset.w * 16, h: asset.h * 16 };
}

/** A small canvas with the asset drawn on it, sized to fit. */
function swatch(book: SheetBook, asset: Asset): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SWATCH;
  c.height = SWATCH;
  const g = c.getContext("2d");
  if (!g) return c;
  g.imageSmoothingEnabled = false;
  const size = extent(asset);
  const scale = Math.max(1, Math.min(SWATCH / size.w, SWATCH / size.h));
  const x = (SWATCH - size.w * scale) / 2;
  const y = (SWATCH - size.h * scale) / 2;
  if (!isProp(asset)) {
    const tile = asset.variants[0];
    if (tile) drawSheetTile(g, book, asset.sheet, tile, x, y, scale);
    return c;
  }
  // Props draw from the cell they stand on, so the swatch offsets by that cell.
  drawProp(g, book, asset, x + asset.base.dx * 16 * scale, y + asset.base.dy * 16 * scale, scale, 0);
  return c;
}

export interface PaletteActions {
  onPick: (asset: Asset) => void;
  onErase: () => void;
  onGrid: (on: boolean) => void;
  onPlay: () => void;
  onSave: () => void;
  onOpen: () => void;
  onClear: () => void;
}

export interface PaletteHandle {
  /** Show the rubber as picked up, or put back down. */
  syncErasing(erasing: boolean): void;
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

  const back = document.createElement("a");
  back.className = "ed-back";
  back.href = "woods.html";
  back.textContent = "← Woods";
  root.appendChild(back);

  const tabs = document.createElement("div");
  tabs.className = "ed-tabs";
  root.appendChild(tabs);

  const grid = document.createElement("div");
  grid.className = "ed-palette";
  root.appendChild(grid);

  const assets = [...BRUSHES, ...PROPS];
  const swatches = new Map<string, HTMLButtonElement>();
  let picked = startWith.id;
  let erasing = false;

  const eraseBtn = document.createElement("button");
  let showing: CategoryId = CATEGORIES[0]!.id;

  const markPicked = (): void => {
    for (const [id, el] of swatches) el.classList.toggle("selected", !erasing && id === picked);
    eraseBtn.classList.toggle("active", erasing);
  };

  const showCategory = (id: CategoryId): void => {
    showing = id;
    grid.innerHTML = "";
    swatches.clear();
    for (const asset of assets.filter((a) => a.category === id)) {
      const b = document.createElement("button");
      b.className = "ed-swatch";
      b.title = asset.label;
      b.appendChild(swatch(book, asset));
      b.addEventListener("click", () => {
        picked = asset.id;
        erasing = false;
        actions.onPick(asset);
        markPicked();
      });
      swatches.set(asset.id, b);
      grid.appendChild(b);
    }
    markPicked();
  };

  const tabEls = new Map<CategoryId, HTMLButtonElement>();
  for (const category of CATEGORIES) {
    const b = document.createElement("button");
    b.className = "ed-tab";
    b.textContent = category.label;
    b.addEventListener("click", () => {
      for (const [id, el] of tabEls) el.classList.toggle("active", id === category.id);
      showCategory(category.id);
    });
    tabEls.set(category.id, b);
    tabs.appendChild(b);
  }

  const tools = document.createElement("div");
  tools.className = "ed-tools";
  eraseBtn.className = "ed-tool";
  eraseBtn.textContent = "Rubber";
  eraseBtn.addEventListener("click", () => {
    erasing = true;
    actions.onErase();
    markPicked();
  });
  const gridBtn = document.createElement("button");
  gridBtn.className = "ed-tool active";
  gridBtn.textContent = "Grid";
  gridBtn.addEventListener("click", () => {
    const on = !gridBtn.classList.contains("active");
    gridBtn.classList.toggle("active", on);
    actions.onGrid(on);
  });
  tools.append(eraseBtn, gridBtn);
  root.appendChild(tools);

  const buttons = document.createElement("div");
  buttons.className = "ed-map";
  const button = (label: string, onClick: () => void, className = "ed-action"): void => {
    const b = document.createElement("button");
    b.className = className;
    b.textContent = label;
    b.addEventListener("click", onClick);
    buttons.appendChild(b);
  };
  button("▶ Play this island", actions.onPlay, "ed-action ed-action-go");
  button("Save island", actions.onSave);
  button("Open island…", actions.onOpen);
  button("Start again", actions.onClear);
  root.appendChild(buttons);

  const hint = document.createElement("div");
  hint.className = "ed-hint";
  hint.textContent = "Pick something, then paint. Right-click rubs out. Empty ground becomes grass when you play.";
  root.appendChild(hint);

  tabEls.get(CATEGORIES[0]!.id)?.classList.add("active");
  showCategory(CATEGORIES[0]!.id);

  return {
    syncErasing(on: boolean): void {
      erasing = on;
      markPicked();
    },
    refresh(): void {
      showCategory(showing);
    },
  };
}
