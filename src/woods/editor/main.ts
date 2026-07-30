import { downloadText, pickTextFile } from "../../files";
import { PLAY_STASHED_ISLAND_URL, recallIsland, stashIsland, wantsStashedMap } from "../../handoff";
import { Loop } from "../../loop";
import { SheetLoader } from "../../sprites";
import type { SheetBook } from "../../sunnyside/draw";
import { isProp, type Asset } from "../../sunnyside/library";
import { groundById } from "../../sunnyside/manifest";
import { SHEETS, sheetUrl, type SheetId } from "../../sunnyside/sheets";
import { createMenu } from "../../ui";
import type { CoastSheets } from "../ground";
import {
  decodeIsland,
  emptyIsland,
  encodeIsland,
  erase,
  islandFilename,
  isEmpty,
  paint,
  place,
  type Island,
} from "../island";
import { buildPalette } from "./palette";
import { renderEditor } from "./render";
import { cellAtPoint, fitZoom, onIsland, type Cell } from "./view";

// Sheets the island's own edge needs, on top of the library's.
const COAST_FILES: Record<keyof CoastSheets, string> = {
  sea: "sea",
  sparkle: "seaSparkle",
  shore: "shore",
  shore2: "shore2",
  cliff: "cliff",
  lip: "lip",
  lipCorner: "cliffTop",
  fence: "fence",
};

function main(): void {
  const canvas = document.getElementById("island-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const sidebar = document.getElementById("sidebar") as HTMLElement;

  const sheetIds = Object.keys(SHEETS) as SheetId[];
  const loader = new SheetLoader(sheetIds.length + Object.keys(COAST_FILES).length);
  const book: SheetBook = {};
  for (const id of sheetIds) book[id] = loader.load(sheetUrl(id));
  const coastUrl = (name: string): string => `${import.meta.env.BASE_URL}sunnyside/${name}.png`;
  const coast = Object.fromEntries(
    Object.entries(COAST_FILES).map(([key, file]) => [key, loader.load(coastUrl(file))]),
  ) as unknown as CoastSheets;

  let island: Island = emptyIsland();
  // The manifest always has grass; starting with it in hand means the first
  // click paints rather than doing nothing.
  const GRASS = groundById("grass")!;
  let holding: Asset | null = GRASS;
  let erasing = false;
  let grid = true;
  let hover: Cell | null = null;
  let painting = false;
  let paintErasing = false;
  let animT = 0;

  createMenu("Island Editor", {
    onAllGames: () => {
      location.href = "index.html";
    },
  });

  // Arrived from the game's own Edit button: open the island being played.
  if (wantsStashedMap(location.search)) {
    const text = recallIsland();
    try {
      if (text !== null) island = decodeIsland(text);
    } catch (e) {
      alert(e instanceof Error ? e.message : "That island could not be opened.");
    }
  }

  const mayReplace = (): boolean =>
    isEmpty(island) || confirm("This replaces the island you have built. Save it first if you want to keep it.");

  const palette = buildPalette(
    sidebar,
    book,
    {
      onPick: (asset) => {
        holding = asset;
        erasing = false;
      },
      onErase: () => {
        erasing = true;
      },
      onGrid: (on) => {
        grid = on;
      },
      onPlay: () => {
        if (!stashIsland(encodeIsland(island))) {
          alert("This browser will not let the editor pass an island to the game. Save it and open it in the game instead.");
          return;
        }
        location.href = PLAY_STASHED_ISLAND_URL;
      },
      onSave: () => downloadText(islandFilename(new Date()), encodeIsland(island)),
      onOpen: () => {
        void (async () => {
          if (!mayReplace()) return;
          const text = await pickTextFile();
          if (text === null) return;
          try {
            island = decodeIsland(text);
          } catch (e) {
            alert(e instanceof Error ? e.message : "That island could not be opened.");
          }
        })();
      },
      onClear: () => {
        if (!mayReplace()) return;
        island = emptyIsland();
      },
    },
    GRASS,
  );

  const zoomNow = (): number => fitZoom(canvas.clientWidth, canvas.clientHeight);

  const applyAt = (cell: Cell, rubbing: boolean): void => {
    if (!onIsland(cell)) return;
    if (rubbing) {
      // Things first: rubbing out a tree standing on painted ground should take
      // the tree, not the grass under it.
      if (!erase(island, cell.col, cell.row)) paint(island, cell.col, cell.row, null);
      return;
    }
    if (!holding) return;
    if (isProp(holding)) {
      place(island, holding, cell.col, cell.row);
      return;
    }
    paint(island, cell.col, cell.row, holding.id);
  };

  const cellFrom = (e: MouseEvent): Cell => {
    const rect = canvas.getBoundingClientRect();
    return cellAtPoint(e.clientX - rect.left, e.clientY - rect.top, canvas.clientWidth, canvas.clientHeight, zoomNow());
  };

  canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const cell = cellFrom(e);
    hover = cell;
    paintErasing = erasing || e.button === 2;
    painting = true;
    applyAt(cell, paintErasing);
  });

  canvas.addEventListener("mousemove", (e) => {
    hover = cellFrom(e);
    // Dragging paints ground, but never scatters things: a held house would
    // otherwise stamp a row of them across the island.
    if (painting && (paintErasing || (holding !== null && !isProp(holding)))) applyAt(hover, paintErasing);
  });

  const stop = (): void => {
    painting = false;
  };
  window.addEventListener("mouseup", stop);
  canvas.addEventListener("mouseleave", () => {
    hover = null;
    stop();
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  window.addEventListener("keydown", (e) => {
    if (e.key !== "e" && e.key !== "E") return;
    erasing = !erasing;
    palette.syncErasing(erasing);
  });

  // Swatches are cut from the sheets, so they come up blank until those load.
  let swatchesDrawn = false;

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
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderEditor(ctx, book, coast, { island, holding, hover, erasing, grid, animT }, w, h, fitZoom(w, h));
  };

  new Loop(step).start();
}

main();
