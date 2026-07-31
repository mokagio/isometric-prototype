import { downloadText, pickTextFile } from "../../files";
import { PLAY_DRAWN_OUTLINE_URL, recallOutline, stashOutline } from "../../handoff";
import { Loop } from "../../loop";
import { SheetLoader, type Sheet } from "../../sprites";
import { createMenu } from "../../ui";
import { COAST_TILES, SEA_CODE, type CoastTile } from "../coastTiles";
import { cameraFor, cellAtPoint, fitZoom, islandOrigin, onIsland, type Cell } from "../editor/view";
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
  let painting: string | null = null; // the code the drag is laying down
  let grid = true;
  let hover: Cell | null = null;
  let animT = 0;
  let swatchesDrawn = false;

  const palette = buildPalette(
    document.getElementById("sidebar") as HTMLElement,
    sheets,
    {
      onPick: (tile) => {
        brush = tile;
      },
      onGrid: (on) => {
        grid = on;
      },
      onSave: () => downloadText(outlineFilename(new Date()), encodeOutline(outline)),
      onOpen: () => void open(),
      onPlay: () => play(),
      onReset: () => {
        outline = grownOutline();
      },
    },
    brush,
  );

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
      outline = decodeOutline(text);
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

  // Unlike the island editor this one has to show the coast, which is the part
  // that falls off the bottom of a short window — so it is allowed to shrink
  // below life size rather than crop. Half steps, so the pixels stay square.
  const zoom = (): number => {
    const fits = fitZoom(canvas.width, canvas.height);
    if (fits * FIELD_PX <= canvas.height && fits * FIELD_PX <= canvas.width) return fits;
    return Math.max(0.5, Math.floor((Math.min(canvas.width, canvas.height) / FIELD_PX) * 2) / 2);
  };
  const cellAt = (e: PointerEvent): Cell =>
    cellAtPoint(e.offsetX, e.offsetY, canvas.width, canvas.height, zoom());

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    // The right button clears back to open water, so a slip is undone in place.
    painting = e.button === 2 ? SEA_CODE : brush.code;
    const cell = cellAt(e);
    draw(outline, cell.col, cell.row, painting);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    hover = cellAt(e);
    if (painting !== null) draw(outline, hover.col, hover.row, painting);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(type, () => {
      painting = null;
    });
  }
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
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    // What the game will do with this outline, done here: the editor and the
    // game are the same picture because they are the same code.
    setDrawnOutline(outline);
    render(w, h);
  };

  function render(w: number, h: number): void {
    const z = zoom();
    ctx.fillStyle = DEEP_SEA;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    const view = { camera: cameraFor(w, h, z), zoom: z, width: w, height: h, animT };
    drawIslandGround(ctx, sheets, view, (col, row, at) => {
      if (!sheets.grassUnder.ok) return;
      const frame = (col * 7 + row * 13) % GRASS_VARIANTS;
      drawCoastTile(ctx, sheets.grassUnder.img, { col: frame, row: 0 }, at, z);
    });
    for (const post of fencePosts(view)) {
      if (sheets.fence.ok) drawCoastTile(ctx, sheets.fence.img, post.tile, post.at, z, post.flipV);
    }

    const origin = islandOrigin(w, h, z);
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
