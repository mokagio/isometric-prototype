import type { PanDir } from "./view";

const REPEAT_MS = 110; // how fast a held arrow keeps panning

const ARROWS: { dir: PanDir; glyph: string; cell: string }[] = [
  { dir: "up", glyph: "▲", cell: "up" },
  { dir: "left", glyph: "◀", cell: "left" },
  { dir: "right", glyph: "▶", cell: "right" },
  { dir: "down", glyph: "▼", cell: "down" },
];

/** A four-way pad over the board. Press pans once; holding keeps panning. */
export function createPanPad(root: HTMLElement, onPan: (dir: PanDir) => void): void {
  const pad = document.createElement("div");
  pad.className = "ed-pan";

  for (const { dir, glyph, cell } of ARROWS) {
    const b = document.createElement("button");
    b.className = `ed-pan-btn ed-pan-${cell}`;
    b.textContent = glyph;
    b.title = `Pan ${dir}`;

    let timer: number | undefined;
    const stop = (): void => {
      clearInterval(timer);
      timer = undefined;
    };
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onPan(dir);
      stop();
      timer = window.setInterval(() => onPan(dir), REPEAT_MS);
    });
    // Losing the pointer anywhere has to stop the repeat, or it pans forever.
    for (const end of ["pointerup", "pointercancel", "pointerleave"]) b.addEventListener(end, stop);
    window.addEventListener("blur", stop);

    pad.appendChild(b);
  }
  root.appendChild(pad);
}
