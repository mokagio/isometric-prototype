import { loadTileset } from "./tileset";
import { generateWorld, findSpawn, GRASS, MAP_SIZE, randomSeed, type World } from "./world";
import {
  EDIT_STASHED_MAP_URL,
  PLAY_STASHED_MAP_QUERY,
  recallMap,
  rememberWorldSeed,
  stashMap,
  wantsStashedMap,
} from "./handoff";
import {
  decodeMap,
  encodeMap,
  fillEmpty,
  isComplete,
  mapFromWorld,
  readyToPlay,
  worldFromMap,
  type MapData,
} from "./mapFormat";
import { pickTextFile } from "./files";
import { isHidden } from "./occlusion";
import { hazardToll } from "./hazard";
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
import { GemArt, Gems, gemUrl, type Terrain } from "./gems";
import { Progress } from "./levels";
import { createTally } from "./tally";
import { createHud } from "./hud";
import { Swing } from "./swing";
import { drawArea, drawBox, HERO_BOX, MONSTER_BOX } from "./debug";
import tilesheetUrl from "../isometric_fantasy_tiles.png";

// How faintly a figure shows through whatever is standing in front of it.
const GHOST_ALPHA = 0.35;

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
  const gems = new Gems();
  const gemArt = new GemArt();
  // Reads whichever world is current, so a gem thrown on a map loaded mid-session
  // crosses that map's ground rather than the one it replaced.
  const terrain: Terrain = {
    heightAt: (col, row) => world.heightAt(col, row),
    barred: (col, row) => world.blocks(col, row) || world.isHazard(col, row),
  };
  const progress = new Progress();
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
    gems.reset();
    progress.reset();
    startLevel();
    hud.setLives(lives.lives);
    hud.hideGameOver();
  }

  /** Point the field at whatever level the run is on, and say so in the corner. */
  function startLevel(): void {
    monsters.setLevel(progress.hp, progress.kind(monsters.cast));
    tally.set(progress.banked, progress.target);
  }

  /** Try again: back onto the same ground you died on, hand-built map included. */
  function restart(): void {
    resetTo(stashedWorld() ?? newWorld());
  }

  /** Hand the ground you are standing on to the editor, generated or hand-built alike. */
  function editMap(): void {
    if (!stashMap(encodeMap(mapFromWorld(world)))) {
      alert("This browser will not let the game pass a map to the editor.");
      return;
    }
    location.href = EDIT_STASHED_MAP_URL;
  }

  /** Play a map from a file: stashed and marked in the URL, so it survives a reload. */
  async function loadMap(): Promise<void> {
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
  const tally = createTally(gemUrl(), "Gems");
  startLevel();

  const viewport = new Viewport(canvas);

  function drawHero(o: Origin, ghost = false): void {
    const feet = project(hero.col, hero.row, hero.z, o);
    const groundZ = world.heightAt(Math.round(hero.col), Math.round(hero.row));
    const shadowY = project(hero.col, hero.row, groundZ, o).y + SY;
    const feetX = feet.x;
    const feetY = feet.y + SY;
    ctx.save();
    // Blink through the immunity window while alive; on death the fall-down
    // animation plays at full opacity — no fade-out.
    ctx.globalAlpha = (lives.alive ? lives.alpha() : 1) * (ghost ? GHOST_ALPHA : 1);
    // The shadow belongs on ground that is hidden anyway; over a wall it reads
    // as a smudge rather than as the hero being behind something.
    if (!ghost) drawHeroShadow(ctx, feetX, shadowY);
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

  // Anything a tall column hides gets drawn again over the top of it, faintly.
  // Without this the hero can vanish behind their own tower — and worse, so can a
  // slime that is still perfectly able to take a heart off you.
  function drawGhosts(o: Origin): void {
    if (isHidden(world, hero.col, hero.row, hero.z)) drawHero(o, true);
    for (const m of monsters.list()) {
      const groundZ = world.heightAt(Math.round(m.col), Math.round(m.row));
      if (!isHidden(world, m.col, m.row, groundZ)) continue;
      const feet = project(m.col, m.row, 0, o);
      monsters.draw(ctx, m, feet.x, feet.y + SY, GHOST_ALPHA);
    }
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
      if (swing.update(dt)) {
        for (const felled of monsters.attackAt(hero.col, hero.row))
          gems.spawn(felled.col, felled.row, terrain, hero, felled.hpMax);
      }
      const banked = gems.update(dt, hero);
      if (banked > 0) {
        // Clearing a level only changes what walks in next: a wave already on the
        // field keeps the creature and the hearts it spawned with.
        if (progress.bank(banked)) hud.showLevel(progress.level + 1);
        startLevel();
      }
      const bumping = monsters.contactAt(hero.col, hero.row);
      if (bumping && lives.hit()) {
        hero.knockback(hero.col - bumping.col, hero.row - bumping.row);
        hud.setLives(lives.lives);
      } else if (hazardToll(world, hero, lives)) {
        // No shove: there is nothing to be thrown clear of, and being pushed back
        // out would undo the choice to cross.
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
    for (const gem of gems.list()) {
      entities.push({
        col: gem.col,
        row: gem.row,
        draw: () => {
          const at = project(gem.col, gem.row, gem.z, origin);
          gemArt.draw(ctx, at.x, at.y + SY);
        },
      });
    }
    render(ctx, tileset, world, origin, viewport.width, viewport.height, entities);
    drawGhosts(origin);

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

  createMenu("Peaceful Plains", {
    onNewWorld: newRandomWorld,
    onLoadMap: () => void loadMap(),
    onEditMap: editMap,
    onEditor: () => {
      location.href = "editor.html";
    },
    onAllGames: () => {
      location.href = "index.html";
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
