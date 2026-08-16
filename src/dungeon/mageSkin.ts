import { assetUrl, loadSheet, type Sheet } from "./assets";
import { LEFT, type Facing } from "./facing";
import { ZOOM } from "./grid";
import type { HeroAction, HeroSkin } from "./heroSkin";
import { ATTACK_DURATION } from "./swing";

// oboropixel "Characters Animations" mage: 96x96 frames, one animation per
// horizontal strip, drawn side-on facing right — so left is a horizontal flip
// and there is no up or down pose. She stands on cell-y 59 of the frame, and
// carries her staff through every strip, so no weapon is drawn on top.
const FRAME = 96;
const ANCHOR_X = 48; // frame centre
const ANCHOR_Y = 59; // feet baseline within the frame

const ANIM: Record<HeroAction, { file: string; frames: number; fps: number }> = {
  idle: { file: "idle.png", frames: 6, fps: 8 },
  run: { file: "walk.png", frames: 8, fps: 12 },
  // Fitted to the swing rather than set outright, so the staff lands its blow on
  // the frame the blow does however `ATTACK_DURATION` is tuned.
  attack: { file: "attack.png", frames: 8, fps: 8 / ATTACK_DURATION },
};

// Played through `drawDefeat` rather than the shared action set, so a skin
// without a death strip needn't carry one. Holds its last frame — the body.
const DEATH = { file: "death.png", frames: 10, fps: 10 };

export class MageSkin implements HeroSkin {
  private sheets = new Map<string, Sheet>();
  private settled = 0;
  private readonly total = Object.keys(ANIM).length + 1;
  ready = false;

  constructor(url: (path: string) => string = assetUrl) {
    const settle = (): void => {
      if (++this.settled === this.total) this.ready = true;
    };
    for (const [action, def] of Object.entries(ANIM)) {
      this.sheets.set(action, loadSheet(url(`oboro/mage/${def.file}`), settle));
    }
    this.sheets.set("death", loadSheet(url(`oboro/mage/${DEATH.file}`), settle));
  }

  private blit(
    ctx: CanvasRenderingContext2D,
    sheet: Sheet,
    frame: number,
    feetX: number,
    feetY: number,
    facing: Facing,
  ): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(feetX), Math.round(feetY));
    if (facing === LEFT) ctx.scale(-1, 1);
    ctx.drawImage(
      sheet.img,
      frame * FRAME,
      0,
      FRAME,
      FRAME,
      -ANCHOR_X * ZOOM,
      -ANCHOR_Y * ZOOM,
      FRAME * ZOOM,
      FRAME * ZOOM,
    );
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
    const sheet = this.sheets.get(action);
    if (!sheet?.ok) return false;
    const def = ANIM[action];
    const raw = Math.floor(actionTime * def.fps);
    // Attack plays once and holds its last frame; the rest loop.
    const frame = action === "attack" ? Math.min(raw, def.frames - 1) : raw % def.frames;
    this.blit(ctx, sheet, frame, feetX, feetY, facing);
    return true;
  }

  drawDefeat(
    ctx: CanvasRenderingContext2D,
    feetX: number,
    feetY: number,
    facing: Facing,
    t: number,
  ): boolean {
    const sheet = this.sheets.get("death");
    if (!sheet?.ok) return false;
    this.blit(ctx, sheet, Math.min(DEATH.frames - 1, Math.floor(t * DEATH.fps)), feetX, feetY, facing);
    return true;
  }
}
