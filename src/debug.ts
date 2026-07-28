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
