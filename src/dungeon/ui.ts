import {
  fullscreenActive,
  fullscreenLabel,
  fullscreenSupported,
  toggleFullscreen,
} from "../fullscreen";
import type { SkinKind } from "./heroSkin";
// Everything the skin picker needs, parked with it below.
// import { HERO_SKIN, SKINS } from "./heroSkin";

export interface MenuActions {
  onNewDungeon: () => void;
  onEditor: () => void;
  onCredits: () => void;
  /** true = "lurk" (enemies wake only when you come close); false = "hunt" (always chase). */
  onEnemyMode: (lurk: boolean) => void;
  onHeroSkin: (kind: SkinKind) => void;
  /** true = draw entity bounding circles. */
  onDebug: (on: boolean) => void;
  /** Leave the game for the list of games. */
  onAllGames: () => void;
}

const LURK_KEY = "ad:lurk"; // remembered across reloads
// const SKIN_KEY = "ad:skin";

const loadBool = (key: string, fallback: boolean): boolean => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
};
const saveBool = (key: string, on: boolean): void => {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // storage unavailable (private mode / disabled) — the preference just won't stick
  }
};
// const loadString = (key: string): string | null => {
//   try {
//     return localStorage.getItem(key);
//   } catch {
//     return null;
//   }
// };
// const saveString = (key: string, value: string): void => {
//   try {
//     localStorage.setItem(key, value);
//   } catch {
//     // as above — the preference just won't stick
//   }
// };

/** Top-right menu button and its drop panel. */
export function createMenu(actions: MenuActions): void {
  const wrap = document.createElement("div");
  wrap.className = "ad-menu";

  const OPEN_ICON = "✕";
  const CLOSED_ICON = "☰";

  const button = document.createElement("button");
  button.className = "ad-btn";
  button.setAttribute("aria-label", "Menu");
  button.textContent = CLOSED_ICON;

  const panel = document.createElement("div");
  panel.className = "ad-menu-panel";
  panel.hidden = true;

  const title = document.createElement("div");
  title.className = "ad-menu-title";
  title.textContent = "Amelia's Dungeon";
  panel.appendChild(title);

  const setOpen = (open: boolean): void => {
    panel.hidden = !open;
    button.textContent = open ? OPEN_ICON : CLOSED_ICON;
  };

  const addItem = (label: string, onClick: () => void): HTMLButtonElement => {
    const item = document.createElement("button");
    item.className = "ad-menu-item";
    item.textContent = label;
    item.addEventListener("click", () => {
      onClick();
      setOpen(false);
    });
    panel.appendChild(item);
    return item;
  };
  const buildSwitch = (on: boolean): { sw: HTMLElement; set: (on: boolean) => void } => {
    const sw = document.createElement("span");
    sw.className = "ad-switch";
    sw.setAttribute("role", "switch");
    sw.appendChild(Object.assign(document.createElement("span"), { className: "ad-knob" }));
    const set = (v: boolean): void => {
      sw.classList.toggle("on", v);
      sw.setAttribute("aria-checked", String(v));
    };
    set(on);
    return { sw, set };
  };

  // Hunt/Lurk: a two-name toggle, remembered across reloads.
  const addModeToggle = (): void => {
    const row = document.createElement("div");
    row.className = "ad-menu-item ad-mode-row";
    const hunt = Object.assign(document.createElement("span"), { className: "ad-mode-label", textContent: "Hunt" });
    const lurk = Object.assign(document.createElement("span"), { className: "ad-mode-label", textContent: "Lurk" });

    let on = loadBool(LURK_KEY, false); // off = Hunt, on = Lurk
    const { sw, set } = buildSwitch(on);
    const reflect = (): void => {
      set(on);
      hunt.classList.toggle("active", !on);
      lurk.classList.toggle("active", on);
    };
    reflect();
    actions.onEnemyMode(on); // apply the remembered preference at startup

    row.addEventListener("click", () => {
      on = !on;
      saveBool(LURK_KEY, on);
      reflect();
      actions.onEnemyMode(on);
    });
    row.append(hunt, sw, lurk);
    panel.appendChild(row);
  };

  // A single-label on/off toggle (off by default).
  const addToggle = (label: string, onChange: (on: boolean) => void): void => {
    const row = document.createElement("div");
    row.className = "ad-menu-item ad-mode-row";
    const text = Object.assign(document.createElement("span"), {
      className: "ad-mode-label active",
      textContent: label,
    });
    let on = false;
    const { sw, set } = buildSwitch(on);
    row.addEventListener("click", () => {
      on = !on;
      set(on);
      onChange(on);
    });
    row.append(text, sw);
    panel.appendChild(row);
  };

  // Which Amelia. Every sheet is in the build, so this is a straight swap; more
  // than two of them, so it steps through the list rather than toggling.
  // const addSkinPicker = (): void => {
  //   const row = document.createElement("div");
  //   row.className = "ad-menu-item ad-mode-row";
  //   const label = Object.assign(document.createElement("span"), {
  //     className: "ad-mode-label active",
  //     textContent: "Amelia",
  //   });
  //   const value = Object.assign(document.createElement("span"), { className: "ad-mode-value" });
  //
  //   const saved = loadString(SKIN_KEY);
  //   let at = Math.max(
  //     0,
  //     SKINS.findIndex((s) => s.kind === (saved ?? HERO_SKIN)),
  //   );
  //   const reflect = (): void => {
  //     value.textContent = SKINS[at]!.label;
  //   };
  //   reflect();
  //   actions.onHeroSkin(SKINS[at]!.kind);
  //
  //   row.addEventListener("click", () => {
  //     at = (at + 1) % SKINS.length;
  //     saveString(SKIN_KEY, SKINS[at]!.kind);
  //     reflect();
  //     actions.onHeroSkin(SKINS[at]!.kind);
  //   });
  //   row.append(label, value);
  //   panel.appendChild(row);
  // };

  addItem("New Dungeon", actions.onNewDungeon);
  addItem("Dungeon Builder", actions.onEditor);
  // Amelia is the default skin until the picker goes back in; `main.ts` still
  // wires `onHeroSkin`, so restoring it is uncommenting the four blocks marked
  // above and this call.
  // addSkinPicker();
  addModeToggle();
  addToggle("Debug circles", actions.onDebug);
  addItem("Credits", actions.onCredits);
  // Not a MenuActions entry: it asks nothing of the game, and every page on the
  // playground with a menu wants it. Absent where the browser has no API.
  if (fullscreenSupported(document)) {
    const item = addItem(fullscreenLabel(false), () => toggleFullscreen(document));
    // Esc, the swipe, and the browser's own control all leave fullscreen
    // without going through the item, so follow the document rather than a flag.
    document.addEventListener("fullscreenchange", () => {
      item.textContent = fullscreenLabel(fullscreenActive(document));
    });
  }
  // Last: leaving the game sits well clear of the thumb reaching for New Dungeon.
  addItem("All Games", actions.onAllGames);

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(panel.hidden);
  });
  // Clicks outside the panel close it; clicks inside keep it open.
  panel.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => setOpen(false));

  wrap.append(button, panel);
  document.body.appendChild(wrap);
}
