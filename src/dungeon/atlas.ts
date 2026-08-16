import { assetUrl, loadSheet, type Sheet } from "./assets";
import { TILES, type TileName } from "./tiles";

export type { TileName };

export interface Atlas {
  sheet: Sheet;
  /** Settles once the sheet has loaded, or failed to. */
  ready: Promise<void>;
  /** Blit one named tile with its top-left at `(x, y)`, scaled by `zoom`. */
  draw(ctx: CanvasRenderingContext2D, name: TileName, x: number, y: number, zoom: number): void;
  size(name: TileName): { w: number; h: number };
  /** One tile on its own canvas, for showing sheet art outside the game canvas. */
  toCanvas(name: TileName, zoom: number): HTMLCanvasElement;
}

export function createAtlas(url = assetUrl("dungeon/tiles.png")): Atlas {
  let settle!: () => void;
  const ready = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const sheet = loadSheet(url, settle);
  return {
    sheet,
    ready,
    draw(ctx, name, x, y, zoom) {
      if (!sheet.ok) return;
      const [sx, sy, w, h] = TILES[name];
      ctx.drawImage(sheet.img, sx, sy, w, h, x, y, w * zoom, h * zoom);
    },
    size(name) {
      const [, , w, h] = TILES[name];
      return { w, h };
    },
    toCanvas(name, zoom) {
      const [, , w, h] = TILES[name];
      const canvas = document.createElement("canvas");
      canvas.width = w * zoom;
      canvas.height = h * zoom;
      const g = canvas.getContext("2d")!;
      g.imageSmoothingEnabled = false;
      this.draw(g, name, 0, 0, zoom);
      return canvas;
    },
  };
}
