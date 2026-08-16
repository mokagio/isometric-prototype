import type { Atlas, TileName } from "./atlas";
import { LEFT, type Facing } from "./facing";
import { ZOOM } from "./grid";
import type { HeroAction, HeroSkin } from "./heroSkin";
import { ATTACK_DURATION } from "./swing";

// The tileset's own `elf_f`, drawn side-on: left is a horizontal flip and there
// is no up or down pose. The sheet gives her idle, run and a single hit frame;
// there is no attack animation, because 0x72 draws every character empty-handed
// and expects the weapon to be its own sprite. So the swing is the sword.

const FRAME_W = 16;
const FRAME_H = 28; // the figure stands on the bottom edge
const FIGURE_H = 16; // what she actually fills of that frame — the rest is headroom

const IDLE: readonly TileName[] = [
  "elf_f_idle_anim_f0",
  "elf_f_idle_anim_f1",
  "elf_f_idle_anim_f2",
  "elf_f_idle_anim_f3",
];
const RUN: readonly TileName[] = [
  "elf_f_run_anim_f0",
  "elf_f_run_anim_f1",
  "elf_f_run_anim_f2",
  "elf_f_run_anim_f3",
];
const DOWN_POSE: TileName = "elf_f_hit_anim_f0";

const IDLE_FPS = 8;
const RUN_FPS = 12;

export const SWORD: TileName = "weapon_golden_sword";
// A whole step below her own zoom, kept integer so the blade's pixels stay square.
const SWORD_ZOOM = ZOOM - 1;
// The blade's midpoint rides at half her height, so it sits across the middle of
// her and reads as carried. Anchoring the hilt at hand height instead is what
// left it towering over her head — the pack draws swords about as tall as the
// people holding them, so a hilt at her waist puts the tip past her hair.
const SWORD_CENTRE = 0.5;
// Sideways from her centre, in her own sheet pixels; the grip is the point the
// blade turns about, in the sword sprite's.
const HAND_X = 5;
const GRIP_X = 5;
const GRIP_Y = 20;

const REST_ANGLE = 0.5; // radians — the blade tipped back off her shoulder
const SWING_FROM = -0.7;
const SWING_TO = 2.1; // past horizontal, so the arc finishes low and in front

const FALL_ANGLE = 1.4; // radians the body tips over as she goes down
const FALL_TIME = 0.5; // seconds the tipping takes

const rad = (from: number, to: number, t: number): number => from + (to - from) * t;

export class ElfSkin implements HeroSkin {
  /** Where the grip sits above her feet, for the blade to come out centred. */
  private readonly gripY: number;

  constructor(private atlas: Atlas) {
    const drawnH = atlas.size(SWORD).h * SWORD_ZOOM;
    this.gripY = -SWORD_CENTRE * FIGURE_H * ZOOM + GRIP_Y * SWORD_ZOOM - drawnH / 2;
  }

  private body(
    ctx: CanvasRenderingContext2D,
    tile: TileName,
    feetX: number,
    feetY: number,
    facing: Facing,
    tilt: number,
  ): void {
    ctx.save();
    ctx.translate(Math.round(feetX), Math.round(feetY));
    if (facing === LEFT) ctx.scale(-1, 1);
    if (tilt !== 0) ctx.rotate(tilt);
    this.atlas.draw(ctx, tile, (-FRAME_W / 2) * ZOOM, -FRAME_H * ZOOM, ZOOM);
    ctx.restore();
  }

  private sword(
    ctx: CanvasRenderingContext2D,
    feetX: number,
    feetY: number,
    facing: Facing,
    angle: number,
  ): void {
    ctx.save();
    ctx.translate(Math.round(feetX), Math.round(feetY));
    if (facing === LEFT) ctx.scale(-1, 1);
    ctx.translate(HAND_X * ZOOM, this.gripY);
    ctx.rotate(angle);
    this.atlas.draw(ctx, SWORD, -GRIP_X * SWORD_ZOOM, -GRIP_Y * SWORD_ZOOM, SWORD_ZOOM);
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
    if (!this.atlas.sheet.ok) return false;
    const strip = action === "run" ? RUN : IDLE;
    const fps = action === "run" ? RUN_FPS : IDLE_FPS;
    const tile = strip[Math.floor(actionTime * fps) % strip.length]!;
    const swing = action === "attack" ? Math.min(1, actionTime / ATTACK_DURATION) : null;
    // Behind her on the wind-up, in front of her once the arc comes round.
    const angle = swing === null ? REST_ANGLE : rad(SWING_FROM, SWING_TO, swing);
    if (angle < 0) this.sword(ctx, feetX, feetY, facing, angle);
    this.body(ctx, tile, feetX, feetY, facing, 0);
    if (angle >= 0) this.sword(ctx, feetX, feetY, facing, angle);
    return true;
  }

  /** The fall-down pose: she tips over from her own feet and stays down. */
  drawDefeat(
    ctx: CanvasRenderingContext2D,
    feetX: number,
    feetY: number,
    facing: Facing,
    t: number,
  ): boolean {
    if (!this.atlas.sheet.ok) return false;
    // Applied inside the mirror, so she always tips backwards.
    this.body(ctx, DOWN_POSE, feetX, feetY, facing, FALL_ANGLE * Math.min(1, t / FALL_TIME));
    return true;
  }
}
