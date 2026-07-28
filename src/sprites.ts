// Shared spritesheet plumbing: the load-and-settle readiness machine, the
// frame-timing math, and the feet-anchored blit. Each skin and the monster field
// supplies its own sheet geometry and composes these.

export interface Sheet {
  img: HTMLImageElement;
  ok: boolean;
}

// Loads a fixed batch of sheets and turns `ready` on once every one has settled —
// loaded or 404'd. Callers hold the returned `Sheet`s and read each `.ok`.
export class SheetLoader {
  private settled = 0;
  ready = false;

  constructor(private readonly total: number) {}

  load(src: string, crossOrigin?: string): Sheet {
    const sheet: Sheet = { img: new Image(), ok: false };
    // Set before `src` so it governs the fetch, and handlers before `src` so
    // nothing settles until the load actually resolves.
    if (crossOrigin) sheet.img.crossOrigin = crossOrigin;
    sheet.img.onload = () => this.settle(sheet, true);
    sheet.img.onerror = () => this.settle(sheet, false);
    sheet.img.src = src;
    return sheet;
  }

  private settle(sheet: Sheet, ok: boolean): void {
    sheet.ok = ok;
    if (++this.settled === this.total) this.ready = true;
  }
}

/** Frame index `t` seconds into an animation at `fps`: loops, or holds the last frame. */
export function frameAt(t: number, fps: number, frames: number, loop: boolean): number {
  const raw = Math.floor(t * fps);
  return loop ? raw % frames : Math.min(raw, frames - 1);
}

export interface Blit {
  cell: number; // source cell is square: cell x cell, taken from row 0
  scale: number;
  anchorX: number; // the point inside the cell that lands on (feetX, feetY)
  anchorY: number;
  frame: number;
  flip?: boolean; // mirror horizontally around feetX, for a left-facing sprite
  alpha?: number;
}

/** Draw one frame of a single-row strip at nearest-neighbour, anchored on the feet. */
export function blitFrame(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  feetX: number,
  feetY: number,
  b: Blit,
): void {
  const dx = Math.round(feetX - b.anchorX * b.scale);
  const dy = Math.round(feetY - b.anchorY * b.scale);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (b.alpha !== undefined) ctx.globalAlpha = Math.max(0, b.alpha);
  if (b.flip) {
    ctx.translate(feetX, 0);
    ctx.scale(-1, 1);
    ctx.translate(-feetX, 0);
  }
  ctx.drawImage(img, b.frame * b.cell, 0, b.cell, b.cell, dx, dy, b.cell * b.scale, b.cell * b.scale);
  ctx.restore();
}
