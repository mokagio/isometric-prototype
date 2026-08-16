import { MAX_LIVES } from "./lives";

export interface Tally {
  /** Dungeons cleared this run. */
  dungeons: number;
  /** Monsters defeated this run. */
  kills: number;
}

export interface Hud {
  setLives: (lives: number) => void;
  setTally: (tally: Tally) => void;
  showCleared: (dungeons: number) => void;
  hideCleared: () => void;
  showGameOver: (tally: Tally) => void;
  hideGameOver: () => void;
}

const HEART = "❤️";

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The hearts row, the two tallies, the cleared banner, and the game-over sign. */
export function createHud(onRestart: () => void): Hud {
  const bar = document.createElement("div");
  bar.className = "ad-bar";

  const hearts = document.createElement("div");
  hearts.className = "ad-hearts";
  hearts.setAttribute("role", "status");
  // Spent hearts are greyed rather than removed, so the row keeps its width and
  // the count stays readable at a glance.
  const pips = Array.from({ length: MAX_LIVES }, () => {
    const pip = document.createElement("span");
    pip.textContent = HEART;
    hearts.appendChild(pip);
    return pip;
  });

  const counts = document.createElement("div");
  counts.className = "ad-score";
  bar.append(hearts, counts);

  /** Both signs are the same panel; only the wording differs. */
  const sign = (
    className: string,
    title: string,
    button: string | null,
  ): { root: HTMLElement; detail: HTMLElement } => {
    const root = document.createElement("div");
    root.className = `ad-sign ${className}`;
    root.hidden = true;

    const panel = document.createElement("div");
    panel.className = "ad-sign-panel";

    const heading = document.createElement("div");
    heading.className = "ad-sign-title";
    heading.textContent = title;

    const detail = document.createElement("div");
    detail.className = "ad-sign-detail";

    panel.append(heading, detail);
    if (button) {
      const action = document.createElement("button");
      action.className = "ad-btn ad-sign-btn";
      action.textContent = button;
      action.addEventListener("click", onRestart);
      panel.appendChild(action);
    }
    root.appendChild(panel);
    document.body.appendChild(root);
    return { root, detail };
  };

  const cleared = sign("ad-cleared", "Dungeon Cleared!", null);
  const over = sign("ad-gameover", "Game Over", "Try Again");

  document.body.append(bar);

  return {
    setLives: (lives) => {
      pips.forEach((pip, i) => pip.classList.toggle("ad-heart-lost", i >= lives));
      hearts.setAttribute("aria-label", `${lives} of ${MAX_LIVES} lives left`);
    },
    setTally: ({ dungeons, kills }) => {
      counts.textContent = `🗝 ${dungeons}   💀 ${kills}`;
      counts.setAttribute("aria-label", `${plural(dungeons, "dungeon", "dungeons")} cleared, ${kills} defeated`);
    },
    showCleared: (dungeons) => {
      cleared.detail.textContent = `${plural(dungeons, "dungeon", "dungeons")} down. Here comes another.`;
      cleared.root.hidden = false;
    },
    hideCleared: () => {
      cleared.root.hidden = true;
    },
    showGameOver: ({ dungeons, kills }) => {
      over.detail.textContent = `${plural(dungeons, "dungeon", "dungeons")} cleared, ${plural(kills, "monster", "monsters")} defeated`;
      over.root.hidden = false;
    },
    hideGameOver: () => {
      over.root.hidden = true;
    },
  };
}
