import { Input } from "../input";
import { Loop } from "../loop";
import { blitFrame, frameAt, SheetLoader } from "../sprites";
import { createStick } from "../stick";
import { Viewport } from "../viewport";
import { facingFrom, walk, type Facing, type Pos } from "./walker";

// Sunnyside sheet contract: horizontal strips of 96x64 frames, played at 12 fps,
// drawn in one facing only — so left is right mirrored.
//
// The figure is a mere 11x16 of that frame and stands at y=39, not on the bottom
// edge the pack's own origin (48, 64) claims. Anchoring on 64 hangs it a sprite's
// height above its shadow. Re-measure with
// `magick walk.png -crop 96x64+0+0 +repage -format %@ info:` if a sheet is redone.
const CELL_W = 96;
const CELL_H = 64;
const ANCHOR_X = 48;
const ANCHOR_Y = 39;
const FPS = 12;
const WALK_FRAMES = 8;
const IDLE_FRAMES = 9;
const SHADOW_CELL = 16;

const FIGURE_H = 16; // the drawn figure, feet to hat
const ZOOM = 4;
const GRASS = "#4ba54f";
// The feet are the position, so walking to the top edge needs the figure's own
// height in hand or the head leaves the canvas. The other three only need enough
// for its width.
const EDGE = 24;

const url = (name: string): string => `${import.meta.env.BASE_URL}sunnyside/${name}`;

function main(): void {
  const canvas = document.getElementById("woods") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const viewport = new Viewport(canvas);

  const sheets = new SheetLoader(3);
  const walkSheet = sheets.load(url("walk.png"));
  const idleSheet = sheets.load(url("idle.png"));
  const shadowSheet = sheets.load(url("shadow.png"));

  const input = new Input();
  createStick(input);

  let pos: Pos = { x: 0, y: 0 }; // placed on the first frame, once the canvas has a size
  let placed = false;
  let facing: Facing = "right";
  let walkT = 0; // reset on stopping, so every step starts from a standstill
  let idleT = 0; // never reset — the idle breath keeps going

  const step = (dt: number): void => {
    viewport.fit();
    viewport.applyTransform(ctx);
    const bounds = {
      minX: EDGE,
      maxX: viewport.width - EDGE,
      minY: FIGURE_H * ZOOM,
      maxY: viewport.height - EDGE,
    };
    if (!placed) {
      pos = { x: viewport.width / 2, y: viewport.height / 2 };
      placed = true;
    }

    const axis = input.axis;
    const moving = axis.dc !== 0 || axis.dr !== 0;
    const next = walk(pos, axis, dt, bounds);
    facing = facingFrom(next.x - pos.x, facing);
    pos = next;
    walkT = moving ? walkT + dt : 0;
    idleT += dt;

    ctx.fillStyle = GRASS;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    if (shadowSheet.ok) {
      blitFrame(ctx, shadowSheet.img, pos.x, pos.y, {
        cell: SHADOW_CELL,
        scale: ZOOM,
        anchorX: SHADOW_CELL / 2,
        anchorY: SHADOW_CELL / 2,
        frame: 0,
      });
    }

    const sheet = moving ? walkSheet : idleSheet;
    const frames = moving ? WALK_FRAMES : IDLE_FRAMES;
    if (sheet.ok) {
      blitFrame(ctx, sheet.img, pos.x, pos.y, {
        cell: CELL_W,
        cellH: CELL_H,
        scale: ZOOM,
        anchorX: ANCHOR_X,
        anchorY: ANCHOR_Y,
        frame: frameAt(moving ? walkT : idleT, FPS, frames, true),
        flip: facing === "left",
      });
    }
  };

  new Loop(step).start();
}

main();
