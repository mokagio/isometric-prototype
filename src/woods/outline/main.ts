import { downloadText, pickTextFile } from "../../files";
import { PLAY_DRAWN_OUTLINE_URL, recallOutline, stashOutline } from "../../handoff";
import { Loop } from "../../loop";
import { SheetLoader, type Sheet } from "../../sprites";
import { createMenu } from "../../ui";
import { COAST_TILES, SEA_CODE, type CoastTile } from "../coastTiles";
import { onIsland, type Cell } from "../editor/view";
import { FIELD, FIELD_PX, GRASS_VARIANTS, TILE } from "../field";
import { DEEP_SEA, drawCoastTile, drawIslandGround, fencePosts } from "../ground";
import {
  codeAt,
  decodeOutline,
  draw,
  editable,
  encodeOutline,
  grownOutline,
  outlineFilename,
  setDrawnOutline,
  type Outline,
} from "../outline";
import type { Pos } from "../walker";
import {
  cameraFor,
  cellAt,
  clampOrigin,
  stepZoom,
  zoomAbout,
  zoomLadder,
  ZOOM_STEPS,
  type View,
} from "./camera";
import { History } from "./history";
import { buildPalette, type PaletteSheets } from "./palette";

// Drawing the island's shape, tile by tile. The coastline the game grows for
// itself is what the page opens on, so this is editing an island rather than
// starting from a blank sheet — and what is saved is a file of characters, one
// per cell, meant to be read and pasted into the source.

const url = (name: string): string => `${import.meta.env.BASE_URL}sunnyside/${name}`;

const SHEET_FILES = {
  sea: "sea.png",
  sparkle: "seaSparkle.png",
  shore: "shore.png",
  shore2: "shore2.png",
  cliff: "cliff.png",
  lip: "lip.png",
  lipCorner: "cliffTop.png",
  fence: "fence.png",
  grassSand: "grassSand.png",
  grassEdge: "grassEdge.png",
  sandDeco: "sandDeco.png",
  sand: "sand.png",
  grassUnder: "grass.png",
} as const;

const GRID_LINE = "rgba(255, 255, 255, 0.16)";
const HOVER = "rgba(255, 255, 255, 0.35)";
const HOVER_NO = "rgba(255, 90, 90, 0.4)";
// The band the drawing owns, marked off so it is obvious where the game starts.
const FENCE_EDGE = "rgba(255, 233, 128, 0.5)";

