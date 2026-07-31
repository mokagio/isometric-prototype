import { downloadText, pickTextFile } from "../../files";
import { PLAY_DRAWN_OUTLINE_URL, recallOutline, stashOutline } from "../../handoff";
import { Loop } from "../../loop";
import { SheetLoader, type Sheet } from "../../sprites";
import { createMenu } from "../../ui";
import { FIELD, FIELD_PX, TILE } from "../field";
import { DEEP_SEA, drawCoastTile, drawIslandGround, fencePosts, type CoastSheets } from "../ground";
import {
  decodeOutline,
  draw,
  encodeOutline,
  floodable,
  grownOutline,
  outlineFilename,
  type Outline,
} from "../outline";
import { setOutline } from "../shape";
import { cameraFor, cellAtPoint, fitZoom, islandOrigin, onIsland, type Cell } from "../editor/view";

// Drawing the island's shape, rather than what stands on it. The coast is the
// hardest thing here to get right by describing it, so this hands over the pen:
// paint land and sea, watch the shore tiles fall into place, and save the result
// to a file that can be read — and pasted into the source when a drawn island
// becomes the built-in one.

const url = (name: string): string => `${import.meta.env.BASE_URL}sunnyside/${name}`;

const COAST_FILES: Record<keyof CoastSheets, string> = {
  sea: "sea.png",
  sparkle: "seaSparkle.png",
  shore: "shore.png",
  shore2: "shore2.png",
  cliff: "cliff.png",
  lip: "lip.png",
  lipCorner: "cliffTop.png",
  fence: "fence.png",
};

const GRID_LINE = "rgba(255, 255, 255, 0.16)";
const HOVER_LAND = "rgba(99, 199, 77, 0.5)";
const HOVER_SEA = "rgba(0, 153, 219, 0.55)";
const HOVER_NO = "rgba(255, 90, 90, 0.45)";

function main(): void {
  const canvas = document.getElementById("outline-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;

  const loader = new SheetLoader(Object.keys(COAST_FILES).length + 1);
  const coast = Object.fromEntries(
    Object.entries(COAST_FILES).map(([key, file]) => [key, loader.load(url(file))]),
  ) as unknown as CoastSheets;
  const grass: Sheet = loader.load(url("grass.png"));

  // Whatever was last handed over, so the editor picks up where the game left off.
  const stashed = recallOutline();
  let outline: Outline = grownOutline();
  if (stashed !== null) {
    try {
      outline = decodeOutline(stashed);
    } catch {
      // A stale or damaged stash is not worth an alert on the way in.
    }
  }

  let painting: boolean | null = null; // what the drag is laying down
  let brush = true; // land, until told otherwise
  let grid = true;
  let hover: Cell | null = null;
  let animT = 0;

  const sidebar = document.getElementById("sidebar") as HTMLElement;
  const brushes = buildSidebar(sidebar, {
    onBrush: (land) => {
      brush = land;
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
  });

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

  const paintAt = (cell: Cell, land: boolean): void => {
    if (!onIsland(cell)) return;
    draw(outline, cell.col, cell.row, land);
  };

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    const cell = cellAtPoint(e.offsetX, e.offsetY, canvas.width, canvas.height, zoom());
    // The right button lays down the other brush, so a slip is undone in place.
    painting = e.button === 2 ? !brush : brush;
    paintAt(cell, painting);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    hover = cellAtPoint(e.offsetX, e.offsetY, canvas.width, canvas.height, zoom());
    if (painting !== null) paintAt(hover, painting);
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

  const zoom = (): number => fitZoom(canvas.width, canvas.height);

  const step = (dt: number): void => {
    animT += dt;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      brushes.refresh();
    }
    // Everything that draws the coast reads `isLand`, so handing it the outline
    // being drawn is what makes the editor show the island it is describing.
    setOutline(outline);
    render(w, h);
  };

  function render(w: number, h: number): void {
    const z = zoom();
    ctx.fillStyle = DEEP_SEA;
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    const view = { camera: cameraFor(w, h, z), zoom: z, width: w, height: h, animT };
    drawIslandGround(ctx, coast, view, (col, row, at) => {
      if (!grass.ok) return;
      const frame = (col * 7 + row * 13) % 4;
      ctx.drawImage(grass.img, frame * TILE, 0, TILE, TILE, Math.round(at.x), Math.round(at.y), TILE * z, TILE * z);
    });
    for (const post of fencePosts(view)) {
      if (coast.fence.ok) drawCoastTile(ctx, coast.fence.img, post.tile, post.at, z, post.flipV);
    }

    const origin = islandOrigin(w, h, z);
    if (grid) {
      ctx.strokeStyle = GRID_LINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= FIELD; i++) {
        const at = i * TILE * z;
        ctx.moveTo(origin.x + at + 0.5, origin.y);
        ctx.lineTo(origin.x + at + 0.5, origin.y + FIELD_PX * z);
        ctx.moveTo(origin.x, origin.y + at + 0.5);
        ctx.lineTo(origin.x + FIELD_PX * z, origin.y + at + 0.5);
      }
      ctx.stroke();
    }

    if (hover && onIsland(hover)) {
      const refused = !brush && !floodable(hover.col, hover.row);
      ctx.fillStyle = refused ? HOVER_NO : brush ? HOVER_LAND : HOVER_SEA;
      ctx.fillRect(
        origin.x + hover.col * TILE * z,
        origin.y + hover.row * TILE * z,
        TILE * z,
        TILE * z,
      );
    }
  }

  new Loop(step).start();
}

