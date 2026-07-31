import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOSS_WALK,
  bossPost,
  drawHearts,
  DYING,
  EMBER_ROW,
  FALLEN_ROW,
  FRAMES,
  HP,
  HURT,
  IDLE_ROW,
  RECOIL_ROW,
  ROAR,
  ROAR_EVERY,
  ROAR_HIT_AT,
  ROAR_ROW,
  Treant,
  TreantArt,
} from "./treant";

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

/** Run the clock forward in small steps, collecting the frames the lash landed on. */
function run(t: Treant, seconds: number, step = 1 / 60): number {
  let lashes = 0;
  for (let elapsed = 0; elapsed < seconds; elapsed += step) if (t.update(step)) lashes++;
  return lashes;
}

describe("Treant", () => {
  it("stands idle, looping the breath", () => {
    const t = new Treant();
    expect(t.pose().row).toBe(IDLE_ROW);
    run(t, 0.5);
    expect(t.pose().row).toBe(IDLE_ROW);
  });

  it("rears up on the roar clock and lashes once, partway in", () => {
    const t = new Treant();
    expect(run(t, ROAR_EVERY - 0.1)).toBe(0);
    run(t, 0.2);
    expect(t.roaring).toBe(true);
    // Reared up but not yet connected: the window to get clear.
    expect(t.pose().row).toBe(ROAR_ROW);
    expect(run(t, ROAR_HIT_AT)).toBe(1);
    expect(run(t, ROAR)).toBe(0); // one lash per roar, however long it plays out
  });

  it("returns to idle when the roar has played out", () => {
    const t = new Treant();
    run(t, ROAR_EVERY + ROAR + 0.1);
    expect(t.roaring).toBe(false);
    expect(t.pose().row).toBe(IDLE_ROW);
  });

  it("recoils on a blow and recovers", () => {
    const t = new Treant();
    t.hit();
    expect(t.hp).toBe(HP - 1);
    expect(t.pose().row).toBe(RECOIL_ROW);
    run(t, HURT + 0.05);
    expect(t.pose().row).toBe(IDLE_ROW);
  });

  it("sees a roar through rather than recoiling out of it", () => {
    const t = new Treant();
    run(t, ROAR_EVERY + 0.05);
    expect(t.roaring).toBe(true);
    expect(t.hit()).toBe(false);
    expect(t.roaring).toBe(true);
    expect(t.pose().row).toBe(ROAR_ROW);
    expect(run(t, ROAR)).toBe(1); // the lash still arrives
  });

  it("still lashes a hero who never stops swinging", () => {
    const t = new Treant();
    // Hit it over and over, never letting it out of the recoil for long.
    let lashes = 0;
    for (let i = 0; i < 40; i++) {
      t.hp = HP; // keep it alive: this is about the clock, not the health
      t.hit();
      lashes += run(t, HURT + 0.02);
    }
    expect(lashes).toBeGreaterThan(0);
  });

  it("drops a roar when the blow is the killing one", () => {
    const t = new Treant();
    run(t, ROAR_EVERY + 0.05);
    t.hp = 1;
    expect(t.hit()).toBe(true);
    expect(t.roaring).toBe(false);
    expect(t.pose().row).toBe(EMBER_ROW);
  });

  it("blinks through the recoil and stands solid the rest of the time", () => {
    const t = new Treant();
    expect(t.alpha()).toBe(1);
    t.hit();
    const seen = new Set<number>();
    for (let elapsed = 0; elapsed < HURT; elapsed += 1 / 120) {
      seen.add(t.alpha());
      t.update(1 / 120);
    }
    expect(seen.size).toBe(2); // it flickers between two opacities, not a fade
    expect(Math.min(...seen)).toBeLessThan(1);
    run(t, HURT);
    expect(t.alpha()).toBe(1);
  });

  it("does not blink while burning out — the death is its own animation", () => {
    const t = new Treant();
    for (let i = 0; i < HP; i++) t.hit();
    for (let elapsed = 0; elapsed < DYING; elapsed += 1 / 60) {
      expect(t.alpha()).toBe(1);
      t.update(1 / 60);
    }
  });

  it("takes HP blows to fell, and says which one did it", () => {
    const t = new Treant();
    for (let i = 0; i < HP - 1; i++) expect(t.hit()).toBe(false);
    expect(t.hit()).toBe(true);
    expect(t.alive).toBe(false);
  });

  it("plays the ember row backwards as it burns out, then holds the slump", () => {
    const t = new Treant();
    for (let i = 0; i < HP; i++) t.hit();
    expect(t.pose()).toEqual({ row: EMBER_ROW, frame: FRAMES - 1 });
    run(t, DYING * 0.9);
    expect(t.pose().row).toBe(EMBER_ROW);
    expect(t.pose().frame).toBe(0); // the fire is out
    run(t, DYING);
    expect(t.down).toBe(true);
    expect(t.pose()).toEqual({ row: FALLEN_ROW, frame: 0 });
  });

  it("stays down: neither the clock nor another blow stirs it", () => {
    const t = new Treant();
    for (let i = 0; i < HP; i++) t.hit();
    run(t, DYING + ROAR_EVERY * 3);
    expect(t.hit()).toBe(false);
    expect(t.hp).toBe(0);
    expect(t.pose()).toEqual({ row: FALLEN_ROW, frame: 0 });
  });
});

