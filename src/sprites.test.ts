import { beforeEach, describe, expect, it, vi } from "vitest";
import { blitFrame, frameAt, SheetLoader, type Blit } from "./sprites";

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

describe("frameAt", () => {
  it("holds the first frame until a whole frame has elapsed", () => {
    expect(frameAt(0, 10, 6, true)).toBe(0);
    expect(frameAt(0.09, 10, 6, true)).toBe(0);
    expect(frameAt(0.1, 10, 6, true)).toBe(1);
  });

  it("advances one frame per 1/fps", () => {
    expect(frameAt(3 / 10, 10, 6, true)).toBe(3);
  });

  it("loops back to the first frame after the last", () => {
    expect(frameAt(6 / 10, 10, 6, true)).toBe(0);
    expect(frameAt(7 / 10, 10, 6, true)).toBe(1);
  });

  it("holds the last frame instead of looping when loop is false", () => {
    expect(frameAt(6 / 10, 10, 6, false)).toBe(5);
    expect(frameAt(100, 10, 6, false)).toBe(5);
  });
});

interface DrawCall {
  args: number[];
  alpha: number;
  smoothing: boolean;
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
      calls.push({ args, alpha: ctx.globalAlpha, smoothing: ctx.imageSmoothingEnabled, mirrored });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const blit = (over: Partial<Blit> = {}): Blit => ({
  cell: 96,
  scale: 3,
  anchorX: 48,
  anchorY: 57,
  frame: 0,
  ...over,
});

const drawWith = (over: Partial<Blit>, feetX = 0, feetY = 0): DrawCall => {
  const { ctx, calls } = recordingCtx();
  blitFrame(ctx, {} as CanvasImageSource, feetX, feetY, blit(over));
  return calls[0]!;
};

describe("blitFrame", () => {
  it("takes the frame from row 0 at frame * cell", () => {
    const [sx, sy, sw, sh] = drawWith({ frame: 2 }).args;
    expect(sx).toBe(2 * 96);
    expect(sy).toBe(0);
    expect(sw).toBe(96);
    expect(sh).toBe(96);
  });

  it("centres on the feet and stands the anchor on them", () => {
    const [, , , , dx, dy, dw, dh] = drawWith({}, 300, 200).args;
    expect(dx! + dw! / 2).toBe(300); // anchorX is the cell centre
    expect(dw).toBe(96 * 3);
    expect(dy!).toBeLessThan(200);
    expect(dy! + dh!).toBeGreaterThan(200); // feet sit inside the frame
  });

  it("draws at nearest-neighbour", () => {
    expect(drawWith({}).smoothing).toBe(false);
  });

  it("mirrors only when flip is set", () => {
    expect(drawWith({ flip: true }).mirrored).toBe(true);
    expect(drawWith({ flip: false }).mirrored).toBe(false);
  });

  it("applies alpha, clamped at zero, and leaves it untouched when omitted", () => {
    expect(drawWith({ alpha: 0.5 }).alpha).toBe(0.5);
    expect(drawWith({ alpha: -1 }).alpha).toBe(0);
    expect(drawWith({}).alpha).toBe(1); // the recording ctx starts at 1
  });
});

describe("SheetLoader", () => {
  it("is not ready until every sheet has settled", () => {
    const loader = new SheetLoader(2);
    loader.load("a.png");
    loader.load("b.png");
    expect(loader.ready).toBe(false);
    pending[0]!.onload?.();
    expect(loader.ready).toBe(false);
    pending[1]!.onload?.();
    expect(loader.ready).toBe(true);
  });

  it("marks a sheet ok on load and not-ok on error, settling either way", () => {
    const loader = new SheetLoader(2);
    const good = loader.load("a.png");
    const bad = loader.load("b.png");
    pending[0]!.onload?.();
    pending[1]!.onerror?.();
    expect(loader.ready).toBe(true);
    expect(good.ok).toBe(true);
    expect(bad.ok).toBe(false);
  });

  it("attaches handlers before src so nothing settles early", () => {
    const loader = new SheetLoader(1);
    loader.load("a.png");
    expect(loader.ready).toBe(false); // src was set, but no handler has fired
  });

  it("sets crossOrigin only when asked", () => {
    const loader = new SheetLoader(2);
    loader.load("a.png", "anonymous");
    loader.load("b.png");
    expect(pending[0]!.crossOrigin).toBe("anonymous");
    expect(pending[1]!.crossOrigin).toBeNull();
  });
});
