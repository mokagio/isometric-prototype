import { beforeEach, describe, expect, it, vi } from "vitest";
import { DungeonHeroSkin } from "./dungeonHeroSkin";
import type { HeroAction } from "./heroSkin";
import type { Facing } from "./heroSprite";

// Strips load through `new Image()`, which the node test environment lacks.
// Handlers are attached before `src`, so nothing fires until a test says so.
let pending: FakeImage[] = [];

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
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
const failAll = (): void => pending.forEach((i) => i.onerror?.());

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

const BASE = "/rpg_hero/";

/** A skin with every strip loaded. */
function ready(base = BASE): DungeonHeroSkin {
  const skin = new DungeonHeroSkin(base);
  loadAll();
  return skin;
}

/** The source-x `draw` picks, which is the frame index times the cell width. */
function frameX(skin: DungeonHeroSkin, action: HeroAction, t: number): number {
  const { ctx, calls } = recordingCtx();
  skin.draw(ctx, 0, 0, 2, action, t);
  return calls[0]!.args[0]!;
}

describe("DungeonHeroSkin loading", () => {
  it("requests one distinct strip per action and facing", () => {
    new DungeonHeroSkin(BASE);
    const srcs = pending.map((i) => i.src);
    expect(srcs).toHaveLength(12); // 3 actions x 4 facings
    expect(new Set(srcs).size).toBe(12);
    expect(srcs).toContain("/rpg_hero/idle/idle_down_40x40.png");
  });

  it("takes its default base from the deploy base URL", async () => {
    // A project page serves from /<repo>/, so a hardcoded root path 404s there.
    vi.stubEnv("BASE_URL", "/isometric-prototype/");
    vi.resetModules();
    const { DungeonHeroSkin: Fresh } = await import("./dungeonHeroSkin");
    pending = [];
    new Fresh();

    expect(pending).toHaveLength(12);
    for (const img of pending) {
      expect(img.src.startsWith("/isometric-prototype/rpg_hero/")).toBe(true);
    }

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is not ready until every strip has settled", () => {
    const skin = new DungeonHeroSkin("/");
    expect(skin.ready).toBe(false);
    pending[0]!.onload?.();
    expect(skin.ready).toBe(false);
    loadAll();
    expect(skin.ready).toBe(true);
  });

  it("declines to draw before the strips arrive", () => {
    const skin = new DungeonHeroSkin("/");
    const { ctx, calls } = recordingCtx();
    expect(skin.draw(ctx, 0, 0, 2, "idle", 0)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("settles, but still declines to draw, when the strips 404", () => {
    const skin = new DungeonHeroSkin("/");
    failAll();
    expect(skin.ready).toBe(true);
    const { ctx, calls } = recordingCtx();
    expect(skin.draw(ctx, 0, 0, 2, "idle", 0)).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("DungeonHeroSkin frames", () => {
  it("loops the idle cycle back to its first frame", () => {
    const skin = ready();
    const first = frameX(skin, "idle", 0);
    expect(frameX(skin, "idle", 1 / 6)).toBeGreaterThan(first);
    expect(frameX(skin, "idle", 4 / 6)).toBe(first); // 4 frames at 6fps
  });

  it("loops the run cycle", () => {
    const skin = ready();
    expect(frameX(skin, "run", 6 / 10)).toBe(frameX(skin, "run", 0)); // 6 frames at 10fps
  });

  it("holds the attack on its last frame instead of looping", () => {
    const skin = ready();
    const last = frameX(skin, "attack", 6 / 14); // 7 frames at 14fps, zero-indexed
    expect(frameX(skin, "attack", 7 / 14)).toBe(last);
    expect(frameX(skin, "attack", 100)).toBe(last);
    expect(last).toBeGreaterThan(frameX(skin, "attack", 0));
  });

  it("advances one cell width per frame", () => {
    const skin = ready();
    const step = frameX(skin, "idle", 1 / 6) - frameX(skin, "idle", 0);
    expect(frameX(skin, "idle", 2 / 6) - frameX(skin, "idle", 1 / 6)).toBe(step);
  });
});

describe("DungeonHeroSkin facing", () => {
  const NAMES = ["up", "left", "down", "right"];

  it("picks the strip matching the facing", () => {
    const skin = ready();
    for (let facing = 0; facing < 4; facing++) {
      const { ctx, calls } = recordingCtx();
      skin.draw(ctx, 0, 0, facing as Facing, "run", 0);
      expect(calls[0]!.src).toBe(`/rpg_hero/run/run_${NAMES[facing]}_40x40.png`);
    }
  });

  it("picks the strip matching the action", () => {
    const skin = ready();
    for (const action of ["idle", "run", "attack"] as HeroAction[]) {
      const { ctx, calls } = recordingCtx();
      skin.draw(ctx, 0, 0, 2, action, 0);
      expect(calls[0]!.src).toBe(`/rpg_hero/${action}/${action}_down_40x40.png`);
    }
  });
});

describe("DungeonHeroSkin anchoring", () => {
  it("centres the figure on the feet and stands it on them", () => {
    const skin = ready();
    const { ctx, calls } = recordingCtx();
    skin.draw(ctx, 300, 200, 2, "idle", 0);
    const [, , sw, , dx, dy, dw, dh] = calls[0]!.args;
    expect(dx! + dw! / 2).toBe(300);
    expect(dw).toBe(sw! * 2); // drawn at 2x to match the tile zoom
    expect(dy!).toBeLessThan(200);
    expect(dy! + dh!).toBeGreaterThan(200); // feet sit inside the cell, not on its bottom edge
  });
});