function main(): void {
  const canvas = document.getElementById("outline-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;

  const loader = new SheetLoader(Object.keys(SHEET_FILES).length);
  const sheets = Object.fromEntries(
    Object.entries(SHEET_FILES).map(([key, file]) => [key, loader.load(url(file))]),
  ) as unknown as PaletteSheets & { grassUnder: Sheet };

  // Whatever was last handed over, so the page picks up where the game left off.
  let outline: Outline = openStashed() ?? grownOutline();
  let brush: CoastTile = COAST_TILES[0]!;
  let erasing = false;
  let painting: string | null = null; // the code the drag is laying down
  let panning: Pos | null = null; // where the middle button last was
  let grid = true;
  let hover: Cell | null = null;
  let animT = 0;
  let swatchesDrawn = false;
  const history = new History(outline);

  const palette = buildPalette(
    document.getElementById("sidebar") as HTMLElement,
    sheets,
    {
      onPick: (tile) => {
        brush = tile;
        erasing = false;
      },
      onErase: () => {
        erasing = true;
      },
      onUndo: () => goTo(history.undo()),
      onRedo: () => goTo(history.redo()),
      onZoom: (by) => zoomBy(by),
      onGrid: (on) => {
        grid = on;
      },
      onSave: () => downloadText(outlineFilename(new Date()), encodeOutline(outline)),
      onOpen: () => void open(),
      onPlay: () => play(),
      onReset: () => replace(grownOutline()),
    },
    brush,
  );
  const syncHistory = (): void => palette.syncHistory(history.canUndo, history.canRedo);
  syncHistory();

  /** Go to a state undo or redo handed back. Null means there was nowhere to go. */
  function goTo(to: Outline | null): void {
    if (to) outline = to;
    syncHistory();
  }

  /** A whole drawing arriving at once — opened, or started over. The past goes with it. */
  function replace(next: Outline): void {
    outline = next;
    history.reset(outline);
    syncHistory();
  }

  function openStashed(): Outline | null {
    const text = recallOutline();
    if (text === null) return null;
    try {
      return decodeOutline(text);
    } catch {
      // A stale or damaged stash is not worth an alert on the way in.
      return null;
    }
  }

  async function open(): Promise<void> {
    const text = await pickTextFile();
    if (text === null) return;
    try {
      replace(decodeOutline(text));
    } catch (e) {
      alert(e instanceof Error ? e.message : "That outline could not be opened.");
    }
  }

  function play(): void {
    if (!stashOutline(encodeOutline(outline))) {
      alert("This browser will not let the editor pass an outline to the game.");
      return;
    }
    location.href = PLAY_DRAWN_OUTLINE_URL;
  }

  // Where the page is looking. Starts on the whole island; `fit` re-centres it
  // whenever the window changes shape, which is also what sets the way out.
  // Everything here is in CSS pixels; the canvas is the only thing that knows
  // about the screen's own.
  let view: View = { zoom: 1, origin: { x: 0, y: 0 } };
  let ladder: number[] = ZOOM_STEPS;
  const settle = (): void => {
    view = { ...view, origin: clampOrigin(view.origin, view.zoom, canvas.clientWidth, canvas.clientHeight) };
    palette.syncZoom(view.zoom > ladder[0]!, view.zoom < ladder[ladder.length - 1]!);
  };
  function fit(w: number, h: number): void {
    ladder = zoomLadder(w, h);
    view = { zoom: ladder[0]!, origin: { x: 0, y: 0 } };
    settle();
  }

  /** Zoom a rung, keeping `anchor` over the same tile. Defaults to the middle. */
  function zoomBy(by: 1 | -1, anchor?: Pos): void {
    const to = stepZoom(ladder, view.zoom, by);
    if (to === view.zoom) return;
    const about = anchor ?? { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
    view = { zoom: to, origin: zoomAbout(view.origin, view.zoom, to, about) };
    settle();
  }

  const pointOf = (e: MouseEvent): Pos => ({ x: e.offsetX, y: e.offsetY });

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    // The middle button drags the island about, as it does everywhere else.
    if (e.button === 1) {
      panning = pointOf(e);
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    // The right button clears back to open water, whichever brush is in hand.
    painting = e.button === 2 || erasing ? SEA_CODE : brush.code;
    const cell = cellAt(pointOf(e), view);
    draw(outline, cell.col, cell.row, painting);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const point = pointOf(e);
    if (panning) {
      view = {
        ...view,
        origin: { x: view.origin.x + point.x - panning.x, y: view.origin.y + point.y - panning.y },
      };
      panning = point;
      settle();
      return;
    }
    hover = cellAt(point, view);
    if (painting !== null) draw(outline, hover.col, hover.row, painting);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(type, () => {
      panning = null;
      if (painting === null) return;
      painting = null;
      // A whole drag is one step back, however many cells it crossed.
      if (history.record(outline)) syncHistory();
    });
  }
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1 : -1, pointOf(e));
    },
    { passive: false },
  );

  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      goTo(e.shiftKey ? history.redo() : history.undo());
      return;
    }
    if (e.key === "+" || e.key === "=") zoomBy(1);
    else if (e.key === "-" || e.key === "_") zoomBy(-1);
  });
  canvas.addEventListener("pointerleave", () => {
    hover = null;
  });

  createMenu("Island Outline", {
    onAllGames: () => {
      location.href = "index.html";
    },
  });

  const step = (dt: number): void => {
    animT += dt;
    if (!swatchesDrawn && loader.ready) {
      palette.refresh();
      swatchesDrawn = true;
    }
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      fit(w, h); // a resize moves the way out, so the view starts again from it
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // What the game will do with this outline, done here: the editor and the
    // game are the same picture because they are the same code.
    setDrawnOutline(outline);
    render(w, h);
  };

  function render(w: number, h: number): void {
    const z = view.zoom;
    ctx.fillStyle = DEEP_SEA;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    const ground = { camera: cameraFor(view), zoom: z, width: w, height: h, animT };
    drawIslandGround(ctx, sheets, ground, (col, row, at) => {
      if (!sheets.grassUnder.ok) return;
      const frame = (col * 7 + row * 13) % GRASS_VARIANTS;
      drawCoastTile(ctx, sheets.grassUnder.img, { col: frame, row: 0 }, at, z);
    });
    for (const post of fencePosts(ground)) {
      if (sheets.fence.ok) drawCoastTile(ctx, sheets.fence.img, post.tile, post.at, z, post.flipV);
    }

    const origin = view.origin;
    const cell = TILE * z;
    if (grid) {
      ctx.strokeStyle = GRID_LINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= FIELD; i++) {
        const at = i * cell;
        ctx.moveTo(origin.x + at + 0.5, origin.y);
        ctx.lineTo(origin.x + at + 0.5, origin.y + FIELD_PX * z);
        ctx.moveTo(origin.x, origin.y + at + 0.5);
        ctx.lineTo(origin.x + FIELD_PX * z, origin.y + at + 0.5);
      }
      ctx.stroke();
    }

    // The line the drawing stops at, drawn from `editable` itself so it cannot
    // disagree with what the page will let you paint.
    ctx.strokeStyle = FENCE_EDGE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let row = 0; row < FIELD; row++) {
      for (let col = 0; col < FIELD; col++) {
        if (editable(col, row)) continue;
        const x = origin.x + col * cell;
        const y = origin.y + row * cell;
        if (editable(col, row - 1)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + cell, y);
        }
        if (editable(col, row + 1)) {
          ctx.moveTo(x, y + cell);
          ctx.lineTo(x + cell, y + cell);
        }
        if (editable(col - 1, row)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + cell);
        }
        if (editable(col + 1, row)) {
          ctx.moveTo(x + cell, y);
          ctx.lineTo(x + cell, y + cell);
        }
      }
    }
    ctx.stroke();

    if (hover && onIsland(hover)) {
      ctx.fillStyle = editable(hover.col, hover.row) ? HOVER : HOVER_NO;
      ctx.fillRect(origin.x + hover.col * cell, origin.y + hover.row * cell, cell, cell);
    }

    showCode(hover);
  }

  const readout = document.getElementById("readout") as HTMLElement;
  function showCode(at: Cell | null): void {
    if (!at || !onIsland(at)) {
      readout.textContent = "";
      return;
    }
    readout.textContent = `${at.col}, ${at.row}   ${codeAt(outline, at.col, at.row)}`;
  }

  new Loop(step).start();
}

main();