interface SidebarActions {
  onBrush: (land: boolean) => void;
  onGrid: (on: boolean) => void;
  onSave: () => void;
  onOpen: () => void;
  onPlay: () => void;
  onReset: () => void;
}

/** Two brushes and the file buttons — the island editor's sidebar, cut down. */
function buildSidebar(root: HTMLElement, actions: SidebarActions): { refresh: () => void } {
  root.innerHTML = "";

  const links = document.createElement("div");
  links.className = "ed-links";
  for (const [href, text] of [
    ["woods.html", "← Woods"],
    ["woodsEditor.html", "Island editor →"],
  ]) {
    const a = document.createElement("a");
    a.className = "ed-back";
    a.href = href!;
    a.textContent = text!;
    links.appendChild(a);
  }
  root.appendChild(links);

  const heading = (text: string): void => {
    const h = document.createElement("div");
    h.className = "ed-heading";
    h.textContent = text;
    root.appendChild(h);
  };

  heading("Brush");
  const grid = document.createElement("div");
  grid.className = "ed-palette";
  const swatches: HTMLButtonElement[] = [];
  const addBrush = (label: string, className: string, land: boolean): void => {
    const b = document.createElement("button");
    b.className = "ed-swatch";
    const face = document.createElement("div");
    face.className = `ed-brush ${className}`;
    face.textContent = label;
    b.appendChild(face);
    b.addEventListener("click", () => {
      actions.onBrush(land);
      swatches.forEach((el) => el.classList.remove("selected"));
      b.classList.add("selected");
    });
    if (land) b.classList.add("selected");
    swatches.push(b);
    grid.appendChild(b);
  };
  addBrush("Land", "ed-brush-land", true);
  addBrush("Sea", "ed-brush-sea", false);
  root.appendChild(grid);

  heading("Outline");
  const buttons = document.createElement("div");
  buttons.className = "ed-map";
  const button = (label: string, onClick: () => void, className = "ed-action"): void => {
    const b = document.createElement("button");
    b.className = className;
    b.textContent = label;
    b.addEventListener("click", onClick);
    buttons.appendChild(b);
  };
  button("▶ Try it out", actions.onPlay, "ed-action ed-action-go");
  button("Save outline", actions.onSave);
  button("Open outline…", actions.onOpen);
  button("Start over", actions.onReset);
  root.appendChild(buttons);

  const gridRow = document.createElement("button");
  gridRow.className = "ed-tool active";
  gridRow.textContent = "Grid";
  let on = true;
  gridRow.addEventListener("click", () => {
    on = !on;
    gridRow.classList.toggle("active", on);
    actions.onGrid(on);
  });
  root.appendChild(gridRow);

  const hint = document.createElement("div");
  hint.className = "ed-hint";
  hint.textContent =
    "Drag to draw the shore. Right-click lays the other brush. The fenced square stays land — that is where the game is played.";
  root.appendChild(hint);

  return { refresh: () => undefined };
}

main();
