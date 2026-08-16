import { createAtlas } from "../atlas";
import { clearBuild, loadBuild, saveBuild } from "../build";
import { generateDungeon } from "../dungeon";
import type { FloorAt } from "../dungeonTiles";
import { CELL, project, unproject } from "../grid";
import { render } from "../renderer";
import type { TileName } from "../tiles";
import { downloadText, pickTextFile } from "../../files";
import { History, jsonSteps } from "../../history";
import { createPainter } from "../../painter";
import { createPanPad } from "../../panPad";
import { Board } from "./board";
import { buildDigSidebar, type EditorState, type Mode } from "./sidebar";
import {
  add,
  confirm,
  correctionAt,
  drawnAt,
  floorWith,
  counts as countCorrections,
  isStale,
  nudge,
  removeAt,
  reread,
  revert,
  setFace,
  stackAt,
  stamp,
  type Corrections,
} from "./tiles/corrections";
import { buildFile, decodeTiles, encodeTiles, tilesFilename } from "./tiles/format";
import { buildTilePalette, type TilePaletteHandle } from "./tiles/palette";
import { floorGrid, forgetWork, recallWork, stashWork } from "./tiles/stash";
import { floorRows } from "./tiles/around";
import { FITTED, pan, placement, roomToPan, stepZoom, type View } from "./view";

const COLS = 40;
const ROWS = 30;

