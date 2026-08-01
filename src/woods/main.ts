import { drawBox, drawCircle, type Box } from "../debug";
import { EDIT_STASHED_ISLAND_URL, OUTLINE_URL, recallIsland, recallOutline, wantsStashedMap } from "../handoff";
import { Input } from "../input";
import { Loop } from "../loop";
import { blitFrame, frameAt, SheetLoader } from "../sprites";
import { drawGroundCell, drawProp, type SheetBook } from "../sunnyside/draw";
import { groundById, propById } from "../sunnyside/manifest";
import { SHEETS, sheetUrl, type SheetId } from "../sunnyside/sheets";
import { createStick } from "../stick";
import { createMenu } from "../ui";
import { Viewport } from "../viewport";
import { createActionButton } from "./actionButton";
import { cellAt, fenceTile } from "./coast";
import { createTally } from "../tally";
import { Logs } from "./logs";
import { DEEP_SEA, drawCoastTile, drawIslandGround, type CoastSheets, type OutlineSheets } from "./ground";
import { blockedOn, decodeIsland, drawOrder, playedGroundAt, type Island } from "./island";
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
import { decodeOutline, setDrawnOutline } from "./outline";
import { facingFrom, walk, type Facing, type Pos } from "./walker";
import { AXE_REACH, Chop, CHOP_FRAMES, Wood } from "./wood";
import { BOSS_CELL, BOSS_LOGS, BOSS_SCALE, BOSS_TRUNK, bossBase, BossTree } from "./bossTree";
import { TreantArt } from "../treant";

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
const BOSS_BOX: Box = {
  dx: -BOSS_TRUNK.halfW * ZOOM,
  dy: -BOSS_TRUNK.top * ZOOM,
  w: 2 * BOSS_TRUNK.halfW * ZOOM,
  h: (BOSS_TRUNK.top + BOSS_TRUNK.bottom) * ZOOM,
};
// Half the figure's width, so it never stands half over the void.
const EDGE_INSET = 6;
// The library's own tree, which is the one this game knows how to chop.
const TREE_PROP = "tree";

const url = (name: string): string => `${import.meta.env.BASE_URL}sunnyside/${name}`;

/**
 * The island the editor handed over, or null to grow a wood instead. Asked for
 * by the query, not by whether a stash happens to be lying around, so a reload
 * keeps you on the island and the plain game stays the plain game.
 */
function openStashedIsland(): Island | null {
  if (!wantsStashedMap(location.search)) return null;
  const text = recallIsland();
  if (text === null) return null;
  try {
    return decodeIsland(text);
  } catch (e) {
    alert(e instanceof Error ? e.message : "That island could not be opened.");
    return null;
  }
}

/**
 * The coastline someone drew, if there is one. Applied before anything draws:
 * an outline arriving late would be a frame of the wrong island.
 */
function applyDrawnOutline(): void {
  const text = recallOutline();
  if (text === null) return;
  try {
    setDrawnOutline(decodeOutline(text));
  } catch {
    // A stale outline is not worth stopping the game for: the grown one stands in.
  }
}

