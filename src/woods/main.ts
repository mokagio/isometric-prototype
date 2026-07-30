import { drawBox, drawCircle, type Box } from "../debug";
import { Input } from "../input";
import { Loop } from "../loop";
import { blitFrame, frameAt, SheetLoader } from "../sprites";
import { createStick } from "../stick";
import { createMenu } from "../ui";
import { Viewport } from "../viewport";
import { createActionButton } from "./actionButton";
import {
  cellAt,
  FOAM_SECONDS,
  frameOf,
  isCliffFace,
  isLip,
  ringOf,
  seaTile,
  isWater,
  shoreTile,
  SPARKLE_FRAMES,
  SPARKLE_SECONDS,
  sparkleAt,
  type Tile as CoastTile,
} from "./coast";
import { createLogCounter } from "./logCounter";
import { Logs } from "./logs";
import {
  blockedByTree,
  cameraAt,
  fieldBounds,
  MIDDLE,
  screenAt,
  TILE,
  tileVariant,
  treeAt,
  TRUNK,
  visibleTiles,
} from "./field";
import { facingFrom, walk, type Facing, type Pos } from "./walker";
import { AXE_REACH, Chop, CHOP_FRAMES, Wood } from "./wood";

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
// The drawn figure within that frame, for the debug box.
const FIGURE_W = 11;
const FIGURE_H = 16;
const FPS = 12;
const WALK_FRAMES = 8;
const IDLE_FRAMES = 9;
const SHADOW_CELL = 16;

// The pack's tree: a 4-frame strip, standing on the middle of its bottom edge.
// The strip is a sway, but it only ever plays as a shudder when the tree is hit
// (`Wood.frame`) — a whole wood swaying on its own is a distraction.
const TREE_W = 32;
const TREE_H = 34;
const TREE_ANCHOR_X = 16;
const TREE_ANCHOR_Y = 32;
// A tree hangs two tiles above its base, so one just off screen still shows.
const TREE_PAD = 3;

// What is left after three chops: the pack's own cut stump, one 16px tile out of
// the tileset, standing on the bottom of its roots.
const STUMP_CELL = 16;
const STUMP_ANCHOR_X = 8;
const STUMP_ANCHOR_Y = 15;

// The log the demo project drops, lying on the point it landed on.
const LOG_CELL = 11;
const LOG_ANCHOR_X = 5.5;
const LOG_ANCHOR_Y = 10;

const ZOOM = 4;

// Debug boxes, in screen pixels from the point each thing stands on: the figure
// as it is drawn, and the strip of roots a trunk actually blocks.
const FIGURE_BOX: Box = {
  dx: (-FIGURE_W / 2) * ZOOM,
  dy: -FIGURE_H * ZOOM,
  w: FIGURE_W * ZOOM,
  h: FIGURE_H * ZOOM,
};
const TRUNK_BOX: Box = {
  dx: -TRUNK.halfW * ZOOM,
  dy: -TRUNK.top * ZOOM,
  w: 2 * TRUNK.halfW * ZOOM,
  h: (TRUNK.top + TRUNK.bottom) * ZOOM,
};
// Under the sea tiles, for the frame before they load and any sliver of a
// rounding gap: the pack's own deep water blue.
const DEEP_SEA = "#0099db";
// The bank's face out of `cliff.png`: its second row is the body of the wall, in
// three variants that are picked by column so the striations do not repeat.
const CLIFF_FACE_ROW = 1;
const CLIFF_FACE_COLS = 3;
// Half the figure's width, so it never stands half over the void.
const EDGE_INSET = 6;

const url = (name: string): string => `${import.meta.env.BASE_URL}sunnyside/${name}`;