describe("drawHearts", () => {
  interface Pip {
    x: number;
    alpha: number;
  }

  function lay(left: number, total = HP, midX = 300, scale = 2): Pip[] {
    const pips: Pip[] = [];
    const ctx = {
      globalAlpha: 1,
      font: "",
      textAlign: "",
      textBaseline: "",
      save() {},
      restore() {},
      fillText(_text: string, x: number) {
        pips.push({ x, alpha: ctx.globalAlpha });
      },
    };
    drawHearts(ctx as unknown as CanvasRenderingContext2D, left, total, midX, 100, scale);
    return pips;
  }

  it("lays one heart per blow the boss can take", () => {
    expect(lay(HP).length).toBe(HP);
  });

  it("keeps the row's width as hearts are spent, dimming rather than dropping them", () => {
    const full = lay(HP);
    const hurt = lay(2);
    expect(hurt.map((p) => p.x)).toEqual(full.map((p) => p.x));
    expect(hurt.map((p) => p.alpha < 1)).toEqual([false, false, true, true, true]);
  });

  it("centres the row on the sprite", () => {
    const pips = lay(HP, HP, 300);
    expect((pips[0]!.x + pips[pips.length - 1]!.x) / 2).toBe(300);
  });

  it("scales the row with the sprite", () => {
    const span = (scale: number): number => {
      const pips = lay(HP, HP, 300, scale);
      return pips[pips.length - 1]!.x - pips[0]!.x;
    };
    expect(span(4)).toBe(span(2) * 2);
  });
});

describe("bossPost", () => {
  const bounds = { cols: 56, rows: 56 };
  const spawn = { col: 28, row: 28 };
  const dry = (): boolean => false;

  it("stands the boss a walk away from the spawn, not on top of it", () => {
    const post = bossPost(spawn, bounds, dry);
    expect(Math.hypot(post.col - spawn.col, post.row - spawn.row)).toBeCloseTo(BOSS_WALK, 0);
  });

  it("puts the same seed's boss in the same place every time", () => {
    expect(bossPost(spawn, bounds, dry)).toEqual(bossPost(spawn, bounds, dry));
  });

  it("never posts it in the water", () => {
    // Dry only in a thin corridor west of the spawn, so no full-distance bearing works.
    const barred = (col: number, row: number): boolean => !(row === spawn.row && col < spawn.col);
    const post = bossPost(spawn, bounds, barred);
    expect(barred(post.col, post.row)).toBe(false);
  });

  it("steps in toward the hero when the far ground is barred", () => {
    const barred = (col: number, row: number): boolean => Math.hypot(col - spawn.col, row - spawn.row) > 3;
    const post = bossPost(spawn, bounds, barred);
    expect(Math.hypot(post.col - spawn.col, post.row - spawn.row)).toBeLessThanOrEqual(3);
  });

  it("keeps it inside the map when the spawn is against an edge", () => {
    const post = bossPost({ col: 1, row: 1 }, bounds, dry);
    expect(post.col).toBeGreaterThanOrEqual(1);
    expect(post.row).toBeGreaterThanOrEqual(1);
  });

  it("falls back to the spawn when there is nowhere dry at all", () => {
    expect(bossPost(spawn, bounds, () => true)).toEqual(spawn);
  });
});

describe("TreantArt", () => {
  it("prefixes the sheet path with the given base", () => {
    new TreantArt("/isometric-prototype/");
    expect(pending[0]!.src).toBe("/isometric-prototype/treant/treant.png");
  });

  it("takes its default base from the deploy base URL", async () => {
    vi.resetModules();
    vi.stubEnv("BASE_URL", "/isometric-prototype/");
    const fresh = await import("./treant");
    new fresh.TreantArt();
    expect(pending[0]!.src).toBe("/isometric-prototype/treant/treant.png");
    vi.unstubAllEnvs();
  });

  it("is not ready until the sheet has loaded", () => {
    const art = new TreantArt("/");
    expect(art.ready).toBe(false);
    pending[0]!.onload?.();
    expect(art.ready).toBe(true);
  });

  it("is not ready when the sheet 404s", () => {
    const art = new TreantArt("/");
    pending[0]!.onerror?.();
    expect(art.ready).toBe(false);
  });
});
