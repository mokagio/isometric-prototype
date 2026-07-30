export interface ActionButton {
  /** Greyed out and unpressable when there is nothing to act on. */
  setEnabled(on: boolean): void;
}

/**
 * The single button under the right thumb, mirroring the stick. Reuses the menu
 * button's look, and starts disabled: there is nothing to chop until you are
 * standing next to a tree.
 */
export function createActionButton(onPress: () => void): ActionButton {
  const button = document.createElement("button");
  button.className = "ww-menu-btn ww-action";
  button.setAttribute("aria-label", "Chop");
  button.textContent = "🪓";
  button.disabled = true;

  // pointerdown fires on touch without the click delay.
  button.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!button.disabled) onPress();
  });

  document.body.appendChild(button);
  return {
    setEnabled: (on) => {
      button.disabled = !on;
    },
  };
}
