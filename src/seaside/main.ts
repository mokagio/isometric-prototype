import { Input } from "../input";
import { Loop } from "../loop";
import { blitFrame, frameAt, SheetLoader, type Sheet } from "../sprites";
import { createStick } from "../stick";
import { drawGroundCell, drawProp, type SheetBook } from "../sunnyside/draw";
import { groundById, propById } from "../sunnyside/manifest";
import { SHEETS, sheetUrl, type SheetId } from "../sunnyside/sheets";
import { createMenu } from "../ui";
import { Viewport } from "../viewport";
import { facingFrom, walk, type Facing, type Pos } from "../woods/walker";
import { makeChicken, PICKUP, stepChicken, type Chicken } from "./coop";
import { cast, fishing, idleLine, reel, stepLine } from "./fishing";
import { actionFor, CROPS, dig, grow, pick, plant, water, type CropId } from "./garden";
import { createHud, FISH_TINT } from "./hud";
import { add, buySeed, NAMES, nextSeed, sellAll, takeSeed } from "./market";
import { loadSave, storeSave } from "./save";
import { atCounter, blocker, canFish, cellOf, COLS, GARDEN, groundAt, inGarden, PEN, ROWS, SEA_COL, solidGrid, START, TILE, townProps } from "./town";

// The kid's sheets are Sunnyside's 96x64 frames, standing at (48, 39), as in Whispering Woods.
const CELL_W = 96;
const CELL_H = 64;
const ANCHOR_X = 48;
const ANCHOR_Y = 39;
const FPS = 12;
/** Pixels per sprite pixel: a step further out on a short screen, so a phone held sideways sees more of town. */
let ZOOM = 4;
const DIG_FRAMES = 13;
const WATER_FRAMES = 5;
/** The watering can is tipped twice over, so it reads as watering and not a wave. */
const WATER_TIME = (WATER_FRAMES * 2) / FPS;
const DIG_TIME = DIG_FRAMES / FPS;
const CHICKENS = 4;

const sunny = (name: string): string => `${import.meta.env.BASE_URL}sunnyside/${name}`;
const seaside = (name: string): string => `${import.meta.env.BASE_URL}seaside/${name}`;

const GARDEN_W = GARDEN.col1 - GARDEN.col0 + 1;
const GARDEN_H = GARDEN.row1 - GARDEN.row0 + 1;
const plotIndex = (col: number, row: number): number => (row - GARDEN.row0) * GARDEN_W + (col - GARDEN.col0);

