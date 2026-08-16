import { beforeEach, describe, expect, it, vi } from "vitest";
import { DOWN, LEFT } from "./facing";
import { MageSkin } from "./mageSkin";

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  static made: FakeImage[] = [];
  constructor() {
    FakeImage.made.push(this);
  }
}

/** Records what was blitted, so frame choice can be asserted without a canvas. */
const spyCtx = (): { ctx: CanvasRenderingContext2D; frames: number[]; flips: number } => {
  const frames: number[] = [];
  const state = { flips: 0 };
  const ctx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: (x: number) => {
      if (x < 0) state.flips++;
    },
    drawImage: (_img: unknown, sx: number) => frames.push(sx / 96),
    imageSmoothingEnabled: false,
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    frames,
    get flips() {
      return state.flips;
    },
  };
};

const loaded = (): MageSkin => {
  const skin = new MageSkin();
  for (const img of FakeImage.made) img.onload?.();
  return skin;
};

beforeEach(() => {
  FakeImage.made = [];
  vi.stubGlobal("Image", FakeImage);
});

describe("MageSkin loading", () => {
  it("loads a strip per action, plus the death strip", () => {
    new MageSkin();
    expect(FakeImage.made).toHaveLength(4);
  });

  // The site deploys to a project page served from /<repo>/, so a root-absolute
  // path 404s in production.
  it("prefixes every strip with the deploy base", () => {
    new MageSkin((path) => `/isometric-prototype/${path}`);
    const srcs = FakeImage.made.map((i) => i.src);
    for (const src of srcs) expect(src.startsWith("/isometric-prototype/oboro/mage/")).toBe(true);
    expect(srcs).toContain("/isometric-prototype/oboro/mage/death.png");
  });

  it("becomes ready once every strip has settled, failures included", () => {
    const skin = new MageSkin();
    expect(skin.ready).toBe(false);
    for (const img of FakeImage.made.slice(0, -1)) img.onload?.();
    expect(skin.ready).toBe(false);
    FakeImage.made.at(-1)?.onerror?.();
    expect(skin.ready).toBe(true);
  });
});

describe("MageSkin.draw", () => {
  it("declines to draw before its art has loaded", () => {
    const skin = new MageSkin();
    const spy = spyCtx();
    expect(skin.draw(spy.ctx, 0, 0, DOWN, "idle", 0)).toBe(false);
    expect(spy.frames).toHaveLength(0);
  });

  it("loops the idle and run cycles", () => {
    const skin = loaded();
    const spy = spyCtx();
    skin.draw(spy.ctx, 0, 0, DOWN, "idle", 0);
    skin.draw(spy.ctx, 0, 0, DOWN, "idle", 30); // well past the end of the strip
    expect(spy.frames[0]).toBe(0);
    expect(spy.frames[1]).toBeLessThan(6);
  });

  it("plays the attack once and holds its last frame", () => {
    const skin = loaded();
    const spy = spyCtx();
    skin.draw(spy.ctx, 0, 0, DOWN, "attack", 0);
    skin.draw(spy.ctx, 0, 0, DOWN, "attack", 5);
    expect(spy.frames[0]).toBe(0);
    expect(spy.frames[1]).toBe(7); // 8 frames, zero-indexed
  });

  // The art is drawn facing right, so only screen-left mirrors.
  it("mirrors only when heading left", () => {
    const skin = loaded();
    const spy = spyCtx();
    skin.draw(spy.ctx, 0, 0, DOWN, "idle", 0);
    expect(spy.flips).toBe(0);
    skin.draw(spy.ctx, 0, 0, LEFT, "idle", 0);
    expect(spy.flips).toBe(1);
  });
});

describe("MageSkin.drawDefeat", () => {
  it("plays the death once and stays down", () => {
    const skin = loaded();
    const spy = spyCtx();
    skin.drawDefeat(spy.ctx, 0, 0, DOWN, 0);
    skin.drawDefeat(spy.ctx, 0, 0, DOWN, 99);
    expect(spy.frames[0]).toBe(0);
    expect(spy.frames[1]).toBe(9); // 10 frames, zero-indexed
  });

  it("declines before its art has loaded, so the caller can fall back", () => {
    const skin = new MageSkin();
    expect(skin.drawDefeat(spyCtx().ctx, 0, 0, DOWN, 0)).toBe(false);
  });
});
