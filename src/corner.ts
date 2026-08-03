/**
 * The top-left column both games keep their counts in — hearts, tallies, and
 * anything else that reads at a glance. One element rather than each overlay
 * pinning itself to the corner, so a row that grows moves the ones under it
 * instead of being overlapped. Order down the column is order of creation.
 */
export function corner(): HTMLElement {
  const found = document.querySelector<HTMLElement>(".ww-corner");
  if (found) return found;
  const stack = document.createElement("div");
  stack.className = "ww-corner";
  document.body.appendChild(stack);
  return stack;
}
