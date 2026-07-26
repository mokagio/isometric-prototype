export interface ActionPadHandlers {
  onAttack: () => void;
  /** Held, not pulsed: the hero re-launches on landing while the button is down. */
  onJumpChange: (held: boolean) => void;
}

// Bottom-right action buttons, mirroring the stick's footprint under the other
// thumb. Reuses the menu button's look (.ww-menu-btn); the diagonal placement
// lives in the stylesheet.
export function createActionPad({ onAttack, onJumpChange }: ActionPadHandlers): void {
  const pad = document.createElement("div");
  pad.className = "ww-pad";

  const button = (label: string, className: string): HTMLButtonElement => {
    const el = document.createElement("button");
    el.className = `ww-menu-btn ww-pad-btn ${className}`;
    el.setAttribute("aria-label", label);
    pad.appendChild(el);
    return el;
  };

  const attack = button("Attack", "ww-pad-attack");
  // pointerdown fires on touch without the click delay.
  attack.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onAttack();
  });

  const jump = button("Jump", "ww-pad-jump");
  jump.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    // Capture so a thumb that slides off the button still releases the jump.
    jump.setPointerCapture(e.pointerId);
    onJumpChange(true);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    jump.addEventListener(type, () => onJumpChange(false));
  }

  document.body.appendChild(pad);
}
