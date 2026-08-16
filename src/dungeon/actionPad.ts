/**
 * Bottom-right attack button, sitting where the stick's knob sits under the
 * other thumb. `icon` is the sword off the sheet, so the button carries the
 * same blade the hero swings.
 */
export function createActionPad(onAttack: () => void, icon: HTMLCanvasElement): void {
  const attack = document.createElement("button");
  attack.className = "ad-btn ad-pad";
  attack.setAttribute("aria-label", "Attack");
  icon.className = "ad-pad-icon";
  attack.appendChild(icon);
  // pointerdown fires on touch without the click delay.
  attack.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onAttack();
  });

  document.body.appendChild(attack);
}