function main(): void {
  applyDrawnOutline();
  const canvas = document.getElementById("woods") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const viewport = new Viewport(canvas);

  // Arrived from the editor: play what was built instead of the grown wood.
  const island = openStashedIsland();
  // The library is only worth fetching for a built island; the grown wood draws
  // itself out of the handful of strips below.
  const libraryIds = island ? (Object.keys(SHEETS) as SheetId[]) : [];

  const sheets = new SheetLoader(20 + libraryIds.length);
  const walkSheet = sheets.load(url("walk.png"));
  const idleSheet = sheets.load(url("idle.png"));
  const axeSheet = sheets.load(url("axe.png"));
  const shadowSheet = sheets.load(url("shadow.png"));
  const grassSheet = sheets.load(url("grass.png"));
  const treeSheet = sheets.load(url("tree.png"));
  const stumpSheet = sheets.load(url("stump.png"));
  const logSheet = sheets.load(url("log.png"));
  const coast: CoastSheets & OutlineSheets = {
    sea: sheets.load(url("sea.png")),
    sparkle: sheets.load(url("seaSparkle.png")),
    shore: sheets.load(url("shore.png")),
    shore2: sheets.load(url("shore2.png")),
    cliff: sheets.load(url("cliff.png")),
    lip: sheets.load(url("lip.png")),
    lipCorner: sheets.load(url("cliffTop.png")),
    fence: sheets.load(url("fence.png")),
    // Only a drawn coastline lays these, but the wood cannot know before it has
    // read the outline whether one does.
    grassSand: sheets.load(url("grassSand.png")),
    grassEdge: sheets.load(url("grassEdge.png")),
    sandDeco: sheets.load(url("sandDeco.png")),
    sand: sheets.load(url("sand.png")),
  };
  const book: SheetBook = {};
  for (const id of libraryIds) book[id] = sheets.load(sheetUrl(id));

  const input = new Input();
  createStick(input);

  // A built island's trees are wherever someone stood them up; a grown one's are
  // a function of the field. Everything downstream only asks "is there a tree
  // here", so the two are the same shape.
  const plantedTrees = new Set<string>();
  if (island) {
    for (const placed of island.props) if (placed.id === TREE_PROP) plantedTrees.add(`${placed.col},${placed.row}`);
  }
  const hasTree = island ? (col: number, row: number): boolean => plantedTrees.has(`${col},${row}`) : treeAt;
  const groundBlocked = island ? blockedOn(island) : blockedByTree;

  const wood = new Wood(hasTree);
  const boss = new BossTree();
  const bossArt = new TreantArt();
  const blocked = (feet: Pos): boolean => groundBlocked(feet) || boss.blocks(feet);
  const chop = new Chop();
  const isBoss = (cell: { col: number; row: number }): boolean =>
    cell.col === BOSS_CELL.col && cell.row === BOSS_CELL.row;
  // The boss wins a tie: standing where its roots do, an ordinary trunk is not
  // what you meant to swing at.
  const swingAxe = (): void => {
    const target = boss.inReach(pos) ? BOSS_CELL : wood.inReach(pos);
    if (target) chop.start(target);
  };
  const action = createActionButton(swingAxe);
  const logs = new Logs();
  const counter = createTally(url("log.png"), "Logs");

  let debug = false;
  createMenu("Whispering Woods", {
    onDebug: (on) => {
      debug = on;
    },
    onEditor: () => {
      // With an island in hand the editor opens it; without one it starts blank,
      // which is what "build an island" should do from the grown wood.
      location.href = island ? EDIT_STASHED_ISLAND_URL : "woodsEditor.html";
    },
    onOutline: () => {
      location.href = OUTLINE_URL;
    },
    onAllGames: () => {
      location.href = "index.html";
    },
  });

  /** What the island's ground is painted with, cell by cell. */
  const paintLand = (col: number, row: number, at: Pos): void => {
    if (island) {
      const brush = groundById(playedGroundAt(island, col, row));
      if (!brush) return;
      drawGroundCell(ctx, book, brush, col, row, at.x, at.y, ZOOM);
      return;
    }
    if (grassSheet.ok) drawCoastTile(ctx, grassSheet.img, { col: tileVariant(col, row), row: 0 }, at, ZOOM);
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
    const next = walk(pos, axis, dt, bounds, blocked);
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
      // The blow that fells it bursts its logs out of the stump — an armful from
      // the boss, where an ordinary tree gives three.
      if (isBoss(chop.target)) {
        if (boss.hit()) logs.spawn(bossBase(), BOSS_LOGS);
      } else if (wood.hit(col, row)) {
        logs.spawn({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
      }
    }
    wood.update(dt);
    boss.update(dt);
    if (logs.update(dt, pos) > 0) counter.set(logs.collected);
    action.setEnabled(boss.inReach(pos) || wood.inReach(pos) !== null);

    const camera = cameraAt(pos, viewport.width, viewport.height, ZOOM);
    ctx.fillStyle = DEEP_SEA;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.imageSmoothingEnabled = false;
    const view = { camera, zoom: ZOOM, width: viewport.width, height: viewport.height, animT };
    drawIslandGround(ctx, coast, view, paintLand);

    // Whatever stands lower on the field is drawn last, so a tree in front of
    // the character hides them and one behind does not.
    const standing: Array<{ y: number; draw: () => void }> = [];

    // The fence ringing the island. It stands on the ground like anything else, so
    // it joins the depth order and the character passes behind it.
    if (coast.fence.ok) {
      const range = visibleTiles(camera, viewport.width, viewport.height, ZOOM, 1);
      for (let row = range.minRow; row <= range.maxRow; row++) {
        for (let col = range.minCol; col <= range.maxCol; col++) {
          const fence = fenceTile(col, row);
          if (!fence) continue;
          const at = screenAt(cellAt(col, row), camera, ZOOM);
          standing.push({
            y: row * TILE + TILE,
            draw: () => drawCoastTile(ctx, coast.fence.img, fence.tile, at, ZOOM, fence.flipV),
          });
        }
      }
    }
    const trunks: Array<{ x: number; y: number }> = []; // screen points, for the debug boxes

    if (treeSheet.ok && stumpSheet.ok) {
      const range = visibleTiles(camera, viewport.width, viewport.height, ZOOM, TREE_PAD);
      for (let row = range.minRow; row <= range.maxRow; row++) {
        for (let col = range.minCol; col <= range.maxCol; col++) {
          if (!hasTree(col, row)) continue;
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

    // The boss stands among them, in the depth order like anything else, so you
    // can walk behind it. It stays on the field once felled: a slumped, unlit
    // stump is the trophy.
    if (bossArt.ready) {
      const base = bossBase();
      const at = screenAt(base, camera, ZOOM);
      standing.push({ y: base.y, draw: () => bossArt.draw(ctx, boss.treant, at.x, at.y, BOSS_SCALE) });
    }

    // Everything else someone stood on a built island. Trees are left to the
    // path above: they are the ones with an axe swinging at them.
    if (island) {
      for (const placed of drawOrder(island)) {
        if (placed.id === TREE_PROP) continue;
        const prop = propById(placed.id);
        if (!prop) continue;
        const at = screenAt(cellAt(placed.col, placed.row), camera, ZOOM);
        standing.push({
          y: placed.row * TILE + TILE / 2,
          draw: () => drawProp(ctx, book, prop, at.x, at.y, ZOOM, animT),
        });
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
      const bossAt = screenAt(bossBase(), camera, ZOOM);
      drawBox(ctx, bossAt.x, bossAt.y, BOSS_BOX, "#ff8a3a");
      // How far the axe carries: a trunk's base inside this ring is choppable.
      drawCircle(ctx, feet.x, feet.y, AXE_REACH * ZOOM, "#ffd24a");
      drawBox(ctx, feet.x, feet.y, FIGURE_BOX, "#7cff5a");
    }
  };

  new Loop(step).start();
}

main();