async function main(): Promise<void> {
  const canvas = document.getElementById("board-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const sidebarEl = document.getElementById("sidebar") as HTMLElement;
  const shell = document.getElementById("editor") as HTMLElement;

  const atlas = createAtlas();
  await atlas.ready;

  // Where the last session got to, then the saved build, then a fresh random
  // dungeon — a blank grid is a hard thing to be handed. The stash comes first
  // because its rulings are about that floor and no other.
  const held = recallWork(COLS, ROWS);
  const start = loadBuild() ?? generateDungeon(COLS, ROWS, Math.floor(Math.random() * 1_000_000), 6);
  const board = new Board(
    COLS,
    ROWS,
    held
      ? floorGrid(held.floor)
      : Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => start.isFloor(c, r))),
  );
  const state: EditorState = { mode: "dig", tool: "dig", brush: 1 };

  let corrections: Corrections = held?.corrections ?? {};
  const past = new History<Corrections>(corrections, jsonSteps<Corrections>());
  let holding: TileName | null = null;
  let view: View = FITTED;
  let hover: { col: number; row: number } | null = null;
  // The cell the sidebar is about. It has to outlast the pointer: reaching the
  // buttons means leaving the canvas, and hovering ends the moment you do.
  let chosen: { col: number; row: number } | null = null;
  let palette: TilePaletteHandle | null = null;

  const viewSize = (): { w: number; h: number } => ({ w: canvas.clientWidth, h: canvas.clientHeight });

  /**
   * The floor as drawn. In tiles mode a laid-down floor tile counts as floor, so
   * a room filled in from nothing gets the same windows as one that was dug.
   */
  const floorNow = (): FloorAt =>
    state.mode === "tiles" ? floorWith(board.isFloor, corrections) : board.isFloor;

  let pending = false;
  const requestRender = (): void => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      draw();
    });
  };

  function draw(): void {
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = viewSize();
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const { scale, origin } = placement(view, board, w, h);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    // In dig mode nothing is decided by hand, so the autotiler draws it all and
    // the board looks exactly as it will when it is played. In tiles mode the
    // autotiler still fills in around the cells nobody has ruled on, and it
    // works off the drawn floor, so laying a floor tile grows walls beside it.
    const wallAt = state.mode === "tiles" ? (col: number, row: number) => drawnAt(corrections, col, row) : undefined;
    render(ctx, atlas, { ...board.asDungeon(), isFloor: floorNow() }, origin, w / scale, h / scale, [], wallAt);

    ctx.save();
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = "rgba(211, 191, 169, 0.2)";
    ctx.strokeRect(origin.x, origin.y, board.cols * CELL, board.rows * CELL);
    if (state.mode === "tiles") markCorrected(origin, scale);
    if (state.mode === "tiles" && chosen) markChosen(origin, scale);
    if (hover && board.inBounds(hover.col, hover.row)) markHover(origin, scale);
    ctx.restore();
  }

  /** A ring on every cell somebody has ruled on, red where the floor has since moved. */
  function markCorrected(origin: { x: number; y: number }, scale: number): void {
    ctx.lineWidth = 1 / scale;
    for (const [key, correction] of Object.entries(corrections)) {
      const [col, row] = key.split(",").map(Number);
      if (col === undefined || row === undefined) continue;
      const p = project(col, row, origin);
      ctx.strokeStyle = isStale(floorNow(), correction, col, row) ? "#d1495b" : "rgba(250, 203, 62, 0.55)";
      ctx.strokeRect(p.x + 1, p.y + 1, CELL - 2, CELL - 2);
    }
  }

  /** The cell the sidebar is about, still marked once the pointer has gone. */
  function markChosen(origin: { x: number; y: number }, scale: number): void {
    const p = project(chosen!.col, chosen!.row, origin);
    ctx.lineWidth = 3 / scale;
    ctx.strokeStyle = "#4ba747";
    ctx.strokeRect(p.x + 1, p.y + 1, CELL - 2, CELL - 2);
  }

  function markHover(origin: { x: number; y: number }, scale: number): void {
    const at = hover!;
    ctx.lineWidth = 2 / scale;
    if (state.mode === "tiles") {
      const p = project(at.col, at.row, origin);
      ctx.strokeStyle = "rgba(250, 203, 62, 0.7)";
      ctx.strokeRect(p.x, p.y, CELL, CELL);
      return;
    }
    const half = state.brush;
    const p = project(at.col - half, at.row - half, origin);
    ctx.strokeStyle = state.tool === "dig" ? "#facb3e" : "#d1495b";
    ctx.strokeRect(p.x, p.y, (half * 2 + 1) * CELL, (half * 2 + 1) * CELL);
  }

  const cellAt = (x: number, y: number): { col: number; row: number } => {
    const { w, h } = viewSize();
    const { scale, origin } = placement(view, board, w, h);
    return unproject(x / scale, y / scale, origin);
  };

  /** Show the chosen cell, and how many rulings there are on the board. */
  function reportCell(): void {
    if (!palette) return;
    const at = chosen && board.inBounds(chosen.col, chosen.row) ? chosen : null;
    if (!at) palette.showCell(null, [], false, false);
    else {
      const held = correctionAt(corrections, at.col, at.row);
      palette.showCell(
        at,
        stackAt(floorNow(), corrections, at.col, at.row),
        held !== null,
        held !== null && isStale(floorNow(), held, at.col, at.row),
      );
    }
    palette.setSteps(past.canUndo, past.canRedo);
    palette.setCounts(countCorrections(floorNow(), corrections));
  }

  /** The floor and the rulings on it are put by together, since neither means much alone. */
  const stash = (): void => stashWork(floorRows(board.isFloor, board.cols, board.rows), corrections);

  /** Every change to the corrections goes through here, so undo and the tally keep up. */
  function edit(next: Corrections, step = true): void {
    corrections = next;
    if (step) past.record(corrections);
    stash();
    reportCell();
    requestRender();
  }

  /** Put the chosen cell down, so the sidebar has nothing to act on. */
  function letGo(): void {
    if (!chosen) return;
    chosen = null;
    reportCell();
    requestRender();
  }

  /** The sidebar's buttons all act on the chosen cell, whatever the pointer is doing. */
  const onCell = (fn: (col: number, row: number) => Corrections): void => {
    if (!chosen || !board.inBounds(chosen.col, chosen.row)) return;
    edit(fn(chosen.col, chosen.row));
  };

  createPainter<{ col: number; row: number }>(canvas, {
    cellAt,
    rubbing: () => state.mode === "dig" && state.tool === "fill",
    onHover: (cell) => {
      hover = cell;
      requestRender();
    },
    apply: (cell, rubbing) => {
      if (state.mode === "dig") {
        if (board.inBounds(cell.col, cell.row)) board.paint(cell.col, cell.row, state.brush, !rubbing);
        requestRender();
        return;
      }
      if (!board.inBounds(cell.col, cell.row)) {
        letGo();
        return;
      }
      // Touching a cell is what makes it the one the sidebar is about, whether
      // or not there is a tile in hand to lay on it.
      chosen = { col: cell.col, row: cell.row };
      if (rubbing) corrections = revert(corrections, cell.col, cell.row);
      else if (holding) corrections = stamp(floorNow(), corrections, cell.col, cell.row, holding);
      reportCell();
      requestRender();
    },
    // A whole drag is one step back, however many cells it crossed.
    onStroke: () => {
      if (state.mode === "tiles") past.record(corrections);
      // Digging moves the floor the rulings were made against, so the two are
      // put by together however the stroke changed things.
      stash();
      reportCell();
    },
  });

  const panPad = createPanPad(shell, (dir) => {
    const { w, h } = viewSize();
    view = pan(view, dir, board, w, h);
    syncPan();
    requestRender();
  });

  function syncPan(): void {
    const { w, h } = viewSize();
    panPad.setRoom(view.zoom === null ? { up: false, down: false, left: false, right: false } : roomToPan(view, board, w, h));
  }

  const shared = {
    onChange: requestRender,
    onMode: (mode: Mode) => {
      state.mode = mode;
      buildSidebar();
      requestRender();
    },
    onClear: () => {
      board.clear();
      stash();
      requestRender();
    },
    onPlay: () => {
      saveBuild(board.snapshot());
      location.href = "dungeon.html";
    },
    onDiscard: () => {
      clearBuild();
      forgetWork();
      location.reload();
    },
  };

  function buildSidebar(): void {
    if (state.mode === "dig") {
      palette = null;
      buildDigSidebar(sidebarEl, state, shared);
      return;
    }
    palette = buildTilePalette(sidebarEl, atlas, state, {
      ...shared,
      onPick: (tile) => {
        holding = tile;
      },
      onAdd: () => onCell((col, row) => (holding ? add(floorNow(), corrections, col, row, holding) : corrections)),
      onRemoveAt: (index) => onCell((col, row) => removeAt(floorNow(), corrections, col, row, index)),
      onReread: () => edit(reread(floorNow(), corrections)),
      onNudge: (dx, dy) => onCell((col, row) => nudge(floorNow(), corrections, col, row, dx, dy)),
      onFace: () =>
        onCell((col, row) => {
          const stack = stackAt(floorNow(), corrections, col, row);
          const top = stack[stack.length - 1];
          return setFace(floorNow(), corrections, col, row, !top?.face);
        }),
      onConfirm: () => onCell((col, row) => confirm(floorNow(), corrections, col, row)),
      onRevert: () => onCell((col, row) => revert(corrections, col, row)),
      onUndo: () => {
        const back = past.undo();
        if (back) edit(back, false);
      },
      onRedo: () => {
        const forward = past.redo();
        if (forward) edit(forward, false);
      },
      onZoom: (by) => {
        const { w, h } = viewSize();
        view = stepZoom(view, by);
        view = pan(view, "up", board, w, h);
        view = pan(view, "down", board, w, h);
        syncPan();
        requestRender();
      },
      onSave: () => {
        const file = buildFile(floorNow(), { cols: board.cols, rows: board.rows }, corrections, new Date().toISOString());
        downloadText(tilesFilename(new Date()), encodeTiles(file));
      },
      onOpen: () => {
        void pickTextFile().then((text) => {
          if (text === null) return;
          try {
            const opened = decodeTiles(text);
            if (opened.cols !== board.cols || opened.rows !== board.rows) {
              // The windows would still be right, but the positions would land
              // on a different dungeon, so every cell would read as stale.
              throw new Error(
                `Those corrections are for a ${opened.cols}x${opened.rows} dungeon, and this one is ${board.cols}x${board.rows}.`,
              );
            }
            past.reset(opened.corrections);
            edit(opened.corrections, false);
          } catch (whyNot) {
            window.alert(whyNot instanceof Error ? whyNot.message : "That file could not be read.");
          }
        });
      },
    }, holding);
    reportCell();
  }

  buildSidebar();
  syncPan();
  window.addEventListener("resize", () => {
    syncPan();
    requestRender();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") letGo();
  });
  draw();
}

void main();
