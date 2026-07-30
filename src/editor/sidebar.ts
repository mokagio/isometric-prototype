import { TILE, type Tileset } from "../tileset";
import type { Tile } from "../world";
import { MAX_BUILD_HEIGHT } from "./board";
import { PALETTE } from "./palette";

export type Mode = "place" | "erase";

export interface EditorState {
  brush: Tile;
  mode: Mode;
  height: number;
}

export interface SidebarHandle {
  /** Refresh the height readout after the wheel changes it from the canvas. */
  syncHeight(): void;
}

export interface MapActions {
  /** Download the board as a map file. */
  onSave: () => void;
  /** Pick a map file and load it onto the board. */
  onOpen: () => void;
  /** Load the world the game is playing onto the board. */
  onLoadGameWorld: () => void;
}

export function clampHeight(h: number): number {
  return Math.max(0, Math.min(MAX_BUILD_HEIGHT, h));
}

/** Draws a tile's sheet cell into a small swatch canvas. */
function swatch(tileset: Tileset, tile: Tile): HTMLCanvasElement {
  const size = 44;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.drawImage(tileset.image, tile[0] * TILE, tile[1] * TILE, TILE, TILE, 0, 0, size, size);
  return c;
}

export function buildSidebar(
  root: HTMLElement,
  tileset: Tileset,
  state: EditorState,
  onChange: () => void,
  actions: MapActions,
): SidebarHandle {
  root.innerHTML = "";

  const back = document.createElement("a");
  back.className = "ed-back";
  back.href = "index.html";
  back.textContent = "← World";
  root.appendChild(back);

  const heading = (text: string): void => {
    const h = document.createElement("div");
    h.className = "ed-heading";
    h.textContent = text;
    root.appendChild(h);
  };

  // Palette --------------------------------------------------------------
  heading("Tiles");
  const grid = document.createElement("div");
  grid.className = "ed-palette";
  const swatchEls: HTMLButtonElement[] = [];
  PALETTE.forEach((entry, i) => {
    const b = document.createElement("button");
    b.className = "ed-swatch";
    b.title = entry.label;
    b.appendChild(swatch(tileset, entry.tile));
    b.addEventListener("click", () => {
      state.brush = entry.tile;
      state.mode = "place"; // picking a tile implies you want to place it
      swatchEls.forEach((el) => el.classList.remove("selected"));
      b.classList.add("selected");
      syncMode();
      onChange();
    });
    if (i === 0) b.classList.add("selected");
    swatchEls.push(b);
    grid.appendChild(b);
  });
  root.appendChild(grid);

  // Mode -----------------------------------------------------------------
  heading("Tool");
  const tools = document.createElement("div");
  tools.className = "ed-tools";
  const placeBtn = document.createElement("button");
  placeBtn.className = "ed-tool";
  placeBtn.textContent = "Place";
  const eraseBtn = document.createElement("button");
  eraseBtn.className = "ed-tool";
  eraseBtn.textContent = "Erase";
  const syncMode = (): void => {
    placeBtn.classList.toggle("active", state.mode === "place");
    eraseBtn.classList.toggle("active", state.mode === "erase");
  };
  placeBtn.addEventListener("click", () => {
    state.mode = "place";
    syncMode();
    onChange();
  });
  eraseBtn.addEventListener("click", () => {
    state.mode = "erase";
    syncMode();
    onChange();
  });
  tools.append(placeBtn, eraseBtn);
  root.appendChild(tools);
  syncMode();

  // Height ---------------------------------------------------------------
  heading("Height");
  const hc = document.createElement("div");
  hc.className = "ed-height";
  const down = document.createElement("button");
  down.className = "ed-step";
  down.textContent = "▼";
  const readout = document.createElement("span");
  readout.className = "ed-height-value";
  const up = document.createElement("button");
  up.className = "ed-step";
  up.textContent = "▲";
  const syncHeight = (): void => {
    readout.textContent = String(state.height);
  };
  down.addEventListener("click", () => {
    state.height = clampHeight(state.height - 1);
    syncHeight();
    onChange();
  });
  up.addEventListener("click", () => {
    state.height = clampHeight(state.height + 1);
    syncHeight();
    onChange();
  });
  hc.append(down, readout, up);
  root.appendChild(hc);
  syncHeight();

  // Map -------------------------------------------------------------------
  heading("Map");
  const mapButtons = document.createElement("div");
  mapButtons.className = "ed-map";
  const button = (label: string, onClick: () => void): void => {
    const b = document.createElement("button");
    b.className = "ed-action";
    b.textContent = label;
    b.addEventListener("click", onClick);
    mapButtons.appendChild(b);
  };
  button("Save map", actions.onSave);
  button("Open map…", actions.onOpen);
  button("Load game world", actions.onLoadGameWorld);
  root.appendChild(mapButtons);

  const hint = document.createElement("div");
  hint.className = "ed-hint";
  hint.textContent = "Scroll to change height. Right-click erases. Arrow keys pan the map.";
  root.appendChild(hint);

  return { syncHeight };
}
