// The drawing surface: sizes a canvas to fill the window at device-pixel
// density, and exposes the CSS-pixel size the game draws in. Kept separate from
// the game so a second game reuses the fit-and-transform boilerplate as-is.

export interface Size {
  width: number;
  height: number;
}

/** Backing-store pixel size for a CSS size at a device-pixel ratio. */
export function backingSize(cssW: number, cssH: number, dpr: number): Size {
  return { width: Math.round(cssW * dpr), height: Math.round(cssH * dpr) };
}

// `win` is injectable so the fit logic can be exercised without a real window.
type WindowLike = Pick<Window, "innerWidth" | "innerHeight" | "devicePixelRatio">;

export class Viewport {
  width = 0; // CSS pixels
  height = 0;
  dpr = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly win: WindowLike = window,
  ) {}

  /** Resize the canvas to the window if it changed; returns true when it did. */
  fit(): boolean {
    const w = this.win.innerWidth;
    const h = this.win.innerHeight;
    if (w === this.width && h === this.height) return false;
    this.width = w;
    this.height = h;
    this.dpr = this.win.devicePixelRatio || 1;
    const px = backingSize(w, h, this.dpr);
    this.canvas.width = px.width;
    this.canvas.height = px.height;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    return true;
  }

  /** Reset the context so one game (CSS) pixel maps to `dpr` device pixels. */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
}
