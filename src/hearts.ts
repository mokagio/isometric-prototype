// The row of hearts over a figure's head: how many blows it has left, in the same
// emoji the hero's own row uses. Sized in sheet pixels so it scales with whatever
// it is drawn over, and spent hearts are dimmed rather than dropped, so the row
// keeps its width and the count stays readable at a glance — as `game.html` does
// for the hero.

const HEART = "❤️";
export const HEART_SIZE = 11; // sheet pixels
export const HEART_GAP = 2;
export const HEART_SPENT_ALPHA = 0.28;

/** Lay a row of hearts, centred on `midX`, `left` of them still to be taken. */
export function drawHearts(
  ctx: CanvasRenderingContext2D,
  left: number,
  total: number,
  midX: number,
  baseY: number,
  scale: number,
  alphaScale = 1,
): void {
  const size = HEART_SIZE * scale;
  const step = size + HEART_GAP * scale;
  const start = midX - ((total - 1) * step) / 2;
  ctx.save();
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  for (let i = 0; i < total; i++) {
    ctx.globalAlpha = (i < left ? 1 : HEART_SPENT_ALPHA) * alphaScale;
    ctx.fillText(HEART, start + i * step, baseY);
  }
  ctx.restore();
}
