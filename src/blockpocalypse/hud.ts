import type { Game } from "./game";
import { isPick, type PickId } from "./picks";
import { JET_FUEL, MAX_HEALTH } from "./player";

/** What the instruction card is doing: opening the game, or interrupting it. */
export type CardMode = "start" | "paused";

/** Below this fraction of a tank the gauge starts asking to be looked at. */
export const FUEL_LOW = 0.28;

export interface Hud {
  update(game: Game): void;
  setPointer(x: number, y: number): void;
  showCard(mode: CardMode, pick: PickId | null): void;
  hideCard(): void;
}

/**
 * The overlay: hearts, tank, tallies, banner, crosshair and the card.
 * Everything here is DOM, and nothing here decides anything — it only reads
 * the game and does as the loop says.
 */
export function createHud(
  root: HTMLElement,
  card: HTMLElement,
  onPick: (pick: PickId) => void,
): Hud {
  const corner = element(root, "hud-corner");
  const hearts = element(corner, "hud-hearts");
  const pips = Array.from({ length: MAX_HEALTH }, () => element(hearts, "hud-pip"));
  const tank = element(corner, "hud-tank");
  const tankFill = element(tank, "hud-tank-fill");
  const stats = element(corner, "hud-stats");
  const first = element(stats, "hud-stat");
  const distance = element(stats, "hud-stat");
  const banner = element(root, "hud-banner");
  const crosshair = element(root, "hud-crosshair");

  const dismiss = card.querySelector<HTMLElement>(".dismiss");
  const gearLabel = card.querySelector<HTMLElement>(".gear-label");
  const gearKeys = [...card.querySelectorAll<HTMLElement>(".gear-keys")];
  const buttons = [...card.querySelectorAll<HTMLButtonElement>(".picker button")];

  for (const button of buttons) {
    const pick = button.dataset["pick"];
    if (pick && isPick(pick)) button.addEventListener("click", () => onPick(pick));
  }

  let shownHealth = -1;
  let shownFirst = "";
  let shownDistance = -1;
  let shownBanner = "";

  return {
    update(game) {
      const player = game.player;
      const joyride = player.mode === "joyride";

      if (player.health !== shownHealth) {
        if (player.health < shownHealth) {
          hearts.classList.remove("is-hit");
          // Reading a layout property is what restarts a CSS animation that is
          // already on the element; without it a second hit plays nothing.
          void hearts.offsetWidth;
          hearts.classList.add("is-hit");
        }
        shownHealth = player.health;
        pips.forEach((pip, index) => pip.classList.toggle("is-spent", index >= shownHealth));
      }

      // The joyride's jetpack never runs out, so it has no gauge to read.
      const fuel = player.fuel / JET_FUEL;
      tank.classList.toggle("is-shown", player.ability === "jetpack" && !joyride);
      tankFill.style.width = `${fuel * 100}%`;
      tankFill.classList.toggle("is-low", fuel <= FUEL_LOW);
      tankFill.classList.toggle("is-empty", player.fuel <= 0);

      const count = joyride ? game.coins : game.kills;
      const label = joyride ? "coins" : "down";
      if (`${count}${label}` !== shownFirst) {
        shownFirst = `${count}${label}`;
        write(first, String(count), label);
        first.classList.toggle("is-gold", joyride);
      }
      const metres = Math.max(0, Math.round(player.body.x - game.level.spawnX));
      if (metres !== shownDistance) {
        shownDistance = metres;
        write(distance, String(metres), "m");
      }

      const message =
        game.status === "won"
          ? joyride
            ? "MADE IT"
            : "EXTRACTED"
          : game.status === "over"
            ? "DOWN — press R to fly again"
            : game.status === "dead"
              ? "BACK TO THE BEACON"
              : "";
      if (message !== shownBanner) {
        shownBanner = message;
        banner.textContent = message;
        banner.classList.toggle("is-shown", message !== "");
        banner.classList.toggle("is-won", game.status === "won");
      }
    },
    setPointer(x, y) {
      crosshair.style.transform = `translate(${x}px, ${y}px)`;
    },
    showCard(mode, pick) {
      card.classList.remove("is-hidden");
      root.classList.add("is-card-up");
      // Only the game in play is worth reading about; on the way in, none is
      // chosen yet and the buttons carry the explanation instead.
      for (const list of gearKeys) {
        list.classList.toggle("is-shown", list.dataset["pick"] === pick);
      }
      for (const button of buttons) {
        button.classList.toggle("is-current", button.dataset["pick"] === pick);
      }
      if (gearLabel) {
        gearLabel.textContent = mode === "start" ? "Pick your game" : "Start again with";
      }
      if (dismiss) {
        dismiss.textContent =
          mode === "start" ? "pick one to start" : "Esc to carry on where you left off";
      }
    },
    hideCard() {
      card.classList.add("is-hidden");
      root.classList.remove("is-card-up");
    },
  };
}

/** A bright number and a dim unit, so the eye lands on the number. */
function write(node: HTMLElement, value: string, unit: string): void {
  node.textContent = "";
  const number = document.createElement("b");
  number.textContent = value;
  const label = document.createElement("span");
  label.textContent = unit;
  node.append(number, label);
}

function element(root: HTMLElement, className: string): HTMLElement {
  const node = document.createElement("div");
  node.className = className;
  root.appendChild(node);
  return node;
}
