import type { Facing } from "./heroSprite";
import type { HeroAction, HeroSkin } from "./heroSkin";
import { frameAt, SheetLoader, type Sheet } from "./sprites";

// Pixel Poem "Dungeon Hero" (RPG_Hero). Vendored under public/ — its licence
// permits use and modification (see CREDITS.md). One strip per animation and
// direction, 40x40 frames, feet at cell-y 31.
const CELL = 40;
const FEET_Y = 31;

// Frames per strip and playback rate, per action.
const ANIM: Record<HeroAction, { frames: number; fps: number; loop: boolean }> = {
  idle: { frames: 4, fps: 6, loop: true },
  run: { frames: 6, fps: 10, loop: true },
  attack: { frames: 7, fps: 14, loop: false },
};

// Indexed by Facing (0=up, 1=left, 2=down, 3=right) — the pack's own direction names.
const DIRS = ["up", "left", "down", "right"] as const;
// `BASE_URL` (always trailing-slashed) is "/" in dev and "/<repo>/" on the
// Pages build. A literal "/rpg_hero/" would 404 there.
const BASE = `${import.meta.env.BASE_URL}rpg_hero/`;

export class DungeonHeroSkin implements HeroSkin {
  private strips: Record<HeroAction, Sheet[]> = { idle: [], run: [], attack: [] };
  private loader = new SheetLoader(DIRS.length * Object.keys(ANIM).length);

  get ready(): boolean {
    return this.loader.ready;
  }

  constructor(base = BASE) {
    for (const action of Object.keys(ANIM) as HeroAction[]) {
      for (let f = 0; f < DIRS.length; f++) {
        this.strips[action][f] = this.loader.load(`${base}${action}/${action}_${DIRS[f]}_40x40.png`);
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    feetX: number,
    feetY: number,
    facing: Facing,
    action: HeroAction,
    actionTime: number,
  ): boolean {
    if (!this.ready) return false;
    const strip = this.strips[action][facing]!;
    if (!strip.ok) return false;
    const anim = ANIM[action];
    const frame = frameAt(actionTime, anim.fps, anim.frames, anim.loop);
    const dx = Math.round(feetX - CELL); // figure is centred; 40px at 2x = 80, so -40
    const dy = Math.round(feetY - FEET_Y * 2);
    ctx.drawImage(strip.img, frame * CELL, 0, CELL, CELL, dx, dy, CELL * 2, CELL * 2);
    return true;
  }
}
