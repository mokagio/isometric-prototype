import { loadTileset } from "./tileset";
import { generateWorld } from "./world";
import { gridSizeFor, originFor, render } from "./renderer";
import { createMenu } from "./ui";
import tilesheetUrl from "../isometric_fantasy_tiles.png";

async function main(): Promise<void> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const tileset = await loadTileset(tilesheetUrl);

  let seed = Math.floor(Math.random() * 1_000_000);

  function draw(): void {
    const dpr = window.devicePixelRatio || 1;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { cols, rows } = gridSizeFor(viewW, viewH);
    const world = generateWorld(cols, rows, seed);
    const origin = originFor(world, viewW, viewH);
    render(ctx, tileset, world, origin, viewW, viewH);
  }

  draw();
  window.addEventListener("resize", draw);

  createMenu({
    onNewWorld: () => {
      seed = Math.floor(Math.random() * 1_000_000);
      draw();
    },
  });
}

void main();
