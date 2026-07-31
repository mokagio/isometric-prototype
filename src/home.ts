import tilesheetUrl from "../isometric_fantasy_tiles.png";
import { BACKDROPS, backdropById, drawBackdrop, type Backdrop } from "./backdrop";
import { GAMES } from "./games";
import { loadTileset } from "./tileset";
import { Viewport } from "./viewport";

/** One button per game, built from `GAMES` so adding a game is a one-line change. */
function buildList(list: HTMLElement): void {
  for (const game of GAMES) {
    const item = document.createElement("li");
    const play = document.createElement("a");
    play.className = "ww-play";
    play.href = game.href;
    play.textContent = game.name;
    item.appendChild(play);
    list.appendChild(item);
  }
}

/**
 * Temporary: a way to look at every ground and say which one the page keeps.
 * The whole thing — button, query and all — comes out once one is chosen.
 */
function buildBackdropPicker(chosen: Backdrop, onPick: (backdrop: Backdrop) => void): void {
  let at = BACKDROPS.indexOf(chosen);
  const button = document.createElement("button");
  button.className = "ww-bg-pick";
  const label = (): void => {
    const backdrop = BACKDROPS[at]!;
    button.textContent = `${at + 1}/${BACKDROPS.length} ${backdrop.id}`;
  };
  button.addEventListener("click", () => {
    at = (at + 1) % BACKDROPS.length;
    const backdrop = BACKDROPS[at]!;
    label();
    // In the address bar too, so a favourite can be sent to somebody or reloaded.
    history.replaceState(null, "", `?bg=${backdrop.id}`);
    onPick(backdrop);
  });
  label();
  document.body.appendChild(button);
}

async function main(): Promise<void> {
  buildList(document.getElementById("games")!);

  const canvas = document.getElementById("backdrop") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const viewport = new Viewport(canvas);
  const tileset = await loadTileset(tilesheetUrl);

  let backdrop = backdropById(new URLSearchParams(location.search).get("bg"));
  const paint = (force = false): void => {
    // `fit` is false when nothing resized, which is also when there is nothing
    // to redraw — unless the ground itself just changed.
    if (!viewport.fit() && !force) return;
    viewport.applyTransform(ctx); // resizing the canvas drops the transform
    drawBackdrop(ctx, tileset, viewport.width, viewport.height, backdrop);
  };
  paint(true);
  window.addEventListener("resize", () => paint());

  buildBackdropPicker(backdrop, (picked) => {
    backdrop = picked;
    paint(true);
  });
}

void main();
