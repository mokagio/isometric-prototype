import { HALF_H, HALF_W, TILE } from "./tileset";
// Whole-tile pixel zoom. Keeps the 48px art chunky and readable.
export const ZOOM = 2;
const DRAW = TILE * ZOOM;
const STEP_X = HALF_W * ZOOM;
const STEP_Y = HALF_H * ZOOM;
/** Tiles needed each side of centre to cover a viewport of the given size. */
export function gridSizeFor(viewW, viewH) {
    // Vertical is the tighter constraint (half-height is half the half-width),
    // and a diamond field leaves triangular gaps at the rect corners, so pad.
    const span = Math.ceil(Math.max(viewW / STEP_X, viewH / STEP_Y)) + 6;
    return { cols: span, rows: span };
}
export function render(ctx, tileset, world, viewW, viewH) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, viewW, viewH);
    // Place the map's centre tile at the viewport centre.
    const cCol = world.cols / 2;
    const cRow = world.rows / 2;
    const originX = viewW / 2 - (cCol - cRow) * STEP_X;
    const originY = viewH / 2 - (cCol + cRow) * STEP_Y;
    // Back-to-front: iterating row-major, col-minor is the painter's order for an
    // iso grid, so each block's skirt is overdrawn by the tile in front of it.
    for (let row = 0; row < world.rows; row++) {
        for (let col = 0; col < world.cols; col++) {
            const apexX = originX + (col - row) * STEP_X;
            const apexY = originY + (col + row) * STEP_Y;
            const drawX = apexX - STEP_X; // sprite is DRAW wide; apex sits at its mid-x
            const drawY = apexY;
            if (drawX > viewW || drawX + DRAW < 0 || drawY > viewH || drawY + DRAW < 0) {
                continue;
            }
            const [sx, sy, sw, sh] = tileset.rect(...world.at(col, row));
            ctx.drawImage(tileset.image, sx, sy, sw, sh, drawX, drawY, DRAW, DRAW);
        }
    }
}