function main(): void {
  const canvas = document.getElementById("woods") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const viewport = new Viewport(canvas);

  const sheets = new SheetLoader(14);
  const walkSheet = sheets.load(url("walk.png"));
  const idleSheet = sheets.load(url("idle.png"));
  const axeSheet = sheets.load(url("axe.png"));
  const shadowSheet = sheets.load(url("shadow.png"));
  const grassSheet = sheets.load(url("grass.png"));
  const treeSheet = sheets.load(url("tree.png"));
  const stumpSheet = sheets.load(url("stump.png"));
  const logSheet = sheets.load(url("log.png"));
  const seaSheet = sheets.load(url("sea.png"));
  const sparkleSheet = sheets.load(url("seaSparkle.png"));
  const shoreSheet = sheets.load(url("shore.png"));
  const shore2Sheet = sheets.load(url("shore2.png"));
  const cliffSheet = sheets.load(url("cliff.png"));
  const lipSheet = sheets.load(url("lip.png"));

  const input = new Input();
  createStick(input);

  const wood = new Wood();
  const chop = new Chop();
  const swingAxe = (): void => {
    const target = wood.inReach(pos);
    if (target) chop.start(target);
  };
  const action = createActionButton(swingAxe);
  const logs = new Logs();
  const counter = createLogCounter(url("log.png"));

  let debug = false;
  createMenu("Whispering Woods", {
    onDebug: (on) => {
      debug = on;
    },
    onAllGames: () => {
      location.href = "index.html";
    },
  });

  /** One 16px tile of a sheet, blown up to the drawing zoom. */
  const drawTile = (img: CanvasImageSource, src: CoastTile, at: Pos): void => {
    const size = TILE * ZOOM;
    ctx.drawImage(
      img,
      src.col * TILE,
      src.row * TILE,
      TILE,
      TILE,
      Math.round(at.x),
      Math.round(at.y),
      size,
      size,
    );
  };

  /** Sea, then the island on top of it: grass, the bank's face, and the surf. */
  const drawGround = (camera: Pos): void => {
    // Deliberately unclamped: the sea carries on past the field, which is the
    // whole point of an island.
    const minCol = Math.floor(camera.x / TILE);
    const minRow = Math.floor(camera.y / TILE);
    const maxCol = Math.floor((camera.x + viewport.width / ZOOM) / TILE);
    const maxRow = Math.floor((camera.y + viewport.height / ZOOM) / TILE);
    const surf = frameOf(animT, FOAM_SECONDS, 2) === 0 ? shoreSheet : shore2Sheet;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const at = screenAt(cellAt(col, row), camera, ZOOM);
        if (seaSheet.ok) drawTile(seaSheet.img, seaTile(col, row), at);
        const sparkle = sparkleSheet.ok ? sparkleAt(col, row) : null;
        if (sparkle) {
          const t = animT + sparkle.phase * SPARKLE_SECONDS * SPARKLE_FRAMES;
          drawTile(sparkleSheet.img, { col: frameOf(t, SPARKLE_SECONDS, SPARKLE_FRAMES), row: 0 }, at);
        }
        if (ringOf(col, row) < 0) continue; // out at sea

        // Grass everywhere on the island but the lip, which is its own ground.
        // Never on the coast ring: that is water, and the shore tiles go over it.
        const ownGround = isWater(col, row) || (isLip(col, row) && lipSheet.ok);
        if (grassSheet.ok && !ownGround) drawTile(grassSheet.img, { col: tileVariant(col, row), row: 0 }, at);
        if (isLip(col, row) && lipSheet.ok) drawTile(lipSheet.img, { col: 0, row: 0 }, at);
        // The face is a wall, so it is drawn over the grass rather than instead of
        // it: its own tiles are cut away at the top where the lip shows through.
        if (isCliffFace(col, row) && cliffSheet.ok) {
          drawTile(cliffSheet.img, { col: col % CLIFF_FACE_COLS, row: CLIFF_FACE_ROW }, at);
        }
        const shore = shoreTile(col, row);
        if (shore && surf.ok) drawTile(surf.img, shore, at);
      }
    }
  };

  const bounds = fieldBounds(EDGE_INSET);
  let pos: Pos = { ...MIDDLE };
  let facing: Facing = "right";
  let walkT = 0; // reset on stopping, so every step starts from a standstill
  let animT = 0; // never reset — the idle breath and the trees keep going
  // `Input.jump` is the spacebar, which is the action key here. Held is not
  // pressed: one swing per press, however long the key is down for.
  let actionHeld = false;

  const step = (dt: number): void => {
    viewport.fit();
    viewport.applyTransform(ctx);

    if (input.jump && !actionHeld) swingAxe();
    actionHeld = input.jump;

    // Mid-swing the character is planted: an axe animation that slides along the
    // ground reads as a bug.
    const swinging = chop.active;
    const axis = swinging ? { dc: 0, dr: 0 } : input.axis;
    const moving = axis.dc !== 0 || axis.dr !== 0;
    const next = walk(pos, axis, dt, bounds, blockedByTree);
    if (!swinging) facing = facingFrom(next.x - pos.x, facing);
    pos = next;
    walkT = moving ? walkT + dt : 0;
    animT += dt;

    if (chop.target) {
      // Face the tree being chopped, whichever way it was reached from.
      facing = chop.target.col * TILE + TILE / 2 < pos.x ? "left" : "right";
    }
    if (chop.update(dt) && chop.target) {
      const { col, row } = chop.target;
      // The blow that fells it bursts its logs out of the stump.
      if (wood.hit(col, row)) logs.spawn({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
    }
    wood.update(dt);
    if (logs.update(dt, pos) > 0) counter.set(logs.collected);
    action.setEnabled(wood.inReach(pos) !== null);

    const camera = cameraAt(pos, viewport.width, viewport.height, ZOOM);
    ctx.fillStyle = DEEP_SEA;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.imageSmoothingEnabled = false;
    drawGround(camera);

    // Whatever stands lower on the field is drawn last, so a tree in front of
    // the character hides them and one behind does not.
    const standing: Array<{ y: number; draw: () => void }> = [];
    const trunks: Array<{ x: number; y: number }> = []; // screen points, for the debug boxes

    if (treeSheet.ok && stumpSheet.ok) {
      const range = visibleTiles(camera, viewport.width, viewport.height, ZOOM, TREE_PAD);
      for (let row = range.minRow; row <= range.maxRow; row++) {
        for (let col = range.minCol; col <= range.maxCol; col++) {
          if (!treeAt(col, row)) continue;
          // Standing on the middle of its cell, not the corner.
          const base = { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
          const at = screenAt(base, camera, ZOOM);
          const felled = wood.isStump(col, row);
          const frame = wood.frame(col, row);
          trunks.push(at);
          standing.push({
            y: base.y,
            draw: () =>
              blitFrame(ctx, felled ? stumpSheet.img : treeSheet.img, at.x, at.y, {
                cell: felled ? STUMP_CELL : TREE_W,
                cellH: felled ? STUMP_CELL : TREE_H,
                scale: ZOOM,
                anchorX: felled ? STUMP_ANCHOR_X : TREE_ANCHOR_X,
                anchorY: felled ? STUMP_ANCHOR_Y : TREE_ANCHOR_Y,
                frame: felled ? 0 : frame,
              }),
          });
        }
      }
    }

    if (logSheet.ok) {
      for (const log of logs.list()) {
        const at = screenAt({ x: log.x, y: log.y }, camera, ZOOM);
        standing.push({
          y: log.y,
          draw: () =>
            blitFrame(ctx, logSheet.img, at.x, at.y - log.z * ZOOM, {
              cell: LOG_CELL,
              scale: ZOOM,
              anchorX: LOG_ANCHOR_X,
              anchorY: LOG_ANCHOR_Y,
              frame: 0,
            }),
        });
      }
    }

    const feet = screenAt(pos, camera, ZOOM);
    const sheet = swinging ? axeSheet : moving ? walkSheet : idleSheet;
    const frames = swinging ? CHOP_FRAMES : moving ? WALK_FRAMES : IDLE_FRAMES;
    standing.push({
      y: pos.y,
      draw: () => {
        if (shadowSheet.ok) {
          blitFrame(ctx, shadowSheet.img, feet.x, feet.y, {
            cell: SHADOW_CELL,
            scale: ZOOM,
            anchorX: SHADOW_CELL / 2,
            anchorY: SHADOW_CELL / 2,
            frame: 0,
          });
        }
        if (sheet.ok) {
          blitFrame(ctx, sheet.img, feet.x, feet.y, {
            cell: CELL_W,
            cellH: CELL_H,
            scale: ZOOM,
            anchorX: ANCHOR_X,
            anchorY: ANCHOR_Y,
            frame: swinging ? chop.frame() : frameAt(moving ? walkT : animT, FPS, frames, true),
            flip: facing === "left",
          });
        }
      },
    });

    standing.sort((a, b) => a.y - b.y);
    for (const s of standing) s.draw();

    if (debug) {
      for (const trunk of trunks) drawBox(ctx, trunk.x, trunk.y, TRUNK_BOX, "#ff5a5a");
      // How far the axe carries: a trunk's base inside this ring is choppable.
      drawCircle(ctx, feet.x, feet.y, AXE_REACH * ZOOM, "#ffd24a");
      drawBox(ctx, feet.x, feet.y, FIGURE_BOX, "#7cff5a");
    }
  };

  new Loop(step).start();
}

main();
