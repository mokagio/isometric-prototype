import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_DT } from "./loop";
import { GemArt, Gems, GEMS_PER_KILL, PICKUP_RANGE } from "./gems";
import { MELEE } from "./monsters";

const DT = 1 / 60;
const KILL = { col: 20, row: 20 };
const FAR = { col: 100, row: 100 }; // the hero nowhere near the drop

/** Runs the gems for `secs`, with the hero parked somewhere. */
const settle = (gems: Gems, secs = 2, hero = FAR): number => {
  let taken = 0;
  for (let i = 0; i < secs / DT; i++) taken += gems.update(DT, hero);
  return taken;
};

describe("Gems.spawn", () => {
  it("drops a gem per kill", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, 0);
    expect(gems.list().length).toBe(GEMS_PER_KILL);
  });

  it("throws it up out of the body", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, 0);
    gems.update(DT, FAR);
    const gem = gems.list()[0]!;
    expect(gem.z).toBeGreaterThan(0);
    expect(gem.resting).toBe(false);
  });

  it("lands it back on the cell it died on, at whatever height that is", () => {
    for (const dt of [1 / 60, 1 / 30, MAX_DT]) {
      const gems = new Gems();
      gems.spawn(KILL.col, KILL.row, 3);
      for (let i = 0; i < 2 / dt; i++) gems.update(dt, FAR);
      const gem = gems.list()[0]!;
      expect(gem.resting, `dt ${dt}`).toBe(true);
      expect(gem.z).toBe(3);
      expect(gem.col).toBe(KILL.col);
      expect(gem.row).toBe(KILL.row);
    }
  });

  it("hops high enough to read as a drop, and settles well inside a second", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, 0);
    let peak = 0;
    for (let i = 0; i < 1 / DT; i++) {
      gems.update(DT, FAR);
      peak = Math.max(peak, gems.list()[0]?.z ?? peak);
    }
    expect(peak).toBeGreaterThan(0.2); // levels: a fifth of a terrace step
    expect(gems.list()[0]!.resting).toBe(true);
  });
});

describe("Gems.update", () => {
  it("sweeps up a settled gem the hero stands over, and counts it", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, 0);
    expect(settle(gems, 2, KILL)).toBe(GEMS_PER_KILL);
    expect(gems.list().length).toBe(0);
    expect(gems.collected).toBe(GEMS_PER_KILL);
  });

  it("leaves one just out of reach lying there", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, 0);
    settle(gems, 2, { col: KILL.col + PICKUP_RANGE + 0.1, row: KILL.row });
    expect(gems.list().length).toBe(GEMS_PER_KILL);
    expect(gems.collected).toBe(0);
  });

  it("will not let the hero snatch one out of the air", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, 0);
    // Standing right on the drop, but only for as long as it is still rising.
    const taken = gems.update(DT, KILL);
    expect(taken).toBe(0);
    expect(gems.list()[0]!.resting).toBe(false);
  });

  it("reaches at least as far as the blade does", () => {
    // Gems gate the ladder, so one dropped by a monster killed at the tip of the
    // blade has to be collectable from where the hero stood to kill it.
    expect(PICKUP_RANGE).toBeGreaterThanOrEqual(MELEE);
  });

  it("keeps the tally across drops, and clears it on reset", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, 0);
    settle(gems, 2, KILL);
    gems.spawn(KILL.col, KILL.row, 0);
    settle(gems, 2, KILL);
    expect(gems.collected).toBe(GEMS_PER_KILL * 2);
    gems.reset();
    expect(gems.collected).toBe(0);
    expect(gems.list().length).toBe(0);
  });
});

// The sheet loads through `new Image()`, which the node test environment lacks.
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

describe("GemArt", () => {
  it("prefixes the sheet with the given base", () => {
    new GemArt("/isometric-prototype/");
    expect(pending[0]!.src).toBe("/isometric-prototype/sunnyside/gem.png");
  });

  it("takes its default base from the deploy base URL", async () => {
    vi.resetModules();
    vi.stubEnv("BASE_URL", "/isometric-prototype/");
    const fresh = await import("./gems");
    pending = [];
    new fresh.GemArt();
    expect(pending[0]!.src).toBe("/isometric-prototype/sunnyside/gem.png");
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is not ready until the sheet has loaded", () => {
    const art = new GemArt("/");
    expect(art.ready).toBe(false);
    pending[0]!.onload?.();
    expect(art.ready).toBe(true);
  });

  it("stays unready when the sheet 404s", () => {
    const art = new GemArt("/");
    pending[0]!.onerror?.();
    expect(art.ready).toBe(false);
  });
});
