import { AIR, CONCRETE, isOpaqueBlock, isSolidBlock } from "./blocks";

/**
 * The city as a flat grid of blocks. Column 0 is the left edge of the level,
 * row 0 the bottom; `y` grows upwards, which is the opposite of a canvas but
 * the same as the 3D scene the renderer builds from it.
 */
export class World {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  /**
   * The wall a room is seen against, one layer behind the playable slab.
   * Nothing collides with it — it exists so a doorway is a way into somewhere
   * rather than a hole through to the skyline.
   */
  readonly back: Uint8Array;
  /**
   * Cell indices changed since somebody last drained them. The renderer
   * rebuilds only the chunks they fall in, rather than the whole city every
   * time a window breaks.
   */
  readonly dirty: number[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height);
    this.back = new Uint8Array(width * height);
  }

  /**
   * Outside the grid is air, except left of column 0: the level starts at a
   * wall so a player who backs up cannot walk out of the world.
   */
  get(x: number, y: number): number {
    if (x < 0) return CONCRETE;
    if (x >= this.width || y < 0 || y >= this.height) return AIR;
    return this.data[y * this.width + x] ?? AIR;
  }

  set(x: number, y: number, block: number): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const index = y * this.width + x;
    if (this.data[index] === block) return;
    this.data[index] = block;
    this.dirty.push(index);
  }

  isSolid(x: number, y: number): boolean {
    return isSolidBlock(this.get(x, y));
  }

  /** True where a face behind this cell would be hidden anyway. */
  isOpaque(x: number, y: number): boolean {
    if (x < 0) return true;
    return isOpaqueBlock(this.get(x, y));
  }

  getBack(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return AIR;
    return this.back[y * this.width + x] ?? AIR;
  }

  fillBack(x0: number, y0: number, x1: number, y1: number, block: number): void {
    for (let y = Math.max(0, Math.min(y0, y1)); y <= Math.max(y0, y1); y++) {
      for (let x = Math.max(0, Math.min(x0, x1)); x <= Math.max(x0, x1); x++) {
        if (x >= this.width || y >= this.height) continue;
        this.back[y * this.width + x] = block;
      }
    }
  }

  /** Fills a rectangle inclusive of both corners. */
  fill(x0: number, y0: number, x1: number, y1: number, block: number): void {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        this.set(x, y, block);
      }
    }
  }
}
