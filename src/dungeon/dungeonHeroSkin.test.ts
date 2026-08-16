import { beforeEach, describe, expect, it, vi } from "vitest";
import { DungeonHeroSkin } from "./dungeonHeroSkin";

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  static made: FakeImage[] = [];
  constructor() {
    FakeImage.made.push(this);
  }
}

beforeEach(() => {
  FakeImage.made = [];
  vi.stubGlobal("Image", FakeImage);
});

describe("DungeonHeroSkin loading", () => {
  it("loads a strip per action and direction", () => {
    new DungeonHeroSkin();
    expect(FakeImage.made).toHaveLength(12);
  });

  // The site deploys to a project page served from /<repo>/, so a root-absolute
  // path 404s in production.
  it("prefixes every strip with the deploy base", () => {
    new DungeonHeroSkin((path) => `/isometric-prototype/${path}`);
    const srcs = FakeImage.made.map((i) => i.src);
    for (const src of srcs) expect(src.startsWith("/isometric-prototype/rpg_hero/")).toBe(true);
    expect(srcs).toContain("/isometric-prototype/rpg_hero/attack/attack_left_40x40.png");
    expect(srcs).toContain("/isometric-prototype/rpg_hero/idle/idle_up_40x40.png");
  });

  it("becomes ready once every strip has settled, failures included", () => {
    const skin = new DungeonHeroSkin();
    expect(skin.ready).toBe(false);
    for (const img of FakeImage.made.slice(0, -1)) img.onload?.();
    expect(skin.ready).toBe(false);
    FakeImage.made.at(-1)?.onerror?.();
    expect(skin.ready).toBe(true);
  });
});

describe("DungeonHeroSkin.draw", () => {
  /** Records what was blitted, so frame choice can be asserted without a canvas. */
  const spyCtx = (): { ctx: CanvasRenderingContext2D; frames: number[] } => {
    const frames: number[] = [];
    const ctx = {
      save: () => {},
      restore: () => {},
      drawImage: (_img: unknown, sx: number) => frames.push(sx / 40),
      imageSmoothingEnabled: false,
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, frames };
  };

  it("declines to draw before its art has loaded", () => {
    const skin = new DungeonHeroSkin();
    const { ctx, frames } = spyCtx();
    expect(skin.draw(ctx, 0, 0, 2, "idle", 0)).toBe(false);
    expect(frames).toHaveLength(0);
  });

  it("loops the idle and run cycles", () => {
    const skin = new DungeonHeroSkin();
    for (const img of FakeImage.made) img.onload?.();
    const { ctx, frames } = spyCtx();
    skin.draw(ctx, 0, 0, 2, "idle", 0);
    skin.draw(ctx, 0, 0, 2, "idle", 10); // well past the end of the strip
    expect(frames[0]).toBe(0);
    expect(frames[1]).toBeLessThan(4);
  });

  it("plays the attack once and holds its last frame", () => {
    const skin = new DungeonHeroSkin();
    for (const img of FakeImage.made) img.onload?.();
    const { ctx, frames } = spyCtx();
    skin.draw(ctx, 0, 0, 2, "attack", 0);
    skin.draw(ctx, 0, 0, 2, "attack", 5);
    expect(frames[0]).toBe(0);
    expect(frames[1]).toBe(6); // 7 frames, zero-indexed
  });
});
