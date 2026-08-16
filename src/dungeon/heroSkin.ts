import type { Atlas } from "./atlas";
import { DungeonHeroSkin } from "./dungeonHeroSkin";
import { ElfSkin } from "./elfSkin";
import type { Facing } from "./facing";
import { MageSkin } from "./mageSkin";

export type HeroAction = "idle" | "run" | "attack";

/**
 * A hero skin owns one character's art and knows how to draw it. Every skin
 * shares the same mechanics — feet anchor, four-way facing, animation timing —
 * and differs only in sheet geometry and in where its weapon comes from, so they
 * are interchangeable behind `createHeroSkin`.
 *
 * The caller owns the clock and passes `actionTime`, the seconds elapsed in the
 * current action; the skin maps that to a frame.
 */
export interface HeroSkin {
  /** Draw the figure with her feet at (feetX, feetY). False if the art has not loaded. */
  draw(
    ctx: CanvasRenderingContext2D,
    feetX: number,
    feetY: number,
    facing: Facing,
    action: HeroAction,
    actionTime: number,
  ): boolean;
  /**
   * Play the defeat animation `t` seconds after going down, if this skin has
   * one. Returns false when it doesn't, so the caller can fall back to idle.
   */
  drawDefeat?(
    ctx: CanvasRenderingContext2D,
    feetX: number,
    feetY: number,
    facing: Facing,
    t: number,
  ): boolean;
}

export type SkinKind = "mage" | "dungeon" | "elf";

/** In menu order. The first is the default for a first visit. */
export const SKINS: ReadonlyArray<{ kind: SkinKind; label: string }> = [
  { kind: "mage", label: "Mage" },
  { kind: "dungeon", label: "Elf" },
  { kind: "elf", label: "Green" },
];

export const HERO_SKIN: SkinKind = SKINS[0]!.kind;

export function createHeroSkin(atlas: Atlas, kind: SkinKind = HERO_SKIN): HeroSkin {
  switch (kind) {
    case "elf":
      return new ElfSkin(atlas);
    case "dungeon":
      return new DungeonHeroSkin();
    case "mage":
    default:
      return new MageSkin();
  }
}
