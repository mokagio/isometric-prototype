export interface MenuActions {
  onNewWorld: () => void;
  onEditor: () => void;
  /** true = "lurk" (enemies wake only in their area); false = "hunt" (always chase). */
  onEnemyMode: (lurk: boolean) => void;
  /** true = draw entity bounding boxes. */
  onDebug: (on: boolean) => void;
}

const REPO_URL = "https://github.com/mokagio/isometric-prototype";
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

/** Top-right menu button and its drop panel. */
export function createMenu(actions: MenuActions): void {
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

  const title = document.createElement("div");
  title.className = "ww-menu-title";
  title.textContent = "Whispering Woods";
  panel.appendChild(title);

  const setOpen = (open: boolean): void => {
    panel.hidden = !open;
    button.textContent = open ? OPEN_ICON : CLOSED_ICON;
  };

  const addItem = (label: string, onClick: () => void): void => {
    const item = document.createElement("button");
    item.className = "ww-menu-item";
    item.textContent = label;
    item.addEventListener("click", () => {
      onClick();
      setOpen(false);
    });
    panel.appendChild(item);
  };
  const addLink = (label: string, href: string): void => {
    const item = document.createElement("a");
    item.className = "ww-menu-item";
    item.textContent = label;
    item.href = href;
    item.target = "_blank";
    item.rel = "noopener";
    item.addEventListener("click", () => setOpen(false));
    panel.appendChild(item);
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
  const addModeToggle = (): void => {
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

  addItem("New Random World", actions.onNewWorld);
  addItem("World Editor", actions.onEditor);
  addModeToggle();
  addToggle("Debug boxes", actions.onDebug);
  addLink("Credits", `${REPO_URL}/blob/main/CREDITS.md`);
  addLink("Source", REPO_URL);

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
