import { createAtlas } from "./atlas";
import { Chest, placeChest } from "./chest";
import { drawRing } from "./debug";
import { generateDungeon, findSpawn, type Dungeon } from "./dungeon";
import { CONTACT, EnemyField, MELEE, WAKE_STEPS } from "./enemies";
import { FlowField } from "./flow";
import { CELL, centre, project, type Origin } from "./grid";
import { Hero, RADIUS } from "./hero";
import { SWORD } from "./elfSkin";
import { createHeroSkin, type SkinKind } from "./heroSkin";
import { createHud, type Tally } from "./hud";
import { Input } from "./input";
import { Lives } from "./lives";
import { render, type Entity } from "./renderer";
import { createActionPad } from "./actionPad";
import { createStick } from "./stick";
import { Swing } from "./swing";
import { createMenu } from "./ui";
import { loadBuild } from "./build";

const COLS = 64;
const ROWS = 48;
// Seconds the "Dungeon Cleared" banner holds before the next one loads.
const CLEAR_TIME = 1.6;

const randomSeed = (): number => Math.floor(Math.random() * 1_000_000);

async function main(): Promise<void> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const input = new Input(window);

  const atlas = createAtlas();
  await atlas.ready;

  // A dungeon saved from the builder plays instead of a generated one, until it
  // is cleared or "New Dungeon" throws it away.
  let dungeon: Dungeon = loadBuild() ?? generateDungeon(COLS, ROWS, randomSeed());
  let hero = new Hero(0, 0);
  let chest = new Chest({ col: 0, row: 0 });

  let skin = createHeroSkin(atlas);
  const enemies = new EnemyField();
  let flow = new FlowField(dungeon.cols, dungeon.rows);
  // The flood only changes when the hero crosses into a new cell, so it is
  // recomputed on that rather than every frame.
  let floodedAt = { col: NaN, row: NaN };
  const lives = new Lives();
  const swing = new Swing();
  let animClock = 0; // continuous clock for the looping idle/run cycles
  let moving = false;
  let tally: Tally = { dungeons: 0, kills: 0 };
  let clearedFor = 0; // seconds the cleared banner has been up
  let banked = false; // this dungeon's clear has been counted
  let debug = false;

  const triggerAttack = (): void => {
    if (lives.alive && !chest.opening) swing.start();
  };

  /**
   * Drop the hero into `dungeon` and stock it. The flood from her feet is what
   * both the chest and the roster are placed against, so it has to run here —
   * `frame` will re-flood it from wherever she walks to next.
   */
  function enter(): void {
    const spawn = findSpawn(dungeon);
    hero = new Hero(spawn.col, spawn.row);
    if (flow.cols !== dungeon.cols || flow.rows !== dungeon.rows) {
      flow = new FlowField(dungeon.cols, dungeon.rows);
    }
    flow.recompute(dungeon.isFloor, spawn.col, spawn.row);
    floodedAt = { col: spawn.col, row: spawn.row };
    chest = new Chest(placeChest(flow, dungeon));
    enemies.populate(dungeon, flow, dungeon.isFloor, tally.dungeons);
    clearedFor = 0;
    banked = false;
    hud.hideCleared();
  }

  /** Won the last one: a fresh dungeon, keeping her hearts and her tallies. */
  function nextDungeon(): void {
    dungeon = generateDungeon(COLS, ROWS, randomSeed());
    enter();
  }

  function restart(): void {
    dungeon = generateDungeon(COLS, ROWS, randomSeed());
    tally = { dungeons: 0, kills: 0 };
    lives.reset();
    hud.setLives(lives.lives);
    hud.setTally(tally);
    hud.hideGameOver();
    enter();
  }

  const hud = createHud(restart);
  hud.setLives(lives.lives);
  hud.setTally(tally);
  enter();

  let cw = 0;
  let ch = 0;
  let dpr = 1;
  function fitCanvas(): void {
    dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === cw && h === ch) return;
    cw = w;
    ch = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  // Camera centres the hero on screen, so moving scrolls the dungeon.
  const cameraOrigin = (): Origin => ({
    x: Math.round(cw / 2 - (hero.col + 0.5) * CELL),
    y: Math.round(ch / 2 - (hero.row + 0.5) * CELL),
  });

  function drawHero(o: Origin): void {
    const feet = centre(hero.col, hero.row, o);
    ctx.save();
    // Blink through the immunity window while alive; on death the fall-down
    // animation plays at full opacity until the fade takes it.
    ctx.globalAlpha = lives.alpha();
    if (lives.alive) {
      const action = swing.active ? "attack" : moving ? "run" : "idle";
      skin.draw(ctx, feet.x, feet.y, hero.facing, action, swing.active ? swing.time : animClock);
    } else if (!skin.drawDefeat?.(ctx, feet.x, feet.y, hero.facing, lives.deathTime)) {
      // Skins without a defeat pose lie still on their idle frame.
      skin.draw(ctx, feet.x, feet.y, hero.facing, "idle", animClock);
    }
    ctx.restore();
  }

  let last = 0;
  function frame(now: number): void {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;

    animClock += dt;
    lives.update(dt);

    chest.update(dt);

    if (!lives.alive) {
      // Freeze the field and let the hero lie still, so the sign lands on a
      // settled scene rather than a skeleton mid-lunge.
      moving = false;
      swing.cancel();
      if (lives.gameOver) hud.showGameOver(tally);
    } else if (chest.opening) {
      // Won. Same freeze as death, so the banner lands on a still scene, then
      // the next dungeon takes over.
      moving = false;
      swing.cancel();
      if (chest.open) {
        // Banked as the lid finishes rather than as the next dungeon loads, so
        // the tally and the banner agree while the banner is up.
        if (!banked) {
          banked = true;
          tally = { ...tally, dungeons: tally.dungeons + 1 };
          hud.setTally(tally);
          hud.showCleared(tally.dungeons);
        }
        clearedFor += dt;
        if (clearedFor >= CLEAR_TIME) nextDungeon();
      }
    } else {
      const axis = input.axis;
      moving = axis.dc !== 0 || axis.dr !== 0;
      hero.update(dt, input, dungeon.isFloor);
      const at = { col: Math.round(hero.col), row: Math.round(hero.row) };
      if (at.col !== floodedAt.col || at.row !== floodedAt.row) {
        flow.recompute(dungeon.isFloor, at.col, at.row);
        floodedAt = at;
      }
      enemies.update(dt, hero, dungeon.isFloor, flow);
      if (swing.update(dt)) {
        const killed = enemies.attackAt(hero.col, hero.row);
        if (killed > 0) {
          tally = { ...tally, kills: tally.kills + killed };
          hud.setTally(tally);
        }
      }
      const touching = enemies.contactAt(hero.col, hero.row);
      if (touching && lives.hit()) {
        hero.knockback(hero.col - touching.col, hero.row - touching.row);
        hud.setLives(lives.lives);
      }
      chest.tryOpen(hero.col, hero.row);
    }

    fitCanvas();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const origin = cameraOrigin();

    const entities: Entity[] = [
      { row: hero.row, draw: () => drawHero(origin) },
      {
        row: chest.row,
        draw: () => {
          const p = project(chest.col, chest.row, origin);
          chest.draw(ctx, atlas, p.x, p.y);
        },
      },
    ];
    for (const e of enemies.list()) {
      entities.push({
        row: e.row,
        draw: () => {
          const feet = centre(e.col, e.row, origin);
          enemies.draw(ctx, e, feet.x, feet.y);
        },
      });
    }
    render(ctx, atlas, dungeon, origin, cw, ch, entities);

    if (debug) {
      const hf = centre(hero.col, hero.row, origin);
      drawRing(ctx, hf.x, hf.y, RADIUS, "#4ba747");
      drawRing(ctx, hf.x, hf.y, MELEE, "#facb3e");
      for (const e of enemies.list()) {
        const ef = centre(e.col, e.row, origin);
        drawRing(ctx, ef.x, ef.y, CONTACT, e.asleep ? "#775c55" : "#d1495b");
      }
      drawRing(ctx, hf.x, hf.y, WAKE_STEPS, "#4a6fa5");
    }

    requestAnimationFrame(frame);
  }

  fitCanvas();
  requestAnimationFrame(frame);

  createMenu({
    onNewDungeon: restart,
    onEditor: () => {
      location.href = "dungeonEditor.html";
    },
    onCredits: () => {
      location.href = "credits.html";
    },
    onAllGames: () => {
      location.href = "index.html";
    },
    onEnemyMode: (lurk) => enemies.setMode(lurk ? "lurk" : "hunt"),
    onHeroSkin: (kind: SkinKind) => {
      skin = createHeroSkin(atlas, kind);
    },
    onDebug: (on) => {
      debug = on;
    },
  });

  createStick(input);
  createActionPad(triggerAttack, atlas.toCanvas(SWORD, 2));
  input.onAttack(triggerAttack);
}

void main();
