export interface LogCounter {
  set(count: number): void;
}

/**
 * Top-left tally of logs carried: the log itself, then the number. Shows a zero
 * from the start rather than appearing on the first pickup, so it is obvious
 * there is something to collect.
 */
export function createLogCounter(logUrl: string): LogCounter {
  const wrap = document.createElement("div");
  wrap.className = "ww-logs";

  const icon = document.createElement("img");
  icon.className = "ww-logs-icon";
  icon.src = logUrl;
  icon.alt = "Logs";

  const count = document.createElement("span");
  count.className = "ww-logs-count";
  count.textContent = "0";

  wrap.append(icon, count);
  document.body.appendChild(wrap);
  return {
    set: (n) => {
      count.textContent = String(n);
    },
  };
}
