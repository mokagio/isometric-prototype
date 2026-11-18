import { GOD_PLACES, fitMap, headingOf } from "./compass";
import { PEAK } from "./hydra";
import { MAZE } from "./maze";
import { VOLCANO } from "./volcano";
import { CITY, HAMLETS, LIGHTHOUSE, OPEN, PIER_LENGTH, PIERS, SHORE_X } from "./world";
import { OLYMPUS } from "./zeus";

export interface MapHero {
  x: number;
  z: number;
  yaw: number;
}

const INK = "#4a3320";
const SERIF = 'Georgia, "Times New Roman", serif';
/** Zeus's colosseum stands at the foot of Olympus, so on a map this small their names go either side. */
const LABEL_SIDE: Record<string, "left" | "right"> = { zeus: "left", kronos: "right" };

/** The cartographer's map: the open land, the sea, every town and mountain, and where each god waits. */
export function drawWorldMap(ctx: CanvasRenderingContext2D, w: number, h: number, hero: MapHero | null, beaten: readonly string[]): void {
  const box = { x0: OPEN.x0, z0: OPEN.z0, x1: LIGHTHOUSE.x + 40, z1: OPEN.z1 };
  const pad = Math.max(28, Math.min(w, h) * 0.07);
  const fit = fitMap(box, w, h, pad);
  const at = fit.toScreen;
  const k = fit.scale;

  ctx.fillStyle = "#e9d6a8";
  ctx.fillRect(0, 0, w, h);

  // The land and the sea.
  const nw = at(OPEN.x0, OPEN.z0);
  const se = at(OPEN.x1, OPEN.z1);
  ctx.fillStyle = "#c9d49a";
  ctx.fillRect(nw.x, nw.y, se.x - nw.x, se.y - nw.y);
  ctx.fillStyle = "#8fbfd6";
  ctx.fillRect(se.x, nw.y, at(box.x1, 0).x - se.x, se.y - nw.y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(nw.x, nw.y, at(box.x1, 0).x - nw.x, se.y - nw.y);
  ctx.strokeStyle = "#7a5a3a";
  ctx.lineWidth = Math.max(1.5, k * 2.6);
  for (const z of PIERS) {
    const a = at(SHORE_X, z);
    const b = at(SHORE_X + PIER_LENGTH, z);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Mountains first, so towns and gods sit on top of them.
  mountain(ctx, at(VOLCANO.x, VOLCANO.z), VOLCANO.r * k, "#9a6a4a", "#f06a1e");
  mountain(ctx, at(OLYMPUS.x, OLYMPUS.z), OLYMPUS.r * k, "#b8b4ac", "#f4f2ec");
  mountain(ctx, at(PEAK.x, PEAK.z), PEAK.r * k, "#7f9a7a", "#cfe0c4");
  const maze = at(MAZE.x0, MAZE.z0);
  const span = MAZE.size * MAZE.cell * k;
  ctx.fillStyle = "#b8a27a";
  ctx.fillRect(maze.x, maze.y, span, span);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(maze.x, maze.y, span, span);

  // Towns.
  town(ctx, at(CITY.x, CITY.z), Math.max(7, CITY.r * k), "City");
  for (const hm of HAMLETS) town(ctx, at(hm.x, hm.z), Math.max(4, 12 * k), "");

  // The gods.
  const r = Math.max(9, Math.min(16, Math.min(w, h) * 0.022));
  for (const g of GOD_PLACES) {
    const p = at(g.x, g.z);
    const down = beaten.includes(g.id);
    ctx.globalAlpha = down ? 0.5 : 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = g.color;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    if (down) {
      ctx.beginPath();
      ctx.moveTo(p.x - r * 0.45, p.y);
      ctx.lineTo(p.x - r * 0.1, p.y + r * 0.4);
      ctx.lineTo(p.x + r * 0.5, p.y - r * 0.4);
      ctx.stroke();
    }
    const side = LABEL_SIDE[g.id];
    if (side) label(ctx, g.name, p.x + (side === "left" ? -1 : 1) * (r + 4), p.y, Math.max(12, r * 1.05), "middle", INK, side === "left" ? "right" : "left");
    else label(ctx, g.name, p.x, p.y + r + 4, Math.max(12, r * 1.05), "top");
    ctx.globalAlpha = 1;
  }

  if (hero) {
    const p = at(hero.x, hero.z);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(headingOf(hero.yaw));
    const s = r * 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.7, s * 0.8);
    ctx.lineTo(0, s * 0.4);
    ctx.lineTo(-s * 0.7, s * 0.8);
    ctx.closePath();
    ctx.fillStyle = "#fbf3df";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#8e1b16";
    ctx.stroke();
    ctx.restore();
    label(ctx, "You", p.x, p.y - r * 1.3, Math.max(12, r), "bottom", "#8e1b16");
  }

  // A north arrow in the corner of the land.
  const n = { x: nw.x + 26, y: nw.y + 34 };
  ctx.beginPath();
  ctx.moveTo(n.x, n.y - 16);
  ctx.lineTo(n.x + 7, n.y + 6);
  ctx.lineTo(n.x, n.y + 2);
  ctx.lineTo(n.x - 7, n.y + 6);
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
  label(ctx, "N", n.x, n.y + 9, 13, "top");
}

function mountain(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, r: number, side: string, top: string): void {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = side;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = top;
  ctx.fill();
}

function town(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, r: number, name: string): void {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#f4ead2";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = "#b3271f";
  ctx.fillRect(p.x - r * 0.35, p.y - r * 0.35, r * 0.7, r * 0.7);
  if (name) label(ctx, name, p.x, p.y + r + 3, 13, "top");
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  base: CanvasTextBaseline,
  color = INK,
  align: CanvasTextAlign = "center",
): void {
  ctx.font = `italic 700 ${Math.round(size)}px ${SERIF}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(251, 243, 223, 0.85)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
