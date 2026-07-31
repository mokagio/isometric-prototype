import { actionColumn, backLinks, heading, hint, swatchGrid, toolRow, type ToolRow } from "../editorUi";
import { TILE, type Tileset } from "../tileset";
import type { Tile } from "../world";
import { MAX_BUILD_HEIGHT } from "./board";
import { PALETTE, type PaletteEntry } from "./palette";

export interface EditorState {
  brush: Tile;
  /** The rubber is in hand, so a press rubs out rather than places. */
  erasing: boolean;
  height: number;
}

export interface SidebarHandle {
  /** Refresh the height readout after the wheel changes it from the canvas. */
  syncHeight(): void;
  /** Show the rubber as picked up, or put back down. */
  syncErasing(): void;
  /** Grey out whichever of undo and redo has nowhere to go. */
  syncHistory(canUndo: boolean, canRedo: boolean): void;
}

export interface MapActions {
  /** Download the board as a map file. */
  onSave: () => void;
  /** Pick a map file and load it onto the board. */
  onOpen: () => void;
  /** Load the world the game is playing onto the board. */
  onLoadGameWorld: () => void;
  /** Hand the board to the game and go and play it. */
  onPlay: () => void;
  onUndo: () => void;
  onRedo: () => void;
  /** Put the rubber down or pick it up. */
  onErasing: (on: boolean) => void;
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
  backLinks(root, [["game.html", "← World"]]);

  heading(root, "Tiles");
  const tiles = swatchGrid<PaletteEntry>(
    root,
    {
      key: (entry) => entry.label,
      label: (entry) => entry.label,
      face: (entry) => swatch(tileset, entry.tile),
      onPick: (entry) => {
        state.brush = entry.tile;
        state.erasing = false; // picking a tile implies you want to place it
        tools.setActive("rubber", false);
        onChange();
      },
    },
    PALETTE,
  );
  tiles.select(PALETTE[0]!.label);

  heading(root, "Tool");
  const steps = toolRow(root, [
    { id: "undo", label: "↶ Undo", onClick: actions.onUndo },
    { id: "redo", label: "↷ Redo", onClick: actions.onRedo },
  ]);
  const tools: ToolRow = toolRow(root, [
    {
      id: "rubber",
      label: "Rubber",
      onClick: () => actions.onErasing(!state.erasing),
    },
  ]);

  heading(root, "Height");
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

  heading(root, "Map");
  actionColumn(root, [
    { label: "▶ Play this map", onClick: actions.onPlay, go: true },
    { label: "Save map", onClick: actions.onSave },
    { label: "Open map…", onClick: actions.onOpen },
    { label: "Load game world", onClick: actions.onLoadGameWorld },
  ]);

  hint(root, "Scroll to change height. The rubber and the right button both rub out. Arrow keys pan the map.");

  const syncErasing = (): void => {
    tools.setActive("rubber", state.erasing);
    tiles.select(state.erasing ? null : entryFor(state.brush)?.label ?? null);
  };
  syncErasing();

  return {
    syncHeight,
    syncErasing,
    syncHistory(canUndo, canRedo) {
      steps.setEnabled("undo", canUndo);
      steps.setEnabled("redo", canRedo);
    },
  };
}

const entryFor = (tile: Tile): PaletteEntry | undefined =>
  PALETTE.find((entry) => entry.tile[0] === tile[0] && entry.tile[1] === tile[1]);
