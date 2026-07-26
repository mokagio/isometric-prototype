const KEYS = {
  up: "ArrowUp",
  left: "ArrowLeft",
  down: "ArrowDown",
  right: "ArrowRight",
} as const;

type Dir = keyof typeof KEYS;

/** Bottom-left arrow pad, driving the game through synthetic key events. */
export function createDpad(target: Window = window): void {
  const wrap = document.createElement("div");
  wrap.className = "ww-dpad";

  const send = (type: "keydown" | "keyup", key: string): void => {
    target.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
  };

  const makeButton = (dir: Dir, glyph: string, area: string): HTMLButtonElement => {
    const btn = document.createElement("button");
    btn.className = "ww-menu-btn ww-dpad-btn";
    btn.style.gridArea = area;
    btn.textContent = glyph;
    btn.setAttribute("aria-label", dir);

    let held = false;
    const press = (e: PointerEvent): void => {
      e.preventDefault();
      if (held) return;
      held = true;
      btn.setPointerCapture(e.pointerId);
      send("keydown", KEYS[dir]);
    };
    const release = (): void => {
      if (!held) return;
      held = false;
      send("keyup", KEYS[dir]);
    };

    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    // A pointer that leaves without capture (mouse drag off the button) still ends the press.
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
    return btn;
  };

  wrap.append(
    makeButton("up", "▲", "up"),
    makeButton("left", "◀", "left"),
    makeButton("down", "▼", "down"),
    makeButton("right", "▶", "right"),
  );
  document.body.appendChild(wrap);
}
