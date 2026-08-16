import { CELL } from "./grid";

/** Ring of `cells` radius around a figure's feet, for eyeballing reach and footprint. */
export function drawRing(
  ctx: CanvasRenderingContext2D,
  feetX: number,
  feetY: number,
  cells: number,
  color: string,
): void {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(feetX, feetY, cells * CELL, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
