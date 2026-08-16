import type { Atlas } from "../../atlas";
import type { Piece } from "../../dungeonTiles";
import { TILES, type TileName } from "../../tiles";
import { actionColumn, hint, swatchGrid, tabRow, toolRow, type ToolRow } from "../../../editorUi";
import { buildTop, heading, type EditorState, type SidebarActions } from "../sidebar";
import type { Counts } from "./corrections";
import { GROUPS, SWATCH_PX, swatchFit, tilesIn, type GroupId } from "./groups";

export interface TileActions extends SidebarActions {
  /** Null puts the tile down, so a click only chooses a cell rather than changing it. */
  onPick: (tile: TileName | null) => void;
  onAdd: () => void;
  onRemoveAt: (index: number) => void;
  onReread: () => void;
  onNudge: (dx: number, dy: number) => void;
  onFace: () => void;
  onConfirm: () => void;
  onRevert: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (by: 1 | -1) => void;
  onSave: () => void;
  onOpen: () => void;
}

export interface TilePaletteHandle {
  /** What the cursor is over: what is drawn there, and whether it was decided by hand. */
  showCell: (at: { col: number; row: number } | null, stack: Piece[], byHand: boolean, stale: boolean) => void;
  setSteps: (canUndo: boolean, canRedo: boolean) => void;
  setCounts: (counts: Counts) => void;
}

/**
 * The tiles on a cell, bottom of the stack first, each with a way to take it
 * back off. Written out because a stack of two is the ordinary case — a wall is
 * a brick face with its lit lip over it — and a picture of the result does not
 * say which tiles made it.
 */
function stackList(
  root: HTMLElement,
  onRemoveAt: (index: number) => void,
): (pieces: Piece[] | null) => void {
  const list = document.createElement("div");
  list.className = "ed-stack";
  root.appendChild(list);

  return (pieces) => {
    list.innerHTML = "";
    // Null is the cursor being off the board, which the line above already says.
    list.hidden = pieces === null;
    if (pieces === null) return;
    if (pieces.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ed-stack-empty";
      empty.textContent = "Nothing on this cell.";
      list.appendChild(empty);
      return;
    }
    // Topmost first, the way it is looked at rather than the way it is drawn.
    pieces
      .map((piece, index) => ({ piece, index }))
      .reverse()
      .forEach(({ piece, index }) => {
        const row = document.createElement("div");
        row.className = "ed-stack-row";

        const label = document.createElement("span");
        label.className = "ed-stack-name";
        label.textContent = describe(piece);
        label.title = describe(piece);

        const drop = document.createElement("button");
        drop.className = "ed-stack-drop";
        drop.textContent = "✕";
        drop.title = `Take ${piece.tile} off`;
        drop.addEventListener("click", () => onRemoveAt(index));

        row.append(label, drop);
        list.appendChild(row);
      });
  };
}

/** A tile drawn into a fixed square, so a tall one does not tower over a wall. */
function swatch(atlas: Atlas, name: TileName): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SWATCH_PX;
  canvas.height = SWATCH_PX;
  const g = canvas.getContext("2d")!;
  // A checker behind it, so the transparent 12px of a `wall_top_*` reads as
  // transparent rather than as a tile that failed to draw.
  g.fillStyle = "#20191a";
  g.fillRect(0, 0, SWATCH_PX, SWATCH_PX);
  g.fillStyle = "#2b2223";
  for (let y = 0; y < SWATCH_PX; y += 8) {
    for (let x = 0; x < SWATCH_PX; x += 8) if (((x + y) / 8) % 2 === 0) g.fillRect(x, y, 8, 8);
  }
  const [, , w, h] = TILES[name];
  const fit = swatchFit(w, h);
  g.imageSmoothingEnabled = false;
  atlas.draw(g, name, fit.x, fit.y, fit.zoom);
  return canvas;
}

const describe = (piece: Piece): string =>
  `${piece.tile}@${piece.dx},${piece.dy}${piece.face ? " face" : ""}`;

