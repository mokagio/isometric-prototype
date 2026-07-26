import { HeroSprite, type Facing } from "./heroSprite";
import { DungeonHeroSkin } from "./dungeonHeroSkin";

// A hero skin owns one character's spritesheet(s) and knows how to draw it. All
// skins share the same mechanics — feet anchor, 4-way facing, walk timing — and
// differ only in sheet geometry, so they're interchangeable behind this switch.
export interface HeroSkin {
  readonly ready: boolean;
  update(dt: number, moving: boolean): void;
  /** Draw the figure with its feet at (feetX, feetY). Returns false if not loaded. */
  draw(ctx: CanvasRenderingContext2D, feetX: number, feetY: number, facing: Facing, moving: boolean): boolean;
}

export type SkinKind = "lpc" | "dungeon";

// The active hero art. Flip this to switch skins (surface in UI later).
export const HERO_SKIN: SkinKind = "dungeon";

export function createHeroSkin(kind: SkinKind = HERO_SKIN): HeroSkin {
  switch (kind) {
    case "dungeon":
      return new DungeonHeroSkin();
    case "lpc":
    default:
      return new HeroSprite();
  }
}