function main(): void {
  const canvas = document.getElementById("seaside") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const viewport = new Viewport(canvas);

  const ids = Object.keys(SHEETS) as SheetId[];
  const sheets = new SheetLoader(15 + ids.length);
  const kid = {
    walk: sheets.load(sunny("walk.png")),
    idle: sheets.load(sunny("idle.png")),
    cast: sheets.load(seaside("cast.png")),
    wait: sheets.load(seaside("wait.png")),
    reel: sheets.load(seaside("reel.png")),
    caught: sheets.load(seaside("caught.png")),
    dig: sheets.load(seaside("dig.png")),
    water: sheets.load(seaside("water.png")),
  };
  const shadow = sheets.load(sunny("shadow.png"));
  const chickenSheet = sheets.load(sunny("chicken.png"));
  const sparkle = sheets.load(sunny("seaSparkle.png"));
  const crops = sheets.load(seaside("crops.png"));
  const soil = sheets.load(seaside("soil.png"));
  const items = sheets.load(seaside("items.png"));
  const book: SheetBook = {};
  for (const id of ids) book[id] = sheets.load(sheetUrl(id));

  const input = new Input();
  createStick(input);
  const hud = createHud();
  createMenu("Seaside", {
    onAllGames: () => {
      location.href = "index.html";
    },
  });

  const props = townProps();
  const blocked = blocker(solidGrid(props));
  const save = loadSave(GARDEN_W * GARDEN_H);
  const pack = save.pack;
  const plots = save.plots;
  let seed: CropId | null = nextSeed(pack, null);
  const refresh = (): void => hud.setPack(pack, seed);
  refresh();

  const pen = { x0: (PEN.col0 + 1) * TILE + 4, y0: (PEN.row0 + 1) * TILE + 4, x1: PEN.col1 * TILE - 4, y1: PEN.row1 * TILE - 6 };
  const chickens: Chicken[] = Array.from({ length: CHICKENS }, () => makeChicken(pen, Math.random));
  const eggs: Pos[] = [];

  let pos: Pos = { ...START };
  let facing: Facing = "right";
  let walkT = 0;
  let animT = 0;
  /** A dig or a watering under way: which, how far through, and the plot it is for. */
  let busy: { kind: "dig" | "water"; t: number; plot: number } | null = null;
  const line = idleLine();
  let caughtFish: string | null = null;
  let actionHeld = false;
  let saveTimer = 0;
  let marketRedraw: ((p: typeof pack) => void) | null = null;

  const persist = (): void => storeSave(save);

  /** The garden plot under the kid's feet, if any. */
  const plotHere = (): number | null => {
    const c = cellOf(pos);
    return inGarden(c.col, c.row) ? plotIndex(c.col, c.row) : null;
  };

  const openMarket = (): void => {
    marketRedraw = hud.openMarket(
      pack,
      () => {
        const got = sellAll(pack);
        if (got > 0) hud.say(`Sold for ${got} coins!`);
        refresh();
        marketRedraw?.(pack);
        persist();
      },
      (crop) => {
        if (!buySeed(pack, crop)) return;
        if (seed === null || (pack.seeds[seed] ?? 0) === 0) seed = crop;
        refresh();
        marketRedraw?.(pack);
        persist();
      },
    );
  };

  /** What the one button does right now, and its label. */
  const currentAction = (): { label: string; run: () => void } | null => {
    if (busy) return null;
    if (fishing(line)) {
      if (line.state === "bite") return { label: "Reel!", run: () => reel(line) };
      if (line.state === "waiting" || line.state === "casting") return { label: "Wait…", run: () => reel(line) };
      return null;
    }
    if (atCounter(pos)) return { label: "Market", run: openMarket };
    const i = plotHere();
    if (i !== null) {
      const plot = plots[i]!;
      const what = actionFor(plot, seed !== null && (pack.seeds[seed] ?? 0) > 0);
      if (what === "dig") return { label: "Dig", run: () => (busy = { kind: "dig", t: 0, plot: i }) };
      if (what === "water") return { label: "Water", run: () => (busy = { kind: "water", t: 0, plot: i }) };
      if (what === "plant") {
        return {
          label: "Plant",
          run: () => {
            if (!seed || !takeSeed(pack, seed)) return;
            plant(plot, seed);
            hud.say(`Planted a ${NAMES[seed].toLowerCase()}. Now water it!`);
            if ((pack.seeds[seed] ?? 0) === 0) seed = nextSeed(pack, seed);
            refresh();
            persist();
          },
        };
      }
      if (what === "pick") {
        return {
          label: "Pick",
          run: () => {
            const crop = pick(plot);
            if (!crop) return;
            add(pack, crop);
            hud.say(`Picked a ${NAMES[crop].toLowerCase()}!`);
            refresh();
            persist();
          },
        };
      }
      if (plot.crop) return null;
    }
    if (canFish(pos, facing)) return { label: "Fish", run: () => cast(line) };
    return null;
  };

  hud.onAction(() => currentAction()?.run());
  hud.onSeed(() => {
    seed = nextSeed(pack, seed);
    refresh();
  });

  /** Paint a 16px cell of one of the seaside's own sheets, its top-left at a screen point. */
  const cell = (sheet: Sheet, col: number, row: number, x: number, y: number): void => {
    if (!sheet.ok) return;
    ctx.drawImage(sheet.img, col * 16, row * 16, 16, 16, Math.round(x), Math.round(y), 16 * ZOOM, 16 * ZOOM);
  };

  const update = (dt: number): void => {
    if (input.jump && !actionHeld) currentAction()?.run();
    actionHeld = input.jump;

    // Planted while digging, watering or fishing: a can that slides along the grass reads as a bug.
    const still = busy !== null || fishing(line);
    const axis = still ? { dc: 0, dr: 0 } : input.axis;
    const moving = axis.dc !== 0 || axis.dr !== 0;
    const next = walk(pos, axis, dt, { minX: 4, minY: 4, maxX: COLS * TILE - 4, maxY: ROWS * TILE - 4 }, blocked);
    if (!still) facing = facingFrom(next.x - pos.x, facing);
    pos = next;
    walkT = moving ? walkT + dt : 0;

    if (busy) {
      busy.t += dt;
      const plot = plots[busy.plot]!;
      if (busy.kind === "dig" && busy.t >= DIG_TIME) {
        dig(plot);
        busy = null;
        persist();
      } else if (busy.kind === "water" && busy.t >= WATER_TIME) {
        water(plot);
        busy = null;
        persist();
      }
    }

    const before = line.state;
    const landed = stepLine(line, dt);
    if (landed) {
      add(pack, landed);
      caughtFish = landed;
      hud.say(landed === "golden" ? "A GOLDEN FISH!" : `Caught a ${NAMES[landed].toLowerCase()}!`);
      refresh();
      persist();
    }
    if (line.state === "missed" && before !== "missed") hud.say("It got away…");
    if (line.state === "bite" && before !== "bite") hud.say("A bite! Reel it in!");

    for (const plot of plots) grow(plot, dt);
    for (const c of chickens) {
      const egg = stepChicken(c, dt, pen, eggs.length);
      if (egg) eggs.push(egg);
    }
    for (let i = eggs.length - 1; i >= 0; i--) {
      if (Math.hypot(eggs[i]!.x - pos.x, eggs[i]!.y - pos.y) < PICKUP) {
        eggs.splice(i, 1);
        add(pack, "egg");
        hud.say("Found an egg!");
        refresh();
        persist();
      }
    }
    saveTimer += dt;
    if (saveTimer > 5) {
      saveTimer = 0;
      persist();
    }
  };

  const draw = (): void => {
    // Camera: on the kid, but never showing past the edge of town.
    const viewW = viewport.width / ZOOM;
    const viewH = viewport.height / ZOOM;
    const camX = Math.max(0, Math.min(COLS * TILE - viewW, pos.x - viewW / 2));
    const camY = Math.max(0, Math.min(ROWS * TILE - viewH, pos.y - viewH / 2));
    const screen = (p: Pos): Pos => ({ x: (p.x - camX) * ZOOM, y: (p.y - camY) * ZOOM });

    ctx.fillStyle = "#0099db";
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.imageSmoothingEnabled = false;
    const c0 = Math.max(0, Math.floor(camX / TILE));
    const r0 = Math.max(0, Math.floor(camY / TILE));
    const c1 = Math.min(COLS - 1, Math.ceil((camX + viewW) / TILE));
    const r1 = Math.min(ROWS - 1, Math.ceil((camY + viewH) / TILE));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const at = screen({ x: col * TILE, y: row * TILE });
        const brush = groundById(groundAt(col, row));
        if (brush) drawGroundCell(ctx, book, brush, col, row, at.x, at.y, ZOOM);
        // Sun glinting off the water, here and there.
        if (col >= SEA_COL && (col * 31 + row * 17) % 9 === 0) cell(sparkle, Math.floor(animT * 4 + col + row) % 4, 0, at.x, at.y);
        if (inGarden(col, row)) {
          const plot = plots[plotIndex(col, row)]!;
          if (plot.dug) cell(soil, plot.watered ? 1 : 0, 0, at.x, at.y);
        }
      }
    }
    // Foam where the sand meets the water.
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let row = r0; row <= r1; row++) {
      const at = screen({ x: SEA_COL * TILE, y: row * TILE });
      const wobble = Math.sin(animT * 2 + row * 0.9) * 1.5 * ZOOM;
      ctx.fillRect(at.x + wobble - ZOOM, at.y, ZOOM * 2, TILE * ZOOM);
    }

    // Everything standing up, farthest first, so nearer things cover farther ones.
    const standing: Array<{ y: number; draw: () => void }> = [];
    for (const p of props) {
      const prop = propById(p.id);
      if (!prop) continue;
      const at = screen({ x: p.col * TILE, y: p.row * TILE });
      standing.push({ y: (p.row + 1) * TILE - (prop.layer === "flat" ? 99 : 0), draw: () => drawProp(ctx, book, prop, at.x, at.y, ZOOM, animT) });
    }
    for (let row = GARDEN.row0; row <= GARDEN.row1; row++) {
      for (let col = GARDEN.col0; col <= GARDEN.col1; col++) {
        const plot = plots[plotIndex(col, row)]!;
        const crop = plot.crop;
        if (!crop) continue;
        const at = screen({ x: col * TILE, y: row * TILE });
        standing.push({ y: (row + 1) * TILE - 2, draw: () => cell(crops, plot.stage, CROPS.indexOf(crop), at.x, at.y) });
      }
    }
    for (const egg of eggs) {
      const at = screen({ x: egg.x - 8, y: egg.y - 12 });
      standing.push({ y: egg.y, draw: () => cell(items, 1, 0, at.x, at.y) });
    }
    if (chickenSheet.ok) {
      for (const c of chickens) {
        const at = screen(c);
        const pecking = c.rest > 0;
        standing.push({
          y: c.y,
          draw: () =>
            blitFrame(ctx, chickenSheet.img, at.x, at.y, {
              cell: 32,
              cellH: 32,
              scale: ZOOM,
              anchorX: 15,
              anchorY: 25,
              frame: pecking ? 0 : frameAt(animT, 8, 4, true),
              flip: c.facing === "left",
            }),
        });
      }
    }

    // The kid, in whatever they are doing.
    const feet = screen(pos);
    const moving = walkT > 0;
    let sheet: Sheet = moving ? kid.walk : kid.idle;
    let frame = frameAt(moving ? walkT : animT, FPS, moving ? 8 : 9, true);
    if (busy?.kind === "dig") {
      sheet = kid.dig;
      frame = frameAt(busy.t, FPS, DIG_FRAMES, false);
    } else if (busy?.kind === "water") {
      sheet = kid.water;
      frame = frameAt(busy.t, FPS, WATER_FRAMES, true);
    } else if (line.state === "casting") {
      sheet = kid.cast;
      frame = frameAt(line.t, FPS, 15, false);
    } else if (line.state === "waiting" || line.state === "bite") {
      sheet = kid.wait;
      frame = frameAt(animT, line.state === "bite" ? FPS * 2 : FPS / 2, 9, true);
    } else if (line.state === "reeling") {
      sheet = kid.reel;
      frame = frameAt(line.t, FPS, 13, false);
    } else if (line.state === "caught") {
      sheet = kid.caught;
      frame = frameAt(line.t, FPS, 10, false);
    }
    standing.push({
      y: pos.y,
      draw: () => {
        if (shadow.ok) blitFrame(ctx, shadow.img, feet.x, feet.y, { cell: 16, scale: ZOOM, anchorX: 8, anchorY: 8, frame: 0 });
        if (sheet.ok) blitFrame(ctx, sheet.img, feet.x, feet.y, { cell: CELL_W, cellH: CELL_H, scale: ZOOM, anchorX: ANCHOR_X, anchorY: ANCHOR_Y, frame, flip: facing === "left" });
      },
    });
    standing.sort((a, b) => a.y - b.y);
    for (const s of standing) s.draw();

    // A bite: a big "!" over the kid's head. A catch: the fish held up.
    if (line.state === "bite") {
      ctx.font = `bold ${10 * ZOOM}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = ZOOM;
      ctx.strokeStyle = "#3a2410";
      ctx.fillStyle = "#ffd23a";
      const y = feet.y - 22 * ZOOM + Math.sin(animT * 20) * ZOOM;
      ctx.strokeText("!", feet.x, y);
      ctx.fillText("!", feet.x, y);
    }
    if (line.state === "caught" && caughtFish) {
      ctx.save();
      ctx.filter = FISH_TINT[caughtFish as keyof typeof FISH_TINT] || "none";
      cell(items, 0, 0, feet.x - 8 * ZOOM, feet.y - 30 * ZOOM);
      ctx.restore();
    }
  };

  const step = (dt: number): void => {
    viewport.fit();
    ZOOM = viewport.height < 500 ? 3 : 4;
    viewport.applyTransform(ctx);
    animT += dt;
    const paused = hud.marketOpen();
    if (!paused) update(dt);
    hud.setAction(paused ? null : (currentAction()?.label ?? null));
    draw();
  };

  window.addEventListener("pagehide", persist);
  new Loop(step).start();
}

main();
