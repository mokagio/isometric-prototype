import { MAX_LIVES } from "./lives";

export interface Hud {
  setLives: (lives: number) => void;
  showGameOver: () => void;
  hideGameOver: () => void;
}

const HEART = "❤️";

/** The hearts row and the game-over sign. */
export function createHud(onRestart: () => void): Hud {
  const hearts = document.createElement("div");
  hearts.className = "ww-hearts";
  hearts.setAttribute("role", "status");
  // Spent hearts are greyed rather than removed, so the row keeps its width and
  // the count stays readable at a glance.
  const pips = Array.from({ length: MAX_LIVES }, () => {
    const pip = document.createElement("span");
    pip.textContent = HEART;
    hearts.appendChild(pip);
    return pip;
  });

  const sign = document.createElement("div");
  sign.className = "ww-gameover";
  sign.hidden = true;

  const panel = document.createElement("div");
  panel.className = "ww-gameover-panel";

  const title = document.createElement("div");
  title.className = "ww-gameover-title";
  title.textContent = "Game Over";

  const restart = document.createElement("button");
  restart.className = "ww-menu-btn ww-gameover-btn";
  restart.textContent = "Restart";
  restart.addEventListener("click", onRestart);

  panel.append(title, restart);
  sign.appendChild(panel);
  document.body.append(hearts, sign);

  return {
    setLives: (lives) => {
      pips.forEach((pip, i) => pip.classList.toggle("ww-heart-lost", i >= lives));
      hearts.setAttribute("aria-label", `${lives} of ${MAX_LIVES} lives left`);
    },
    showGameOver: () => {
      sign.hidden = false;
    },
    hideGameOver: () => {
      sign.hidden = true;
    },
  };
}
