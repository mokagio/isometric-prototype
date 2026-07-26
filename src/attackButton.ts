// Bottom-right attack button. Reuses the menu button's look (.ww-menu-btn);
// positioning is inline so it stays out of the shared stylesheet.
export function createAttackButton(onAttack: () => void): void {
  const wrap = document.createElement("div");
  wrap.style.position = "fixed";
  wrap.style.right = "var(--ww-inset)";
  // Centred on the stick's midline rather than sat on the same baseline, so the
  // two thumbs rest level.
  wrap.style.bottom = "calc(var(--ww-inset) + (var(--ww-stick) - var(--ww-btn)) / 2)";
  wrap.style.userSelect = "none";

  const button = document.createElement("button");
  button.className = "ww-menu-btn";
  button.setAttribute("aria-label", "Attack");
  button.textContent = "⚔";

  // pointerdown fires on touch without the click delay.
  button.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onAttack();
  });

  wrap.appendChild(button);
  document.body.appendChild(wrap);
}
