import { loadTileset } from "../tileset";
import { unproject } from "../iso";
import { generateWorld, MAP_SIZE, randomSeed } from "../world";
import tilesheetUrl from "../../isometric_fantasy_tiles.png";
import { Board } from "./board";
import { PALETTE } from "./palette";
import { buildSidebar, clampHeight, type EditorState } from "./sidebar";
import { renderEditor, type Cell } from "./render";
import { centreView, panView, viewOrigin, type PanDir } from "./view";
import { createPanPad } from "./panPad";
import { boardToMap, loadMapIntoBoard, mapFilename } from "./mapIO";
import { decodeMap, encodeMap, mapFromWorld } from "../mapFormat";
import { downloadText, pickTextFile } from "./files";
import { PLAY_STASHED_MAP_URL, recallWorldSeed, stashMap } from "../handoff";

const PAN_KEYS: Record<string, PanDir> = {
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

async function main(): Promise<void> {
  const canvas = document.getElementById("board-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const sidebarEl = document.getElementById("sidebar") as HTMLElement;
  const editorEl = document.getElementById("editor") as HTMLElement;
  const tileset = await loadTileset(tilesheetUrl);

  const board = new Board(MAP_SIZE);
  const state: EditorState = { brush: PALETTE[0]!.tile, mode: "place", height: 0 };
  let view = centreView(board.size);

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

  const saveMap = (): void => downloadText(mapFilename(new Date()), encodeMap(boardToMap(board)));

  // Loading replaces the board, so anything already built gets a say first.
  const mayReplaceBoard = (): boolean =>
    board.placed === 0 || confirm("This replaces what you have built. Save it first if you want to keep it.");

  const showBoard = (): void => {
    view = centreView(board.size);
    requestRender();
  };

  const openMap = async (): Promise<void> => {
    if (!mayReplaceBoard()) return;
    const text = await pickTextFile();
    if (text === null) return;
    try {
      loadMapIntoBoard(board, decodeMap(text));
    } catch (e) {
      alert(e instanceof Error ? e.message : "That map could not be opened.");
      return;
    }
    showBoard();
  };

  // Worlds are a pure function of their seed, so the game stashing its seed is
  // enough for the editor to rebuild the exact world being played. Never having
  // played leaves no seed, and a fresh world is a fine thing to start from.
  const loadGameWorld = (): void => {
    if (!mayReplaceBoard()) return;
    const world = generateWorld(board.size, board.size, recallWorldSeed() ?? randomSeed());
    loadMapIntoBoard(board, mapFromWorld(world));
    showBoard();
  };

  const playMap = (): void => {
    if (!stashMap(encodeMap(boardToMap(board)))) {
      alert("This browser will not let the editor pass a map to the game. Save the map and open it in the game instead.");
      return;
    }
    location.href = PLAY_STASHED_MAP_URL;
  };

  const sidebar = buildSidebar(sidebarEl, tileset, state, requestRender, {
    onSave: saveMap,
    onOpen: () => void openMap(),
    onLoadGameWorld: loadGameWorld,
    onPlay: playMap,
  });

  function draw(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderEditor(ctx, tileset, board, viewOrigin(view, w, h), hover, state, w, h);
  }

  const cellAt = (clientX: number, clientY: number): Cell => {
    const rect = canvas.getBoundingClientRect();
    const origin = viewOrigin(view, canvas.clientWidth, canvas.clientHeight);
    return unproject(clientX - rect.left, clientY - rect.top, origin);
  };

  const pan = (dir: PanDir): void => {
    view = panView(view, dir, board.size);
    requestRender();
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

  window.addEventListener("keydown", (e) => {
    const dir = PAN_KEYS[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault(); // arrows would otherwise scroll the page under the board
    pan(dir);
  });

  createPanPad(editorEl, pan);

  window.addEventListener("resize", requestRender);
  draw();
}

void main();
