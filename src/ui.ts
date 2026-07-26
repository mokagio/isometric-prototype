export interface MenuActions {
  onNewWorld: () => void;
}

/** Top-right menu button and its drop panel. */
export function createMenu(actions: MenuActions): void {
  const wrap = document.createElement("div");
  wrap.className = "ww-menu";

  const button = document.createElement("button");
  button.className = "ww-menu-btn";
  button.setAttribute("aria-label", "Menu");
  button.textContent = "☰"; // ☰

  const panel = document.createElement("div");
  panel.className = "ww-menu-panel";
  panel.hidden = true;

  const title = document.createElement("div");
  title.className = "ww-menu-title";
  title.textContent = "Whispering Woods";
  panel.appendChild(title);

  const newWorld = document.createElement("button");
  newWorld.className = "ww-menu-item";
  newWorld.textContent = "New World";
  newWorld.addEventListener("click", () => {
    actions.onNewWorld();
    panel.hidden = true;
  });
  panel.appendChild(newWorld);

  const toggle = (): void => {
    panel.hidden = !panel.hidden;
  };
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });
  // Clicks outside the panel close it; clicks inside keep it open.
  panel.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => {
    panel.hidden = true;
  });

  wrap.append(button, panel);
  document.body.appendChild(wrap);
}
