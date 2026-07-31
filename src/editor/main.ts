import { loadTileset } from "../tileset";
import { unproject } from "../iso";
import { generateWorld, GRASS, MAP_SIZE, randomSeed } from "../world";
import tilesheetUrl from "../../isometric_fantasy_tiles.png";
import { Board } from "./board";
import { PALETTE } from "./palette";
import { buildSidebar, clampHeight, type EditorState } from "./sidebar";
import { renderEditor, type Cell } from "./render";
import { centreView, panRoom, panView, viewOrigin } from "./view";
import { createPanPad, type PanDir } from "../panPad";
import { History, jsonSteps } from "../history";
import { createPainter } from "../painter";
import { boardToMap, loadMapIntoBoard, mapFilename } from "./mapIO";
import { decodeMap, encodeMap, mapFromWorld, readyToPlay, type MapData } from "../mapFormat";
import { downloadText, pickTextFile } from "../files";
import { PLAY_STASHED_MAP_URL, recallMap, recallWorldSeed, stashMap, wantsStashedMap } from "../handoff";

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
  const state: EditorState = { brush: PALETTE[0]!.tile, erasing: false, height: 0 };
  let view = centreView(board.size);

  let hover: Cell | null = null;

  // The board is a class, so the snapshot is the map file it would write — which
  // `mapIO` already knows how to make and to load back.
  const history = new History(boardToMap(board), jsonSteps<MapData>());
  const syncHistory = (): void => sidebar.syncHistory(history.canUndo, history.canRedo);

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

  // A board that arrived whole — opened, or loaded from the game. The past goes
  // with it: undoing across someone else's map is not a step anybody meant.
  const showBoard = (): void => {
    view = centreView(board.size);
    history.reset(boardToMap(board));
    syncHistory();
    requestRender();
  };

  const goTo = (map: MapData | null): void => {
    if (map) loadMapIntoBoard(board, map);
    syncHistory();
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
    // Asked here rather than in the game: you are stood over the board with a
    // brush in hand, so "keep building" is a real answer.
    const map = readyToPlay(boardToMap(board), confirm, GRASS);
    if (map === null) return;
    if (!stashMap(encodeMap(map))) {
      alert("This browser will not let the editor pass a map to the game. Save the map and open it in the game instead.");
      return;
    }
    location.href = PLAY_STASHED_MAP_URL;
  };

  const setErasing = (on: boolean): void => {
    state.erasing = on;
    sidebar.syncErasing();
    requestRender();
  };

  const sidebar = buildSidebar(sidebarEl, tileset, state, requestRender, {
    onSave: saveMap,
    onOpen: () => void openMap(),
    onLoadGameWorld: loadGameWorld,
    onPlay: playMap,
    onUndo: () => goTo(history.undo()),
    onRedo: () => goTo(history.redo()),
    onErasing: setErasing,
  });
  syncHistory();

  function draw(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderEditor(ctx, tileset, board, viewOrigin(view, w, h), hover, state, w, h);
  }

  const pan = (dir: PanDir): void => {
    view = panView(view, dir, board.size);
    pad.setRoom(panRoom(view, board.size));
    requestRender();
  };

  createPainter<Cell>(canvas, {
    cellAt: (x, y) => unproject(x, y, viewOrigin(view, canvas.clientWidth, canvas.clientHeight)),
    rubbing: () => state.erasing,
    apply: (cell, rubbing) => {
      if (!board.inBounds(cell.col, cell.row)) return;
      if (rubbing) board.erase(cell.col, cell.row);
      else board.place(cell.col, cell.row, state.brush, state.height);
      requestRender();
    },
    onHover: (cell) => {
      hover = cell;
      requestRender();
    },
    onStroke: () => {
      if (history.record(boardToMap(board))) syncHistory();
    },
  });

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
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      goTo(e.shiftKey ? history.redo() : history.undo());
      return;
    }
    if (e.key === "e" || e.key === "E") return setErasing(!state.erasing);
    const dir = PAN_KEYS[e.key.toLowerCase()];
    if (!dir) return;
    e.preventDefault(); // arrows would otherwise scroll the page under the board
    pan(dir);
  });

  const pad = createPanPad(editorEl, pan);
  pad.setRoom(panRoom(view, board.size));

  // Arrived from the game's Edit Map: open what was being played. An empty board
  // is a fine fallback, so a stash that will not read is worth a word and no more.
  if (wantsStashedMap(location.search)) {
    const text = recallMap();
    try {
      if (text !== null) loadMapIntoBoard(board, decodeMap(text));
    } catch (e) {
      alert(e instanceof Error ? e.message : "That map could not be opened.");
    }
    history.reset(boardToMap(board));
    syncHistory();
  }

  window.addEventListener("resize", requestRender);
  draw();
}

void main();
