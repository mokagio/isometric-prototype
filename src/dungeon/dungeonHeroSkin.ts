import { assetUrl, loadSheet, type Sheet } from "./assets";
import type { Facing } from "./facing";
import { ZOOM } from "./grid";
import type { HeroAction, HeroSkin } from "./heroSkin";
import { ATTACK_DURATION } from "./swing";

// Pixel Poem "Dungeon Hero": one strip per animation and direction, 40x40
// frames, standing on cell-y 31. Unlike the tileset's own characters this one
// carries her sword through the attack strip, so no weapon is drawn on top.
const FRAME = 40;
const FEET_Y = 31;
// The strips are drawn to a taller figure than the 16px tileset people, so a
// step below the world zoom puts her on the same footing as the dungeon.
const SKIN_ZOOM = ZOOM - 1;

const FRAMES: Record<HeroAction, number> = { idle: 4, run: 6, attack: 7 };
const FPS: Record<HeroAction, number> = {
  idle: 6,
  run: 10,
  // Fitted to the swing rather than set outright, so the blade lands on the
  // frame the blow does however `ATTACK_DURATION` is tuned.
  attack: FRAMES.attack / ATTACK_DURATION,
};

// Indexed by Facing — the pack's own direction names, in the same order.
const DIRS = ["up", "left", "down", "right"] as const;
const ACTIONS: readonly HeroAction[] = ["idle", "run", "attack"];

export class DungeonHeroSkin implements HeroSkin {
  private strips = new Map<string, Sheet>();
  private settled = 0;
  private readonly total = DIRS.length * ACTIONS.length;
  ready = false;

  constructor(url: (path: string) => string = assetUrl) {
    const settle = (): void => {
      if (++this.settled === this.total) this.ready = true;
    };
    for (const action of ACTIONS) {
      for (const dir of DIRS) {
        const key = `${action}/${dir}`;
        this.strips.set(key, loadSheet(url(`rpg_hero/${action}/${action}_${dir}_40x40.png`), settle));
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
    const strip = this.strips.get(`${action}/${DIRS[facing]}`);
    if (!strip?.ok) return false;
    const count = FRAMES[action];
    const raw = Math.floor(actionTime * FPS[action]);
    // Attack plays once and holds its last frame; the rest loop.
    const frame = action === "attack" ? Math.min(raw, count - 1) : raw % count;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      strip.img,
      frame * FRAME,
      0,
      FRAME,
      FRAME,
      Math.round(feetX - (FRAME / 2) * SKIN_ZOOM),
      Math.round(feetY - FEET_Y * SKIN_ZOOM),
      FRAME * SKIN_ZOOM,
      FRAME * SKIN_ZOOM,
    );
    ctx.restore();
    return true;
  }
}
