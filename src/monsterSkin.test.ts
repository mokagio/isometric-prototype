import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMonsterSkin,
  FADE,
  MON_BOB_FPS,
  MONS_IN_CAST,
  MonSkin,
  SlimeSkin,
  type Figure,
} from "./monsterSkin";

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

const figure = (over: Partial<Figure> = {}): Figure => ({
  animT: 0,
  dying: false,
  dyingT: 0,
  faceLeft: false,
  kind: 0,
  ...over,
});

interface DrawCall {
  args: number[];
  alpha: number;
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
    drawImage(_img: unknown, ...args: number[]) {
      calls.push({ args, alpha: ctx.globalAlpha, mirrored });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

/** A loaded mon skin and the one draw call a figure in that state produces. */
function drawMon(over: Partial<Figure> = {}, alphaScale?: number): DrawCall {
  const skin = new MonSkin("/");
  pending.forEach((i) => i.onload?.());
  const { ctx, calls } = recordingCtx();
  skin.draw(ctx, figure(over), 0, 0, alphaScale);
  return calls[0]!;
}

describe("MonSkin loading", () => {
  it("prefixes the sheet with the given base", () => {
    new MonSkin("/isometric-prototype/");
    expect(pending[0]!.src).toBe("/isometric-prototype/mons/monsCast.png");
  });

  it("takes its default base from the deploy base URL", async () => {
    vi.resetModules();
    vi.stubEnv("BASE_URL", "/isometric-prototype/");
    const fresh = await import("./monsterSkin");
    pending = [];
    new fresh.MonSkin();
    expect(pending[0]!.src).toBe("/isometric-prototype/mons/monsCast.png");
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is not ready until the sheet settles, and draws nothing until it is", () => {
    const skin = new MonSkin("/");
    expect(skin.ready).toBe(false);
    const { ctx, calls } = recordingCtx();
    skin.draw(ctx, figure(), 0, 0);
    expect(calls).toHaveLength(0);
    pending[0]!.onload?.();
    expect(skin.ready).toBe(true);
  });

  it("draws nothing when the sheet 404s", () => {
    const skin = new MonSkin("/");
    pending[0]!.onerror?.();
    const { ctx, calls } = recordingCtx();
    skin.draw(ctx, figure(), 0, 0);
    expect(calls).toHaveLength(0);
  });
});

describe("what a skin tells the field about itself", () => {
  it("counts out the whole cast, so the ladder knows what it may send in", () => {
    expect(new MonSkin("/").cast).toBe(MONS_IN_CAST);
  });

  it("keeps the slime a skin of one", () => {
    expect(new SlimeSkin("/").cast).toBe(1);
  });

  it("lifts above the feet by the height of its own art, so hearts clear the sprite", () => {
    // Screen pixels, so the scale is already in: the slime is drawn far bigger.
    expect(new MonSkin("/").lift).toBeGreaterThan(0);
    expect(new SlimeSkin("/").lift).toBeGreaterThan(new MonSkin("/").lift);
  });
});

describe("MonSkin.draw", () => {
  it("takes each creature off its own row of the sheet", () => {
    const rowY = (kind: number): number => drawMon({ kind }).args[1]!;
    const step = rowY(1) - rowY(0);
    expect(step).toBeGreaterThan(0);
    expect(rowY(7) - rowY(6)).toBe(step);
    expect(rowY(MONS_IN_CAST - 1)).toBe(rowY(0) + step * (MONS_IN_CAST - 1));
  });

  it("keeps a kind past the end of the cast on the sheet", () => {
    // A stale save or a bad constant should draw the last creature, not nothing.
    expect(drawMon({ kind: MONS_IN_CAST + 5 }).args[1]).toBe(drawMon({ kind: MONS_IN_CAST - 1 }).args[1]);
    expect(drawMon({ kind: -3 }).args[1]).toBe(drawMon({ kind: 0 }).args[1]);
  });

  it("steps across the bob and loops back", () => {
    const x = (animT: number): number => drawMon({ animT }).args[0]!;
    const step = x(1 / MON_BOB_FPS) - x(0);
    expect(step).toBeGreaterThan(0);
    expect(x(2 / MON_BOB_FPS) - x(1 / MON_BOB_FPS)).toBe(step);
    expect(x(4 / MON_BOB_FPS)).toBe(x(0)); // four frames, then round again
  });

  it("stays on one row through the whole bob", () => {
    const rows = [0, 1, 2, 3].map((f) => drawMon({ animT: f / MON_BOB_FPS, kind: 9 }).args[1]);
    expect(new Set(rows).size).toBe(1);
  });

  it("mirrors only when facing left", () => {
    expect(drawMon({ faceLeft: true }).mirrored).toBe(true);
    expect(drawMon({ faceLeft: false }).mirrored).toBe(false);
  });

  it("fades right across the death, having no death animation to hold up for", () => {
    expect(drawMon({ dying: true, dyingT: 0 }).alpha).toBe(1);
    const half = drawMon({ dying: true, dyingT: FADE / 2 }).alpha;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    expect(drawMon({ dying: true, dyingT: FADE }).alpha).toBe(0);
  });

  it("never asks for a negative alpha once the death overruns", () => {
    expect(drawMon({ dying: true, dyingT: FADE * 3 }).alpha).toBe(0);
  });

  it("dims to the caller's ghost alpha", () => {
    expect(drawMon({}, 0.35).alpha).toBeCloseTo(0.35);
  });
});

describe("createMonsterSkin", () => {
  it("hands back the slime when asked for it", () => {
    expect(createMonsterSkin("slime", "/")).toBeInstanceOf(SlimeSkin);
  });

  it("hands back the mons otherwise", () => {
    expect(createMonsterSkin("mons", "/")).toBeInstanceOf(MonSkin);
  });
});
