import tilesheetUrl from "../isometric_fantasy_tiles.png";
import { drawBackdrop } from "./backdrop";
import { GAMES } from "./games";
import { loadTileset } from "./tileset";
import { Viewport } from "./viewport";

/** One card per game, built from `GAMES` so adding a game is a one-line change. */
function buildList(list: HTMLElement): void {
  for (const game of GAMES) {
    const card = document.createElement("li");
    card.className = "ww-card";

    const name = document.createElement("h2");
    name.className = "ww-card-name";
    name.textContent = game.name;

    const blurb = document.createElement("p");
    blurb.className = "ww-card-blurb";
    blurb.textContent = game.blurb;

    const play = document.createElement("a");
    play.className = "ww-play";
    play.href = game.href;
    play.textContent = "▶ Play";

    card.append(name, blurb, play);
    list.appendChild(card);
  }
}

async function main(): Promise<void> {
  buildList(document.getElementById("games")!);

  const canvas = document.getElementById("backdrop") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const viewport = new Viewport(canvas);
  const tileset = await loadTileset(tilesheetUrl);

  const paint = (): void => {
    if (!viewport.fit()) return; // same size, same grass
    viewport.applyTransform(ctx); // resizing the canvas drops the transform
    drawBackdrop(ctx, tileset, viewport.width, viewport.height);
  };
  paint();
  window.addEventListener("resize", paint);
}

void main();
