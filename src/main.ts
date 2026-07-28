import { loadTileset } from "./tileset";
import { generateWorld, findSpawn } from "./world";
import { render, type Entity } from "./renderer";
import { project, SX, SY, SZ, type Origin } from "./iso";
import { createMenu } from "./ui";
import { createStick } from "./stick";
import { Input } from "./input";
import { Hero, drawHeroPlaceholder, drawHeroShadow } from "./hero";
import { facingFromAxis, type Facing } from "./heroSprite";
import { createHeroSkin, type HeroAction } from "./heroSkin";
import { createActionPad } from "./actionPad";
import { AGGRO_HALF, MonsterField } from "./monsters";
import { Lives } from "./lives";
import { createHud } from "./hud";
import { Swing } from "./swing";
import { drawArea, drawBox, HERO_BOX, MONSTER_BOX } from "./debug";
import tilesheetUrl from "../isometric_fantasy_tiles.png";

const WORLD = 80; // fixed roamable map; the camera follows the hero across it

const randomSeed = (): number => Math.floor(Math.random() * 1_000_000);

async function main(): Promise<void> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const tileset = await loadTileset(tilesheetUrl);
  const input = new Input(window);

  let world = generateWorld(WORLD, WORLD, randomSeed());
  let spawn = findSpawn(world);
  let hero = new Hero(spawn.col, spawn.row, world);
  // Camera height tracks the ground under the hero (smoothed), not the hero's
  // own z — so a jump reads as the hero rising, and climbs pan gently.
  let camZ = hero.z;

  const heroSprite = createHeroSkin();
  const monsters = new MonsterField();
  const lives = new Lives();
  let facing: Facing = 2; // faces the camera to start
  let moving = false;
  let animClock = 0; // continuous clock for the looping idle/run cycles
  const swing = new Swing();
  let debug = false;
  const triggerAttack = (): void => {
    if (lives.alive) swing.start();
  };

  function restart(): void {
    world = generateWorld(WORLD, WORLD, randomSeed());
    spawn = findSpawn(world);
    hero = new Hero(spawn.col, spawn.row, world);
    camZ = hero.z;
    monsters.reset();
    lives.reset();
    hud.setLives(lives.lives);
    hud.hideGameOver();
  }

  const hud = createHud(restart);
  hud.setLives(lives.lives);

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

  // Camera centres the hero on screen, so moving scrolls the world.
  const cameraOrigin = (): Origin => ({
    x: cw / 2 - (hero.col - hero.row) * SX,
    y: ch / 2 - ((hero.col + hero.row) * SY - camZ * SZ) - SY,
  });

  function drawHero(o: Origin): void {
    const feet = project(hero.col, hero.row, hero.z, o);
    const groundZ = world.heightAt(Math.round(hero.col), Math.round(hero.row));
    const shadowY = project(hero.col, hero.row, groundZ, o).y + SY;
    const feetX = feet.x;
    const feetY = feet.y + SY;
    ctx.save();
    // Blink through the immunity window while alive; on death the fall-down
    // animation plays at full opacity — no fade-out.
    ctx.globalAlpha = lives.alive ? lives.alpha() : 1;
    drawHeroShadow(ctx, feetX, shadowY);
    if (!lives.alive) {
      // Defeated: play the fall-down death animation (skins without one hold idle).
      if (
        !heroSprite.drawDefeat?.(ctx, feetX, feetY, facing, lives.deathTime) &&
        !heroSprite.draw(ctx, feetX, feetY, facing, "idle", animClock)
      ) {
        drawHeroPlaceholder(ctx, feetX, feetY);
      }
    } else {
      const action: HeroAction = swing.active ? "attack" : moving ? "run" : "idle";
      const actionTime = swing.active ? swing.time : animClock;
      if (!heroSprite.draw(ctx, feetX, feetY, facing, action, actionTime)) {
        drawHeroPlaceholder(ctx, feetX, feetY);
      }
    }
    ctx.restore();
  }

  let last = 0;
  function frame(now: number): void {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;

    animClock += dt;
    lives.update(dt);

    if (lives.alive) {
      const axis = input.axis;
      moving = axis.dc !== 0 || axis.dr !== 0;
      const nextFacing = facingFromAxis(axis.dc, axis.dr);
      if (nextFacing !== null) facing = nextFacing;

      hero.update(dt, input, world);
      monsters.update(dt, hero, world);
      if (swing.update(dt)) monsters.attackAt(hero.col, hero.row);
      const bumping = monsters.contactAt(hero.col, hero.row);
      if (bumping && lives.hit()) {
        hero.knockback(hero.col - bumping.col, hero.row - bumping.row);
        hud.setLives(lives.lives);
      }
    } else {
      // Freeze the field and let the hero idle while fading, so the sign lands
      // on a still scene rather than a monster mid-lunge.
      moving = false;
      swing.cancel();
      if (lives.gameOver) hud.showGameOver();
    }

    const groundZ = world.heightAt(Math.round(hero.col), Math.round(hero.row));
    camZ += (groundZ - camZ) * Math.min(1, dt * 8);

    fitCanvas();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const origin = cameraOrigin();
    const entities: Entity[] = [{ col: hero.col, row: hero.row, draw: () => drawHero(origin) }];
    for (const m of monsters.list()) {
      entities.push({
        col: m.col,
        row: m.row,
        draw: () => {
          const feet = project(m.col, m.row, 0, origin);
          monsters.draw(ctx, m, feet.x, feet.y + SY);
        },
      });
    }
    render(ctx, tileset, world, origin, cw, ch, entities);

    if (debug) {
      const hf = project(hero.col, hero.row, hero.z, origin);
      drawBox(ctx, hf.x, hf.y + SY, HERO_BOX, "#7cff5a");
      drawArea(ctx, hero.col, hero.row, 0, origin, "#7cff5a"); // the hero's footprint
      for (const m of monsters.list()) {
        drawArea(ctx, m.col, m.row, AGGRO_HALF, origin, "#ffd24a"); // the lurk square
        const mf = project(m.col, m.row, 0, origin);
        drawBox(ctx, mf.x, mf.y + SY, MONSTER_BOX, "#ff5a5a");
      }
    }

    requestAnimationFrame(frame);
  }

  fitCanvas();
  requestAnimationFrame(frame);

  createMenu({
    onNewWorld: restart,
    onEditor: () => {
      location.href = "editor.html";
    },
    onCredits: () => {
      location.href = "credits.html";
    },
    onEnemyMode: (lurk) => monsters.setMode(lurk ? "lurk" : "hunt"),
    onDebug: (on) => {
      debug = on;
    },
  });

  createStick(input);
  createActionPad({
    onAttack: triggerAttack,
    onJumpChange: (held) => input.setJump(held),
  });
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "j") triggerAttack();
  });
}

void main();
