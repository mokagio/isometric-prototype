import { loadTileset } from "./tileset";
import { generateWorld, findSpawn, GRASS, MAP_SIZE, randomSeed, type World } from "./world";
import {
  PLAY_STASHED_MAP_QUERY,
  recallMap,
  rememberWorldSeed,
  stashMap,
  wantsStashedMap,
} from "./handoff";
import { decodeMap, encodeMap, fillEmpty, isComplete, readyToPlay, worldFromMap, type MapData } from "./mapFormat";
import { pickTextFile } from "./files";
import { render, type Entity } from "./renderer";
import { project, SY, type Origin } from "./iso";
import { Camera } from "./camera";
import { Loop } from "./loop";
import { Viewport } from "./viewport";
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

// The seed is stashed as the world is made, so the editor can open the very
// world you are walking around in.
function newWorld(): World {
  const seed = randomSeed();
  rememberWorldSeed(seed);
  return generateWorld(MAP_SIZE, MAP_SIZE, seed);
}

/** The map the editor handed over, or null to walk a generated world instead. */
function stashedWorld(): World | null {
  if (!wantsStashedMap(location.search)) return null;
  const text = recallMap();
  if (text === null) return null;
  try {
    const map = decodeMap(text);
    // Anywhere unbuilt becomes grass, so a half-drawn map is still walkable.
    return worldFromMap(isComplete(map) ? map : fillEmpty(map, GRASS));
  } catch (e) {
    alert(e instanceof Error ? e.message : "That map could not be played.");
    return null;
  }
}

async function main(): Promise<void> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const tileset = await loadTileset(tilesheetUrl);
  const input = new Input(window);

  let world = stashedWorld() ?? newWorld();
  let spawn = findSpawn(world);
  let hero = new Hero(spawn.col, spawn.row, world);
  // Height tracks the ground under the hero, not the hero's own z, so a jump
  // reads as the hero rising and climbs pan gently.
  const camera = new Camera(hero.z);

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

  function resetTo(next: World): void {
    world = next;
    spawn = findSpawn(world);
    hero = new Hero(spawn.col, spawn.row, world);
    camera.snap(hero.z);
    monsters.reset();
    lives.reset();
    hud.setLives(lives.lives);
    hud.hideGameOver();
  }

  /** Try again: back onto the same ground you died on, hand-built map included. */
  function restart(): void {
    resetTo(stashedWorld() ?? newWorld());
  }

  /** Play a map from a file: stashed and marked in the URL, so it survives a reload. */
  async function openMap(): Promise<void> {
    const text = await pickTextFile();
    if (text === null) return;
    let map: MapData;
    try {
      map = decodeMap(text);
    } catch (e) {
      alert(e instanceof Error ? e.message : "That map could not be played.");
      return;
    }
    const ready = readyToPlay(map, confirm, GRASS);
    if (ready === null) return;
    stashMap(encodeMap(ready));
    history.replaceState(null, "", PLAY_STASHED_MAP_QUERY);
    resetTo(worldFromMap(ready));
  }

  function newRandomWorld(): void {
    // Leaving a hand-built map behind means the URL has to stop asking for it,
    // or the next reload would drop you back onto the map.
    history.replaceState(null, "", location.pathname);
    resetTo(newWorld());
  }

  const hud = createHud(restart);
  hud.setLives(lives.lives);

  const viewport = new Viewport(canvas);

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

  const step = (dt: number): void => {
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
    camera.follow(groundZ, dt);

    viewport.fit();
    viewport.applyTransform(ctx);
    const origin = camera.origin(hero, { width: viewport.width, height: viewport.height });
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
    render(ctx, tileset, world, origin, viewport.width, viewport.height, entities);

    if (debug) {
      const hf = project(hero.col, hero.row, hero.z, origin);
      drawBox(ctx, hf.x, hf.y + SY, HERO_BOX, "#7cff5a");
      drawArea(ctx, hero.col, hero.row, 0, origin, "#7cff5a"); // the hero's footprint
      for (const m of monsters.list()) {
        drawArea(ctx, m.home.col, m.home.row, AGGRO_HALF, origin, "#ffd24a"); // the lurk square, anchored at its post
        const mf = project(m.col, m.row, 0, origin);
        drawBox(ctx, mf.x, mf.y + SY, MONSTER_BOX, "#ff5a5a");
      }
    }
  };

  viewport.fit();
  new Loop(step).start();

  createMenu({
    onNewWorld: newRandomWorld,
    onOpenMap: () => void openMap(),
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
