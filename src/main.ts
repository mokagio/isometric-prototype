import { loadTileset } from "./tileset";
import { generateWorld, findSpawn } from "./world";
import { render, type Entity } from "./renderer";
import { project, SX, SY, SZ, type Origin } from "./iso";
import { createMenu } from "./ui";
import { createStick } from "./stick";
import { Input } from "./input";
import { Hero, drawHeroPlaceholder, drawHeroShadow } from "./hero";
import { facingFromAxis, type Facing } from "./heroSprite";
import { createHeroSkin } from "./heroSkin";
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
  let facing: Facing = 2; // faces the camera to start
  let moving = false;

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
    drawHeroShadow(ctx, feetX, shadowY);
    if (!heroSprite.draw(ctx, feetX, feetY, facing, moving)) {
      drawHeroPlaceholder(ctx, feetX, feetY);
    }
  }

  let last = 0;
  function frame(now: number): void {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;

    const axis = input.axis;
    moving = axis.dc !== 0 || axis.dr !== 0;
    const nextFacing = facingFromAxis(axis.dc, axis.dr);
    if (nextFacing !== null) facing = nextFacing;

    hero.update(dt, input, world);
    heroSprite.update(dt, moving);
    const groundZ = world.heightAt(Math.round(hero.col), Math.round(hero.row));
    camZ += (groundZ - camZ) * Math.min(1, dt * 8);

    fitCanvas();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const origin = cameraOrigin();
    const entity: Entity = { col: hero.col, row: hero.row, draw: () => drawHero(origin) };
    render(ctx, tileset, world, origin, cw, ch, entity);

    requestAnimationFrame(frame);
  }

  fitCanvas();
  requestAnimationFrame(frame);

  createMenu({
    onNewWorld: () => {
      world = generateWorld(WORLD, WORLD, randomSeed());
      spawn = findSpawn(world);
      hero = new Hero(spawn.col, spawn.row, world);
      camZ = hero.z;
    },
    onEditor: () => {
      location.href = "editor.html";
    },
  });

  createStick(input);
}

void main();
