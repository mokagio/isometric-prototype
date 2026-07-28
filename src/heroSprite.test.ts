import { beforeEach, describe, expect, it, vi } from "vitest";
import { CELL, FRAMES, facingFromAxis, HeroSprite, WALK_FPS, type Facing } from "./heroSprite";
import type { HeroAction } from "./heroSkin";

// `new Image()` is absent in the node test environment. Handlers attach before
// `src`, so nothing settles until a test fires it by hand.
let pending: FakeImage[] = [];

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin: string | null = null;
  src = "";

  constructor() {
    pending.push(this);
  }
}

vi.stubGlobal("Image", FakeImage);

beforeEach(() => {
  pending = [];
});

const loadAll = (): void => pending.forEach((i) => i.onload?.());

interface DrawCall {
  src: string;
  args: number[];
}

function recordingCtx(): { ctx: CanvasRenderingContext2D; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  const ctx = {
    drawImage(img: FakeImage, ...args: number[]) {
      calls.push({ src: img.src, args });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const BASE = "/lpc/";

/** A hero with every layer loaded. */
function ready(base = BASE): HeroSprite {
  const hero = new HeroSprite(base);
  loadAll();
  return hero;
}

/** The source-x of the first layer `draw` blits — the frame index times the cell. */
function frameX(hero: HeroSprite, action: HeroAction, t: number): number {
  const { ctx, calls } = recordingCtx();
  hero.draw(ctx, 0, 0, 2, action, t);
  return calls[0]!.args[0]!;
}

describe("HeroSprite loading", () => {
  it("requests every layer under the given base", () => {
    new HeroSprite(BASE);
    const srcs = pending.map((i) => i.src);
    expect(srcs.length).toBeGreaterThan(1);
    expect(srcs.every((s) => s.startsWith("/lpc/"))).toBe(true);
    expect(srcs).toContain("/lpc/body/bodies/male/walk.png");
  });

  it("loads the layers in zPos order, back to front", () => {
    new HeroSprite(BASE);
    expect(pending[0]!.src).toContain("universal_behind/walk/longsword.png");
    expect(pending.at(-1)!.src).toContain("weapon/sword/longsword/walk/longsword.png");
  });

  it("marks each layer cross-origin so a remote sheet is drawable", () => {
    new HeroSprite(BASE);
    expect(pending.every((i) => i.crossOrigin === "anonymous")).toBe(true);
  });

  it("is not ready until every layer has settled", () => {
    const hero = new HeroSprite(BASE);
    expect(hero.ready).toBe(false);
    pending[0]!.onload?.();
    expect(hero.ready).toBe(false);
    loadAll();
    expect(hero.ready).toBe(true);
  });

  it("declines to draw before the layers arrive", () => {
    const hero = new HeroSprite(BASE);
    const { ctx, calls } = recordingCtx();
    expect(hero.draw(ctx, 0, 0, 2, "idle", 0)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("draws one call per loaded layer, skipping any that 404'd", () => {
    const hero = new HeroSprite(BASE);
    const total = pending.length;
    pending[0]!.onerror?.(); // one layer drops
    pending.slice(1).forEach((i) => i.onload?.());
    expect(hero.ready).toBe(true);
    const { ctx, calls } = recordingCtx();
    hero.draw(ctx, 0, 0, 2, "run", 0);
    expect(calls).toHaveLength(total - 1);
  });
});

describe("HeroSprite frames", () => {
  it("holds the neutral frame for idle and attack", () => {
    const hero = ready();
    expect(frameX(hero, "idle", 0)).toBe(0);
    expect(frameX(hero, "idle", 5)).toBe(0);
    expect(frameX(hero, "attack", 5)).toBe(0);
  });

  it("walks frames 1..8 for the run cycle, never the neutral frame", () => {
    const hero = ready();
    expect(frameX(hero, "run", 0)).toBe(CELL); // frame 1
    expect(frameX(hero, "run", 1 / WALK_FPS)).toBe(2 * CELL);
  });

  it("loops the run cycle back to its first walk frame", () => {
    const hero = ready();
    // FRAMES-1 walk frames, so the cycle returns after that many steps.
    expect(frameX(hero, "run", (FRAMES - 1) / WALK_FPS)).toBe(frameX(hero, "run", 0));
  });
});

describe("HeroSprite facing", () => {
  it("takes the row matching the facing", () => {
    const hero = ready();
    for (let facing = 0; facing < 4; facing++) {
      const { ctx, calls } = recordingCtx();
      hero.draw(ctx, 0, 0, facing as Facing, "run", 0);
      expect(calls[0]!.args[1]).toBe(facing * CELL); // source-y is the facing's row
    }
  });
});

describe("HeroSprite anchoring", () => {
  it("centres the figure on the feet and stands it on them", () => {
    const hero = ready();
    const { ctx, calls } = recordingCtx();
    hero.draw(ctx, 300, 200, 2, "idle", 0);
    const [, , sw, , dx, dy, dw, dh] = calls[0]!.args;
    expect(dx! + dw! / 2).toBe(300);
    expect(dw).toBe(sw! * 2); // drawn at 2x to match the tile zoom
    expect(dy!).toBeLessThan(200);
    expect(dy! + dh!).toBeGreaterThan(200); // feet sit inside the cell
  });
});

describe("facingFromAxis", () => {
  it("is null when standing still", () => {
    expect(facingFromAxis(0, 0)).toBeNull();
  });

  it("picks up/down when screen-y dominates", () => {
    expect(facingFromAxis(1, 1)).toBe(2); // screen-down
    expect(facingFromAxis(-1, -1)).toBe(0); // screen-up
  });

  it("picks left/right when screen-x dominates", () => {
    expect(facingFromAxis(1, -1)).toBe(3); // screen-right
    expect(facingFromAxis(-1, 1)).toBe(1); // screen-left
  });
});
