import { project, type Origin } from "./iso";

// Debug bounding boxes. The offsets match the default oboropixel skins — the
// soldier hero and the slime monster — tracking each figure's visible bounds
// within its 96px frame, from the feet anchor, at draw SCALE 3.
export interface Box {
  dx: number;
  dy: number;
  w: number;
  h: number;
}

export const HERO_BOX: Box = { dx: -45, dy: -57, w: 63, h: 63 };
export const MONSTER_BOX: Box = { dx: -27, dy: -36, w: 48, h: 36 };

/** Stroke a box (and a feet dot) at the entity's feet point. */
export function drawBox(
  ctx: CanvasRenderingContext2D,
  feetX: number,
  feetY: number,
  box: Box,
  color: string,
): void {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.strokeRect(Math.round(feetX + box.dx) + 0.5, Math.round(feetY + box.dy) + 0.5, box.w, box.h);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(feetX, feetY, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Ring a radius around a point — a reach, rather than a bounding box. */
export function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Outline the (2*half+1) square of cells centred on (col, row) — the lurk area. */
export function drawArea(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  half: number,
  origin: Origin,
  color: string,
): void {
  const h = half + 0.5; // cell edges, so the square wraps the whole 5x5 block
  const corners = [
    project(col - h, row - h, 0, origin),
    project(col + h, row - h, 0, origin),
    project(col + h, row + h, 0, origin),
    project(col - h, row + h, 0, origin),
  ];
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(corners[0]!.x, corners[0]!.y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i]!.x, corners[i]!.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}
