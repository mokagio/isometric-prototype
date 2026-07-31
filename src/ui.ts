import { fullscreenActive, fullscreenLabel, fullscreenSupported, toggleFullscreen } from "./fullscreen";

// Every entry is optional, and the menu shows only the ones a game hands it:
// Whispering Woods has no worlds to generate or maps to load.
export interface MenuActions {
  onNewWorld?: () => void;
  onEditor?: () => void;
  /** Pick a saved map file and play it. */
  onLoadMap?: () => void;
  /** Open the editor on the map being played. */
  onEditMap?: () => void;
  /** true = "lurk" (enemies wake only in their area); false = "hunt" (always chase). */
  onEnemyMode?: (lurk: boolean) => void;
  /** true = draw entity bounding boxes. */
  onDebug?: (on: boolean) => void;
  /** Draw the island's own shape, rather than what stands on it. */
  onOutline?: () => void;
  /** Leave the game for the list of games. */
  onAllGames?: () => void;
}

const LURK_KEY = "ww:lurk"; // remembered across reloads

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

const TOGGLE_STYLE = `
  .ww-mode-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; cursor: pointer; }
  .ww-mode-label { font-size: 15px; color: #8a6f52; }
  .ww-mode-label.active { color: #f4e4c1; }
  .ww-switch { position: relative; flex: 0 0 auto; width: 44px; height: 26px; border-radius: 13px; background: #6b4f34; transition: background 0.15s; }
  .ww-switch.on { background: #56a03a; }
  .ww-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #f4e4c1; transition: transform 0.15s; }
  .ww-switch.on .ww-knob { transform: translateX(18px); }
`;

function injectToggleStyle(): void {
  if (document.getElementById("ww-toggle-style")) return;
  const style = document.createElement("style");
  style.id = "ww-toggle-style";
  style.textContent = TOGGLE_STYLE;
  document.head.appendChild(style);
}

/** Top-right menu button and its drop panel, titled after the game showing it. */
export function createMenu(title: string, actions: MenuActions): void {
  const wrap = document.createElement("div");
  wrap.className = "ww-menu";

  const OPEN_ICON = "✕";
  const CLOSED_ICON = "☰";

  const button = document.createElement("button");
  button.className = "ww-menu-btn";
  button.setAttribute("aria-label", "Menu");
  button.textContent = CLOSED_ICON;

  const panel = document.createElement("div");
  panel.className = "ww-menu-panel";
  panel.hidden = true;

  const heading = document.createElement("div");
  heading.className = "ww-menu-title";
  heading.textContent = title;
  panel.appendChild(heading);

  const setOpen = (open: boolean): void => {
    panel.hidden = !open;
    button.textContent = open ? OPEN_ICON : CLOSED_ICON;
  };

  const addItem = (label: string, onClick: () => void): HTMLButtonElement => {
    const item = document.createElement("button");
    item.className = "ww-menu-item";
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
    sw.className = "ww-switch";
    sw.setAttribute("role", "switch");
    sw.appendChild(Object.assign(document.createElement("span"), { className: "ww-knob" }));
    const set = (v: boolean): void => {
      sw.classList.toggle("on", v);
      sw.setAttribute("aria-checked", String(v));
    };
    set(on);
    return { sw, set };
  };

  // Hunt/Lurk: a two-name toggle, remembered across reloads.
  const addModeToggle = (onEnemyMode: (lurk: boolean) => void): void => {
    injectToggleStyle();
    const row = document.createElement("div");
    row.className = "ww-menu-item ww-mode-row";
    const hunt = Object.assign(document.createElement("span"), { className: "ww-mode-label", textContent: "Hunt" });
    const lurk = Object.assign(document.createElement("span"), { className: "ww-mode-label", textContent: "Lurk" });

    let on = loadBool(LURK_KEY, false); // off = Hunt, on = Lurk
    const { sw, set } = buildSwitch(on);
    const reflect = (): void => {
      set(on);
      hunt.classList.toggle("active", !on);
      lurk.classList.toggle("active", on);
    };
    reflect();
    onEnemyMode(on); // apply the remembered preference at startup

    row.addEventListener("click", () => {
      on = !on;
      saveBool(LURK_KEY, on);
      reflect();
      onEnemyMode(on);
    });
    row.append(hunt, sw, lurk);
    panel.appendChild(row);
  };

  // A single-label on/off toggle (off by default).
  const addToggle = (label: string, onChange: (on: boolean) => void): void => {
    injectToggleStyle();
    const row = document.createElement("div");
    row.className = "ww-menu-item ww-mode-row";
    const text = Object.assign(document.createElement("span"), { className: "ww-mode-label active", textContent: label });
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

  if (actions.onNewWorld) addItem("New Random World", actions.onNewWorld);
  if (actions.onLoadMap) addItem("Load Map…", actions.onLoadMap);
  if (actions.onEditMap) addItem("Edit Map", actions.onEditMap);
  if (actions.onEditor) addItem("World Editor", actions.onEditor);
  if (actions.onOutline) addItem("Island Outline", actions.onOutline);
  if (actions.onEnemyMode) addModeToggle(actions.onEnemyMode);
  if (actions.onDebug) addToggle("Debug boxes", actions.onDebug);
  // Not a MenuActions entry: it asks nothing of the game, and any page with a
  // menu wants it. Absent where the browser has no API to offer.
  if (fullscreenSupported(document)) {
    const item = addItem(fullscreenLabel(false), () => toggleFullscreen(document));
    // Esc, the swipe, and the browser's own control all leave fullscreen
    // without going through the item, so follow the document rather than a flag.
    document.addEventListener("fullscreenchange", () => {
      item.textContent = fullscreenLabel(fullscreenActive(document));
    });
  }
  // Last: leaving the game sits well clear of the thumb reaching for New World.
  if (actions.onAllGames) addItem("All Games", actions.onAllGames);

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
