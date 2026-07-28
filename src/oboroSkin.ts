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

// Death is played through `drawDefeat`, not the shared action set, so skins
// without a death sheet needn't carry one. Plays once and holds the last frame
// (the fallen body).
const DEATH = { file: "death.png", frames: 10, fps: 10 };

interface Sheet {
  img: HTMLImageElement;
  ok: boolean;
  frames: number;
  fps: number;
  loop: boolean;
}

export class OboroSkin implements HeroSkin {
  private sheets: Record<HeroAction, Sheet>;
  private deathSheet: Sheet;
  private settled = 0;
  private readonly total = 4;
  ready = false;

  constructor(character: string, base: string = import.meta.env.BASE_URL) {
    const load = (file: string, frames: number, fps: number, loop: boolean): Sheet => {
      const sheet: Sheet = { img: new Image(), ok: false, frames, fps, loop };
      sheet.img.onload = () => {
        sheet.ok = true;
        this.settle();
      };
      sheet.img.onerror = () => this.settle();
      sheet.img.src = `${base}oboro/${character}/${file}`;
      return sheet;
    };
    const anim = (action: HeroAction): Sheet => {
      const def = ANIM[action];
      return load(def.file, def.frames, def.fps, def.loop);
    };
    this.sheets = { idle: anim("idle"), run: anim("run"), attack: anim("attack") };
    this.deathSheet = load(DEATH.file, DEATH.frames, DEATH.fps, false);
  }

  private settle(): void {
    if (++this.settled === this.total) this.ready = true;
  }

  private blit(
    ctx: CanvasRenderingContext2D,
    sheet: Sheet,
    frame: number,
    feetX: number,
    feetY: number,
    facing: Facing,
  ): void {
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
    this.blit(ctx, sheet, frame, feetX, feetY, facing);
    return true;
  }

  /** Play the fall-down death once (seconds since defeat), holding the last frame. */
  drawDefeat(ctx: CanvasRenderingContext2D, feetX: number, feetY: number, facing: Facing, t: number): boolean {
    const sheet = this.deathSheet;
    if (!sheet.ok) return false;
    const frame = Math.min(sheet.frames - 1, Math.floor(t * sheet.fps));
    this.blit(ctx, sheet, frame, feetX, feetY, facing);
    return true;
  }
}
