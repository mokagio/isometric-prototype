import { createGame, stepGame, TICK, type Game } from "./game";
import { createHud } from "./hud";
import { createInput } from "./input";
import { PICKS, type PickId } from "./picks";
import { createRenderer, type Renderer } from "./render";

/** Longest catch-up a single frame may simulate, so a stall cannot spiral. */
const MAX_FRAME = 0.25;

/** What runs behind the opening card until somebody picks for themselves. */
const BACKDROP_PICK: PickId = "hook";

const stage = document.querySelector<HTMLCanvasElement>("#stage");
const overlay = document.querySelector<HTMLElement>("#hud");
const controls = document.querySelector<HTMLElement>("#controls");
const pads = document.querySelector<HTMLElement>("#pads");
if (!stage || !overlay || !controls || !pads) {
  throw new Error("the page is missing #stage, #hud, #controls or #pads");
}
const canvas = stage;
const padRow = pads;
const hudRoot = overlay;

const input = createInput(canvas);
const hud = createHud(hudRoot, controls, pick);

for (const pad of padRow.querySelectorAll<HTMLElement>(".pad")) {
  const action = pad.dataset["pad"];
  if (action === "fly" || action === "shoot") input.bindPad(pad, action);
}

let game: Game = createGame(randomSeed(), PICKS[BACKDROP_PICK].ability, PICKS[BACKDROP_PICK].mode);
let renderer: Renderer = createRenderer(canvas, game.level);
// Nothing is chosen yet, so the game opens on its own card rather than under
// it — and nobody loses a heart while they are still reading.
let picked: PickId | null = null;
let paused = true;
hud.showCard("start", null);

window.addEventListener("resize", () => renderer.resize());

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffff);
}

function rebuild(next: PickId): void {
  const { mode, ability } = PICKS[next];
  renderer.dispose();
  game = createGame(randomSeed(), ability, mode);
  renderer = createRenderer(canvas, game.level);
  renderer.resize();
  const joyride = mode === "joyride";
  padRow.classList.toggle("is-hidden", !joyride);
  hudRoot.classList.toggle("is-joyride", joyride);
}

/**
 * The picker is the same control on the way in and from the pause card, so
 * choosing always means "a fresh run of this". On the way in, what was behind
 * the card was only ever a backdrop, so there is nothing to lose.
 */
function pick(next: PickId): void {
  picked = next;
  rebuild(next);
  setPaused(false);
}

function setPaused(next: boolean): void {
  paused = next;
  if (paused) hud.showCard(picked ? "paused" : "start", picked);
  else hud.hideCard();
}

let previous = performance.now();
let accumulator = 0;

function frame(now: number): void {
  const dt = Math.min((now - previous) / 1000, MAX_FRAME);
  previous = now;

  const aim = renderer.pointerToWorld(input.pointer.x, input.pointer.y);
  input.state.aimX = aim.x;
  input.state.aimY = aim.y;

  if (input.takeRestart() && picked) rebuild(picked);
  // Escape toggles; while the pause card is up, anything else takes it down
  // too. Before a pick there is nothing to carry on with, so only the buttons
  // start the game.
  const anyPress = input.takeAnyPress();
  if (input.takePause() && picked) setPaused(!paused);
  else if (paused && anyPress && picked) setPaused(false);

  if (paused) {
    accumulator = 0;
    input.endFrame();
  } else {
    accumulator += dt;
    while (accumulator >= TICK) {
      accumulator -= TICK;
      stepGame(game, input.state, TICK);
      input.endFrame();
    }
  }

  renderer.render(game, dt);
  hud.update(game);
  hud.setPointer(input.pointer.x, input.pointer.y);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
