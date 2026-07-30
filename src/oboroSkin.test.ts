import { beforeEach, describe, expect, it, vi } from "vitest";
import { ANIM, CELL, DEATH, OboroSkin } from "./oboroSkin";
import type { HeroAction } from "./heroSkin";
import type { Facing } from "./heroSprite";

// `new Image()` is absent in the node test environment. Handlers attach before
// `src`, so nothing settles until a test fires it by hand.
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

interface DrawCall {
  src: string;
  args: number[];
  mirrored: boolean;
}

function recordingCtx(): { ctx: CanvasRenderingContext2D; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
  let mirrored = false;
  const ctx = {
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    save() {},
    restore() {
      mirrored = false;
    },
    translate() {},
    scale(x: number) {
      if (x < 0) mirrored = true;
    },
    drawImage(img: FakeImage, ...args: number[]) {
      calls.push({ src: img.src, args, mirrored });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const BASE = "/";
const DOWN: Facing = 2; // any non-left facing, so the sprite is not mirrored

/** A skin with every sheet loaded. */
function ready(character = "soldier", base = BASE): OboroSkin {
  const skin = new OboroSkin(character, base);
  loadAll();
  return skin;
}

/** The source-x `draw` picks for an action — the frame index times the cell. */
function frameX(skin: OboroSkin, action: HeroAction, t: number): number {
  const { ctx, calls } = recordingCtx();
  skin.draw(ctx, 0, 0, DOWN, action, t);
  return calls[0]!.args[0]!;
}

describe("OboroSkin loading", () => {
  it("requests one sheet per action plus death, under the character path", () => {
    new OboroSkin("soldier", BASE);
    const srcs = pending.map((i) => i.src);
    expect(srcs).toHaveLength(4);
    expect(srcs).toContain("/oboro/soldier/walk.png");
    expect(srcs).toContain("/oboro/soldier/death.png");
  });

  it("prefixes the sheet paths with the given base and character", () => {
    new OboroSkin("slime", "/isometric-prototype/");
    for (const img of pending) {
      expect(img.src.startsWith("/isometric-prototype/oboro/slime/")).toBe(true);
    }
  });

  it("takes its default base from the deploy base URL", async () => {
    // A project page serves from /<repo>/, so a hardcoded root path 404s there.
    vi.stubEnv("BASE_URL", "/isometric-prototype/");
    vi.resetModules();
    const { OboroSkin: Fresh } = await import("./oboroSkin");
    pending = [];
    new Fresh("soldier");

    expect(pending).toHaveLength(4);
    for (const img of pending) {
      expect(img.src.startsWith("/isometric-prototype/oboro/soldier/")).toBe(true);
    }

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is not ready until every sheet has settled", () => {
    const skin = new OboroSkin("soldier", BASE);
    expect(skin.ready).toBe(false);
    pending[0]!.onload?.();
    expect(skin.ready).toBe(false);
    loadAll();
    expect(skin.ready).toBe(true);
  });

  it("declines to draw an action whose sheet has not arrived", () => {
    const skin = new OboroSkin("soldier", BASE);
    const { ctx, calls } = recordingCtx();
    expect(skin.draw(ctx, 0, 0, DOWN, "idle", 0)).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("OboroSkin frames", () => {
  it("advances one cell per frame and loops the run cycle", () => {
    const skin = ready();
    expect(frameX(skin, "run", 1 / ANIM.run.fps)).toBe(CELL);
    expect(frameX(skin, "run", ANIM.run.frames / ANIM.run.fps)).toBe(frameX(skin, "run", 0));
  });

  it("holds the attack on its last frame instead of looping", () => {
    const skin = ready();
    const last = (ANIM.attack.frames - 1) * CELL;
    expect(frameX(skin, "attack", (ANIM.attack.frames - 1) / ANIM.attack.fps)).toBe(last);
    expect(frameX(skin, "attack", 100)).toBe(last);
  });
});

describe("OboroSkin facing", () => {
  /** Draws `facing` on `skin` and reports whether the sprite came out mirrored. */
  const mirroredFor = (skin: OboroSkin, facing: Facing): boolean => {
    const { ctx, calls } = recordingCtx();
    skin.draw(ctx, 0, 0, facing, "run", 0);
    return calls[0]!.mirrored;
  };

  it("mirrors the sprite only when heading screen-left", () => {
    const skin = ready();
    expect(mirroredFor(skin, 1)).toBe(true);
    expect(mirroredFor(skin, 3)).toBe(false);
  });

  it("faces as drawn before it has been anywhere", () => {
    // An idle figure at spawn is handed a vertical facing and must look the same
    // as it always has, rather than starting out mirrored.
    expect(mirroredFor(ready(), 2)).toBe(false);
  });

  it("keeps heading the way it last went across while walking straight up or down", () => {
    // The sheets have no up or down frames. Falling back to the art as drawn
    // would flip a figure that was walking left the moment it turned upward.
    const skin = ready();
    expect(mirroredFor(skin, 1)).toBe(true);
    expect(mirroredFor(skin, 0)).toBe(true);
    expect(mirroredFor(skin, 2)).toBe(true);

    expect(mirroredFor(skin, 3)).toBe(false);
    expect(mirroredFor(skin, 0)).toBe(false);
    expect(mirroredFor(skin, 2)).toBe(false);
  });

  it("turns the moment it heads across the screen again", () => {
    const skin = ready();
    mirroredFor(skin, 1);
    mirroredFor(skin, 0);
    expect(mirroredFor(skin, 3)).toBe(false);
  });

  it("remembers per figure, not for every figure at once", () => {
    const one = ready();
    const two = ready();
    expect(mirroredFor(one, 1)).toBe(true);
    expect(mirroredFor(two, 0)).toBe(false);
  });

  it("plays the death facing the way the figure was last headed", () => {
    const skin = ready();
    mirroredFor(skin, 1);
    const { ctx, calls } = recordingCtx();
    skin.drawDefeat(ctx, 0, 0, 2, 0); // defeated facing the camera
    expect(calls[0]!.mirrored).toBe(true);
  });
});

describe("OboroSkin anchoring", () => {
  it("centres the figure on the feet and stands it on them", () => {
    const skin = ready();
    const { ctx, calls } = recordingCtx();
    skin.draw(ctx, 300, 200, DOWN, "idle", 0);
    const [, , sw, , dx, dy, dw, dh] = calls[0]!.args;
    expect(dx! + dw! / 2).toBe(300);
    expect(dw).toBe(sw! * 3); // drawn at 3x
    expect(dy!).toBeLessThan(200);
    expect(dy! + dh!).toBeGreaterThan(200); // feet sit inside the frame
  });
});

describe("OboroSkin defeat", () => {
  it("declines the death animation before its sheet arrives", () => {
    const skin = new OboroSkin("soldier", BASE);
    const { ctx, calls } = recordingCtx();
    expect(skin.drawDefeat(ctx, 0, 0, DOWN, 0)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("plays the death once and holds its last frame", () => {
    const skin = ready();
    const step = (t: number): number => {
      const { ctx, calls } = recordingCtx();
      skin.drawDefeat(ctx, 0, 0, DOWN, t);
      return calls[0]!.args[0]!;
    };
    const last = (DEATH.frames - 1) * CELL;
    expect(step(0)).toBe(0);
    expect(step((DEATH.frames - 1) / DEATH.fps)).toBe(last);
    expect(step(100)).toBe(last); // overrun holds, does not loop
  });
});
