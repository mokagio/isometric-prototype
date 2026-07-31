import type { Sheet } from "../../sprites";
import { COAST_GROUPS, coastTilesIn, type CoastGroupId, type CoastTile } from "../coastTiles";
import { TILE } from "../field";
import type { CoastSheets, OutlineSheets } from "../ground";

// The coast tiles down the side of the screen, a tab to a group. Every swatch is
// cut from the sheet it will be drawn from, so what you pick is the thing itself
// rather than a picture of it.

const SWATCH = 44;

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
  onErase: () => void;
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
  /** Grey out whichever of undo and redo has nowhere to go. */
  syncHistory(canUndo: boolean, canRedo: boolean): void;
  /** The same, for the two ends of the zoom. */
  syncZoom(canOut: boolean, canIn: boolean): void;
}

/** Everything the coast is drawn from, plus the grass a swatch shows under a tile. */
export type PaletteSheets = CoastSheets & OutlineSheets & { grassUnder?: Sheet };

export function buildPalette(
  root: HTMLElement,
  sheets: PaletteSheets,
  actions: PaletteActions,
  startWith: CoastTile,
): PaletteHandle {
  root.innerHTML = "";

  const links = document.createElement("div");
  links.className = "ed-links";
  for (const [href, text] of [
    ["woods.html", "← Woods"],
    ["woodsEditor.html", "Island editor →"],
  ]) {
    const a = document.createElement("a");
    a.className = "ed-back";
    a.href = href!;
    a.textContent = text!;
    links.appendChild(a);
  }
  root.appendChild(links);

  const tabs = document.createElement("div");
  tabs.className = "ed-tabs";
  root.appendChild(tabs);

  const grid = document.createElement("div");
  grid.className = "ed-palette";
  root.appendChild(grid);

  const swatches = new Map<string, HTMLButtonElement>();
  let picked = startWith.code;
  let erasing = false;
  let showing: CoastGroupId = COAST_GROUPS[0]!.id;

  const eraseBtn = document.createElement("button");
  const markPicked = (): void => {
    for (const [code, el] of swatches) el.classList.toggle("selected", !erasing && code === picked);
    eraseBtn.classList.toggle("active", erasing);
  };

  const showGroup = (id: CoastGroupId): void => {
    showing = id;
    grid.innerHTML = "";
    swatches.clear();
    for (const tile of coastTilesIn(id)) {
      const b = document.createElement("button");
      b.className = "ed-swatch";
      b.title = `${tile.label}  (${tile.code})`;
      b.appendChild(swatch(sheets, tile));
      b.addEventListener("click", () => {
        picked = tile.code;
        erasing = false;
        actions.onPick(tile);
        markPicked();
      });
      swatches.set(tile.code, b);
      grid.appendChild(b);
    }
    markPicked();
  };

  const tabEls = new Map<CoastGroupId, HTMLButtonElement>();
  for (const group of COAST_GROUPS) {
    const b = document.createElement("button");
    b.className = "ed-tab";
    b.textContent = group.label;
    b.addEventListener("click", () => {
      for (const [id, el] of tabEls) el.classList.toggle("active", id === group.id);
      showGroup(group.id);
    });
    tabEls.set(group.id, b);
    tabs.appendChild(b);
  }

  const steps = document.createElement("div");
  steps.className = "ed-tools";
  const undoBtn = document.createElement("button");
  undoBtn.className = "ed-tool";
  undoBtn.textContent = "↶ Undo";
  undoBtn.addEventListener("click", () => actions.onUndo());
  const redoBtn = document.createElement("button");
  redoBtn.className = "ed-tool";
  redoBtn.textContent = "↷ Redo";
  redoBtn.addEventListener("click", () => actions.onRedo());
  steps.append(undoBtn, redoBtn);
  root.appendChild(steps);

  const zooms = document.createElement("div");
  zooms.className = "ed-tools";
  const outBtn = document.createElement("button");
  outBtn.className = "ed-tool";
  outBtn.textContent = "− Out";
  outBtn.addEventListener("click", () => actions.onZoom(-1));
  const inBtn = document.createElement("button");
  inBtn.className = "ed-tool";
  inBtn.textContent = "+ In";
  inBtn.addEventListener("click", () => actions.onZoom(1));
  zooms.append(outBtn, inBtn);
  root.appendChild(zooms);

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
  button("▶ Try it out", actions.onPlay, "ed-action ed-action-go");
  button("Save outline", actions.onSave);
  button("Open outline…", actions.onOpen);
  button("Start over", actions.onReset);
  root.appendChild(buttons);

  const hint = document.createElement("div");
  hint.className = "ed-hint";
  hint.textContent =
    "Pick a tile, then paint it. The rubber and the right button both clear back to open water. Scroll to zoom, drag with the middle button to move about. Only the band outside the fence is yours — inside it is where the game is played.";
  root.appendChild(hint);

  tabEls.get(showing)?.classList.add("active");
  showGroup(showing);

  return {
    refresh: () => showGroup(showing),
    syncHistory(canUndo: boolean, canRedo: boolean): void {
      undoBtn.disabled = !canUndo;
      redoBtn.disabled = !canRedo;
    },
    syncZoom(canOut: boolean, canIn: boolean): void {
      outBtn.disabled = !canOut;
      inBtn.disabled = !canIn;
    },
  };
}
