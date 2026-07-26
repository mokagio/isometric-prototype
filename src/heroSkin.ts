import { HeroSprite, type Facing } from "./heroSprite";
import { DungeonHeroSkin } from "./dungeonHeroSkin";
import { OboroSkin } from "./oboroSkin";

export type HeroAction = "idle" | "run" | "attack";

// A hero skin owns one character's spritesheet(s) and knows how to draw it. All
// skins share the same mechanics — feet anchor, 4-way facing, animation timing —
// and differ only in sheet geometry, so they're interchangeable behind this
// switch. The caller owns the clock and passes `actionTime` (seconds elapsed in
// the current action); the skin maps that to a frame.
export interface HeroSkin {
  readonly ready: boolean;
  /** Draw the figure with its feet at (feetX, feetY). Returns false if not loaded. */
  draw(
    ctx: CanvasRenderingContext2D,
    feetX: number,
    feetY: number,
    facing: Facing,
    action: HeroAction,
    actionTime: number,
  ): boolean;
}

export type SkinKind = "soldier" | "slime" | "dungeon" | "lpc";

// The active hero art. Flip this to switch skins (surface in UI later);
// "slime" makes the player the same green blob the monsters use.
export const HERO_SKIN: SkinKind = "soldier";

export function createHeroSkin(kind: SkinKind = HERO_SKIN): HeroSkin {
  switch (kind) {
    case "slime":
      return new OboroSkin("slime");
    case "dungeon":
      return new DungeonHeroSkin();
    case "lpc":
      return new HeroSprite();
    case "soldier":
    default:
      return new OboroSkin("soldier");
  }
}
