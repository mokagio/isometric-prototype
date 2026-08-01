import { MAX_LIVES } from "./lives";

export interface Hud {
  setLives: (lives: number) => void;
  showLevel: (level: number) => void;
  showGameOver: () => void;
  hideGameOver: () => void;
}

const HEART = "❤️";
/** Seconds the level banner holds before it fades itself out. */
const BANNER_HOLD = 1.6;

/** The hearts row, the level banner and the game-over sign. */
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

  const banner = document.createElement("div");
  banner.className = "ww-level";
  banner.setAttribute("role", "status");
  let fade: ReturnType<typeof setTimeout> | undefined;

  panel.append(title, restart);
  sign.appendChild(panel);
  document.body.append(hearts, banner, sign);

  return {
    setLives: (lives) => {
      pips.forEach((pip, i) => pip.classList.toggle("ww-heart-lost", i >= lives));
      hearts.setAttribute("aria-label", `${lives} of ${MAX_LIVES} lives left`);
    },
    showLevel: (level) => {
      banner.textContent = `Level ${level}`;
      // Restarted rather than left to run, or levelling twice in quick succession
      // would have the second banner cut short by the first one's timer.
      clearTimeout(fade);
      banner.classList.add("ww-level-up");
      fade = setTimeout(() => banner.classList.remove("ww-level-up"), BANNER_HOLD * 1000);
    },
    showGameOver: () => {
      sign.hidden = false;
    },
    hideGameOver: () => {
      sign.hidden = true;
    },
  };
}
