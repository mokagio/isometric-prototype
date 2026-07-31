// The compass of arrows over the corner of an editor's canvas. Any editor whose
// board is bigger than the screen wants one, so there is one of them.

export type PanDir = "up" | "down" | "left" | "right";

/** Which ways there is anything left to go. Absent reads as yes. */
export type PanRoom = Partial<Record<PanDir, boolean>>;

const REPEAT_MS = 110; // how fast a held arrow keeps panning

const ARROWS: { dir: PanDir; glyph: string }[] = [
  { dir: "up", glyph: "▲" },
  { dir: "left", glyph: "◀" },
  { dir: "right", glyph: "▶" },
  { dir: "down", glyph: "▼" },
];

export interface PanPadHandle {
  /** Grey out the arrows with nothing behind them, so the pad says where you are. */
  setRoom(room: PanRoom): void;
}

/** A four-way pad over the board. Press pans once; holding keeps panning. */
export function createPanPad(root: HTMLElement, onPan: (dir: PanDir) => void): PanPadHandle {
  const pad = document.createElement("div");
  pad.className = "ed-pan";
  const buttons = {} as Record<PanDir, HTMLButtonElement>;

  for (const { dir, glyph } of ARROWS) {
    const b = document.createElement("button");
    b.className = `ed-pan-btn ed-pan-${dir}`;
    b.textContent = glyph;
    b.title = `Pan ${dir}`;

    let timer: number | undefined;
    const stop = (): void => {
      clearInterval(timer);
      timer = undefined;
    };
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (b.disabled) return;
      onPan(dir);
      stop();
      timer = window.setInterval(() => {
        // A pan that reaches the edge disables its own arrow mid-hold.
        if (b.disabled) stop();
        else onPan(dir);
      }, REPEAT_MS);
    });
    // Losing the pointer anywhere has to stop the repeat, or it pans forever.
    for (const end of ["pointerup", "pointercancel", "pointerleave"]) b.addEventListener(end, stop);
    window.addEventListener("blur", stop);

    buttons[dir] = b;
    pad.appendChild(b);
  }
  root.appendChild(pad);

  return {
    setRoom(room: PanRoom): void {
      for (const { dir } of ARROWS) buttons[dir].disabled = room[dir] === false;
    },
  };
}
