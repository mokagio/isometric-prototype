import { beforeEach, describe, expect, it, vi } from "vitest";
import { CELL, FRAMES, facingFromAxis, HeroSprite, WALK_FPS, type Facing } from "./heroSprite";
import type { HeroAction } from "./heroSkin";
import { Input } from "./input";

/** Stands in for `window`, so held keys can drive the real axis without a DOM. */
class FakeTarget {
  private handlers = new Map<string, (e: never) => void>();

  addEventListener(type: string, handler: (e: never) => void): void {
    this.handlers.set(type, handler);
  }

  press(key: string): void {
    this.handlers.get("keydown")?.({ key, preventDefault: () => {} } as never);
  }
}

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

  it("turns sideways on a diagonal, which is mostly sideways on screen", () => {
    // Two keys held is a shallow diagonal: SX per screen-x step against SY per
    // screen-y step means twice as much travel across as up. Facing up or down
    // through that shows the hero's back while it slides across.
    expect(facingFromAxis(-2, 0)).toBe(1); // up and left
    expect(facingFromAxis(0, -2)).toBe(3); // up and right
    expect(facingFromAxis(0, 2)).toBe(1); // down and left
    expect(facingFromAxis(2, 0)).toBe(3); // down and right
  });

  it("keeps facing up or down when that is the whole of the movement", () => {
    // The one-key directions must not get swept up by the diagonal rule.
    expect(facingFromAxis(-3, -3)).toBe(0);
    expect(facingFromAxis(3, 3)).toBe(2);
  });

  it("turns sideways rather than face-on at exactly 45 degrees on screen", () => {
    // Half a screen-y step per screen-x step is the crossover, reachable by the
    // analog stick even though the keys cannot land on it.
    const dc = 1.5;
    const dr = 0.5; // screenX = 1 * SX, screenY = 2 * SY — equal in pixels
    expect(facingFromAxis(dc, dr)).toBe(3);
    expect(facingFromAxis(-dc, -dr)).toBe(1);
  });
});

describe("which way the hero faces for the keys you hold", () => {
  /** The facing after holding `keys`, through the real key-to-axis mapping. */
  const facingFor = (...keys: string[]): Facing | null => {
    const target = new FakeTarget();
    const input = new Input(target as unknown as Window);
    for (const key of keys) target.press(key);
    return facingFromAxis(input.axis.dc, input.axis.dr);
  };

  it("faces the single direction pressed", () => {
    expect(facingFor("ArrowUp")).toBe(0);
    expect(facingFor("ArrowLeft")).toBe(1);
    expect(facingFor("ArrowDown")).toBe(2);
    expect(facingFor("ArrowRight")).toBe(3);
  });

  it("turns to the side on every diagonal instead of walking on backwards", () => {
    expect(facingFor("ArrowUp", "ArrowLeft")).toBe(1);
    expect(facingFor("ArrowUp", "ArrowRight")).toBe(3);
    expect(facingFor("ArrowDown", "ArrowLeft")).toBe(1);
    expect(facingFor("ArrowDown", "ArrowRight")).toBe(3);
  });

  it("stands still facing nowhere in particular on opposing keys", () => {
    expect(facingFor("ArrowUp", "ArrowDown")).toBeNull();
    expect(facingFor("ArrowLeft", "ArrowRight")).toBeNull();
  });
});
