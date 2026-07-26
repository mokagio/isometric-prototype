import type { Facing } from "./heroSprite";
import type { HeroAction, HeroSkin } from "./heroSkin";

// oboropixel "Free Characters Animations" pack (public/oboro/<character>/).
// 96x96 frames, one row per animation (a horizontal strip), side-view facing
// right — so left/right is a horizontal flip and there is no up/down facing.
const CELL = 96;
const SCALE = 3;
const ANCHOR_X = 48; // frame centre
const ANCHOR_Y = 57; // feet baseline within the 96px frame

const ANIM: Record<HeroAction, { file: string; frames: number; fps: number; loop: boolean }> = {
  idle: { file: "idle.png", frames: 6, fps: 8, loop: true },
  run: { file: "walk.png", frames: 8, fps: 12, loop: true },
  attack: { file: "attack.png", frames: 8, fps: 16, loop: false },
};

interface Sheet {
  img: HTMLImageElement;
  ok: boolean;
  frames: number;
  fps: number;
  loop: boolean;
}

export class OboroSkin implements HeroSkin {
  private sheets: Record<HeroAction, Sheet>;
  private settled = 0;
  private readonly total = 3;
  ready = false;

  constructor(character: string, base: string = import.meta.env.BASE_URL) {
    const load = (action: HeroAction): Sheet => {
      const def = ANIM[action];
      const sheet: Sheet = { img: new Image(), ok: false, frames: def.frames, fps: def.fps, loop: def.loop };
      sheet.img.onload = () => {
        sheet.ok = true;
        this.settle();
      };
      sheet.img.onerror = () => this.settle();
      sheet.img.src = `${base}oboro/${character}/${def.file}`;
      return sheet;
    };
    this.sheets = { idle: load("idle"), run: load("run"), attack: load("attack") };
  }

  private settle(): void {
    if (++this.settled === this.total) this.ready = true;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    feetX: number,
    feetY: number,
    facing: Facing,
    action: HeroAction,
    actionTime: number,
  ): boolean {
    const sheet = this.sheets[action];
    if (!sheet.ok) return false;
    const raw = Math.floor(actionTime * sheet.fps);
    const frame = sheet.loop ? raw % sheet.frames : Math.min(raw, sheet.frames - 1);
    const dx = Math.round(feetX - ANCHOR_X * SCALE);
    const dy = Math.round(feetY - ANCHOR_Y * SCALE);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (facing === 1) {
      // Heading screen-left: mirror horizontally around the feet.
      ctx.translate(feetX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-feetX, 0);
    }
    ctx.drawImage(sheet.img, frame * CELL, 0, CELL, CELL, dx, dy, CELL * SCALE, CELL * SCALE);
    ctx.restore();
    return true;
  }
}
