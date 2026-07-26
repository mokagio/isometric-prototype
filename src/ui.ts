export interface MenuActions {
  onNewWorld: () => void;
  onEditor: () => void;
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
  addItem("New World", actions.onNewWorld);
  addItem("Map Editor", actions.onEditor);

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