export function buildTilePalette(
  root: HTMLElement,
  atlas: Atlas,
  state: EditorState,
  actions: TileActions,
  holding: TileName | null,
): TilePaletteHandle {
  root.innerHTML = "";
  buildTop(root, state, actions.onMode);

  // The cell readout comes before the palette: the palette is ten rows of
  // swatches, and everything below it would be off the bottom of the sidebar.
  heading(root, "This cell");
  const where = document.createElement("div");
  where.className = "ed-where";
  root.appendChild(where);
  const showStack = stackList(root, actions.onRemoveAt);

  const stackTools = toolRow(root, [
    { id: "add", label: "Stack", title: "Lay the tile in hand over what is here", onClick: actions.onAdd },
    { id: "face", label: "Face", title: "Head-on brick a banner may hang on", onClick: actions.onFace },
  ]);
  const nudgeTools = toolRow(root, [
    { id: "up", label: "↑", title: "Nudge the top tile up a lip", onClick: () => actions.onNudge(0, -1) },
    { id: "down", label: "↓", title: "Nudge it down a lip", onClick: () => actions.onNudge(0, 1) },
    { id: "left", label: "←", title: "Nudge it left a lip", onClick: () => actions.onNudge(-1, 0) },
    { id: "right", label: "→", title: "Nudge it right a lip", onClick: () => actions.onNudge(1, 0) },
  ]);

  const cellTools = toolRow(root, [
    { id: "confirm", label: "Right", title: "The autotiler had this one right", onClick: actions.onConfirm },
    { id: "revert", label: "Undo cell", title: "Hand it back to the autotiler", onClick: actions.onRevert },
  ]);

  heading(root, "Steps and zoom");
  const steps: ToolRow = toolRow(root, [
    { id: "undo", label: "↶", title: "Undo", onClick: actions.onUndo },
    { id: "redo", label: "↷", title: "Redo", onClick: actions.onRedo },
    { id: "out", label: "−", title: "Zoom out", onClick: () => actions.onZoom(-1) },
    { id: "in", label: "+", title: "Zoom in", onClick: () => actions.onZoom(1) },
  ]);

  heading(root, "Tile");
  const tabs = tabRow<GroupId>(root, [...GROUPS], (id) => tiles.show(tilesIn(id)));
  let inHand: TileName | null = holding;
  const tiles = swatchGrid<TileName>(root, {
    key: (name) => name,
    label: (name) => name,
    face: (name) => swatch(atlas, name),
    // Picking the tile already in hand puts it down again, which is how a cell
    // gets chosen for a nudge without being stamped over first.
    onPick: (name) => {
      inHand = inHand === name ? null : name;
      tiles.select(inHand);
      actions.onPick(inHand);
    },
  });
  tabs.show(GROUPS[0]!.id);
  tiles.select(inHand);

  heading(root, "Corrections");
  const tally = document.createElement("div");
  tally.className = "ed-hint";
  root.appendChild(tally);

  actionColumn(root, [
    { label: "Save corrections…", onClick: actions.onSave, go: true },
    { label: "Open corrections…", onClick: actions.onOpen },
    { label: "Re-read the floor", onClick: actions.onReread },
    { label: "Play This Dungeon", onClick: actions.onPlay },
  ]);

  hint(
    root,
    "Click a cell to choose it — green ring — and the buttons above act on that cell, " +
      "so you can leave the board without losing it. Escape, or a click off the dungeon, lets it go. " +
      "A click also lays down the tile in hand; click that tile again to put it down and only choose. " +
      "Right-click hands a cell back to the autotiler. " +
      "A floor tile makes its cell floor, so a room drawn from nothing counts the same as one that was dug. " +
      "Red means the floor moved after a cell was decided — Re-read the floor settles them all at once.",
  );

  const setCellTools = (on: boolean): void => {
    for (const id of ["add", "face"]) stackTools.setEnabled(id, on);
    for (const id of ["up", "down", "left", "right"]) nudgeTools.setEnabled(id, on);
    for (const id of ["confirm", "revert"]) cellTools.setEnabled(id, on);
  };
  setCellTools(false);

  return {
    showCell(at, pieces, byHand, stale) {
      setCellTools(at !== null);
      if (!at) {
        where.className = "ed-where ed-stack-empty";
        where.textContent = "Nothing under the cursor.";
        showStack(null);
        return;
      }
      where.className = `ed-where${stale ? " ed-stack-stale" : byHand ? "" : " ed-stack-auto"}`;
      where.textContent =
        `${at.col},${at.row}  ${byHand ? "by hand" : "autotiler"}` + (stale ? "  · the floor moved" : "");
      showStack(pieces);
    },
    setSteps(canUndo, canRedo) {
      steps.setEnabled("undo", canUndo);
      steps.setEnabled("redo", canRedo);
    },
    setCounts(counts) {
      const parts = [`${counts.corrected} corrected`, `${counts.confirmed} confirmed`];
      if (counts.stale) parts.push(`${counts.stale} stale`);
      tally.textContent = parts.join(", ");
    },
  };
}
