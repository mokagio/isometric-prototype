export interface Tally {
  /** With a `target`, reads `3 / 6`: a count of something being collected toward it. */
  set(count: number, target?: number): void;
}

/**
 * A corner count of what has been picked up — logs in Whispering Woods, gems in
 * Peaceful Plains. Shows a zero from the start rather than appearing on the first
 * pickup, so it is obvious there is something to collect. Where it sits is the
 * page's, in its own `<style>`; the look is shared through `chrome.css`.
 */
export function createTally(iconUrl: string, alt: string): Tally {
  const wrap = document.createElement("div");
  wrap.className = "ww-tally";

  const icon = document.createElement("img");
  icon.className = "ww-tally-icon";
  icon.src = iconUrl;
  icon.alt = alt;

  const count = document.createElement("span");
  count.className = "ww-tally-count";
  count.textContent = "0";

  wrap.append(icon, count);
  document.body.appendChild(wrap);
  return {
    set: (n, target) => {
      count.textContent = target === undefined ? String(n) : `${n} / ${target}`;
    },
  };
}
