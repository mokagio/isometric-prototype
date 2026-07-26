import { loadTileset } from "../tileset";
import { unproject } from "../iso";
import tilesheetUrl from "../../isometric_fantasy_tiles.png";
import { Board } from "./board";
import { PALETTE } from "./palette";
import { buildSidebar, clampHeight, type EditorState } from "./sidebar";
import { boardOrigin, renderEditor, type Cell } from "./render";

const BOARD_SIZE = 20;

async function main(): Promise<void> {
  const canvas = document.getElementById("board-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const sidebarEl = document.getElementById("sidebar") as HTMLElement;
  const tileset = await loadTileset(tilesheetUrl);

  const board = new Board(BOARD_SIZE);
  const state: EditorState = { brush: PALETTE[0]!.tile, mode: "place", height: 0 };

  let hover: Cell | null = null;
  let painting = false;
  let paintErase = false;

  let pending = false;
  const requestRender = (): void => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      draw();
    });
  };

  const sidebar = buildSidebar(sidebarEl, tileset, state, requestRender);

  function draw(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderEditor(ctx, tileset, board, boardOrigin(board, w, h), hover, state, w, h);
  }

  const cellAt = (clientX: number, clientY: number): Cell => {
    const rect = canvas.getBoundingClientRect();
    const origin = boardOrigin(board, canvas.clientWidth, canvas.clientHeight);
    return unproject(clientX - rect.left, clientY - rect.top, origin);
  };

  const applyAt = (cell: Cell, erase: boolean): void => {
    if (!board.inBounds(cell.col, cell.row)) return;
    if (erase) board.erase(cell.col, cell.row);
    else board.place(cell.col, cell.row, state.brush, state.height);
  };

  canvas.addEventListener("mousemove", (e) => {
    hover = cellAt(e.clientX, e.clientY);
    if (painting) applyAt(hover, paintErase);
    requestRender();
  });

  canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const cell = cellAt(e.clientX, e.clientY);
    hover = cell;
    paintErase = e.button === 2 || state.mode === "erase";
    painting = true;
    applyAt(cell, paintErase);
    requestRender();
  });

  const stop = (): void => {
    painting = false;
  };
  window.addEventListener("mouseup", stop);
  canvas.addEventListener("mouseleave", () => {
    hover = null;
    stop();
    requestRender();
  });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      state.height = clampHeight(state.height + (e.deltaY < 0 ? 1 : -1));
      sidebar.syncHeight();
      requestRender();
    },
    { passive: false },
  );

  window.addEventListener("resize", requestRender);
  draw();
}

void main();
