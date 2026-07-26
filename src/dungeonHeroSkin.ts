import type { Facing } from "./heroSprite";
import type { HeroSkin } from "./heroSkin";

// Pixel Poem "Dungeon Hero" (RPG_Hero). Vendored under public/ — its licence
// permits use and modification (see CREDITS.md). One strip per animation and
// direction, 40x40 frames, feet at cell-y 31.
const CELL = 40;
const FEET_Y = 31;
const RUN_FRAMES = 6;
const IDLE_FRAMES = 4;
const RUN_FPS = 10;
const IDLE_FPS = 6;

// Indexed by Facing (0=up, 1=left, 2=down, 3=right) — the pack's own direction names.
const DIRS = ["up", "left", "down", "right"] as const;
const BASE = "/rpg_hero/";

interface Strip {
  img: HTMLImageElement;
  ok: boolean;
  frames: number;
}

export class DungeonHeroSkin implements HeroSkin {
  private idle: Strip[] = [];
  private run: Strip[] = [];
  private settled = 0;
  private readonly total = DIRS.length * 2;
  private time = 0;
  ready = false;

  constructor(base = BASE) {
    for (let f = 0; f < DIRS.length; f++) {
      this.idle[f] = this.load(`${base}idle/idle_${DIRS[f]}_40x40.png`, IDLE_FRAMES);
      this.run[f] = this.load(`${base}run/run_${DIRS[f]}_40x40.png`, RUN_FRAMES);
    }
  }

  private load(src: string, frames: number): Strip {
    const strip: Strip = { img: new Image(), ok: false, frames };
    strip.img.onload = () => {
      strip.ok = true;
      this.settle();
    };
    strip.img.onerror = () => this.settle();
    strip.img.src = src;
    return strip;
  }

  private settle(): void {
    if (++this.settled === this.total) this.ready = true;
  }

  update(dt: number, _moving: boolean): void {
    this.time += dt; // idle animates too, so the clock always runs
  }

  draw(ctx: CanvasRenderingContext2D, feetX: number, feetY: number, facing: Facing, moving: boolean): boolean {
    if (!this.ready) return false;
    const strip = moving ? this.run[facing]! : this.idle[facing]!;
    if (!strip.ok) return false;
    const fps = moving ? RUN_FPS : IDLE_FPS;
    const frame = Math.floor(this.time * fps) % strip.frames;
    const dx = Math.round(feetX - CELL); // figure is centred; 40px at 2x = 80, so -40
    const dy = Math.round(feetY - FEET_Y * 2);
    ctx.drawImage(strip.img, frame * CELL, 0, CELL, CELL, dx, dy, CELL * 2, CELL * 2);
    return true;
  }
}
