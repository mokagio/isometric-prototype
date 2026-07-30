import type { Facing } from "./heroSprite";
import type { HeroAction, HeroSkin } from "./heroSkin";
import { blitFrame, frameAt, SheetLoader, type Sheet } from "./sprites";

// oboropixel "Free Characters Animations" pack (public/oboro/<character>/).
// 96x96 frames, one row per animation (a horizontal strip). The figure faces the
// camera with its weapon out to the **screen-left**, and there is no up/down
// facing — so mirroring is what sends it right, and heading left is the art as
// drawn. Mirror it the other way round and the hero walks backwards.
export const CELL = 96;
const SCALE = 3;
const ANCHOR_X = 48; // frame centre
const ANCHOR_Y = 57; // feet baseline within the 96px frame

export const ANIM: Record<HeroAction, { file: string; frames: number; fps: number; loop: boolean }> = {
  idle: { file: "idle.png", frames: 6, fps: 8, loop: true },
  run: { file: "walk.png", frames: 8, fps: 12, loop: true },
  attack: { file: "attack.png", frames: 8, fps: 16, loop: false },
};

// Death is played through `drawDefeat`, not the shared action set, so skins
// without a death sheet needn't carry one. Plays once and holds the last frame
// (the fallen body).
export const DEATH = { file: "death.png", frames: 10, fps: 10 };

export class OboroSkin implements HeroSkin {
  private sheets: Record<HeroAction, Sheet>;
  private deathSheet: Sheet;
  private loader = new SheetLoader(4);

  get ready(): boolean {
    return this.loader.ready;
  }

  constructor(character: string, base: string = import.meta.env.BASE_URL) {
    const load = (file: string): Sheet => this.loader.load(`${base}oboro/${character}/${file}`);
    this.sheets = { idle: load(ANIM.idle.file), run: load(ANIM.run.file), attack: load(ANIM.attack.file) };
    this.deathSheet = load(DEATH.file);
  }

  private blit(ctx: CanvasRenderingContext2D, sheet: Sheet, frame: number, feetX: number, feetY: number, facing: Facing): void {
    blitFrame(ctx, sheet.img, feetX, feetY, {
      cell: CELL,
      scale: SCALE,
      anchorX: ANCHOR_X,
      anchorY: ANCHOR_Y,
      frame,
      flip: facing === 3, // heading screen-right; up and down keep the art as drawn
    });
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
    const def = ANIM[action];
    this.blit(ctx, sheet, frameAt(actionTime, def.fps, def.frames, def.loop), feetX, feetY, facing);
    return true;
  }

  /** Play the fall-down death once (seconds since defeat), holding the last frame. */
  drawDefeat(ctx: CanvasRenderingContext2D, feetX: number, feetY: number, facing: Facing, t: number): boolean {
    const sheet = this.deathSheet;
    if (!sheet.ok) return false;
    this.blit(ctx, sheet, frameAt(t, DEATH.fps, DEATH.frames, false), feetX, feetY, facing);
    return true;
  }
}
