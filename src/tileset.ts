// Geometry of `isometric_fantasy_tiles.png`: a 12x17 grid of 48x48 cells.
// Each cell holds one iso block whose top surface is a 48x24 diamond (2:1),
// apex flush to the cell top, so tops tessellate on a 24x12 half-step.
export const TILE = 48;
export const HALF_W = TILE / 2; // 24 — horizontal half-step between neighbours
export const HALF_H = TILE / 4; // 12 — vertical half-step between neighbours

export interface Tileset {
  image: HTMLImageElement;
  /** Source rect in the sheet for tile at sheet column/row. */
  rect(col: number, row: number): [sx: number, sy: number, sw: number, sh: number];
}

export function loadTileset(src: string): Promise<Tileset> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        image,
        rect: (col, row) => [col * TILE, row * TILE, TILE, TILE],
      });
    image.onerror = () => reject(new Error(`Failed to load tileset: ${src}`));
    image.src = src;
  });
}
