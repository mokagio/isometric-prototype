import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_DT } from "./loop";
import { GemArt, Gems, GEMS_PER_KILL, PICKUP_RANGE, THROW, type Terrain } from "./gems";

const DT = 1 / 60;
const KILL = { col: 20, row: 20 };
// Two cells back along -col, so the throw runs out along +col and a test can read
// the bearing off `col` alone.
const KILLER = { col: KILL.col - 2, row: KILL.row };
const FAR = { col: 100, row: 100 }; // the hero nowhere near the drop

/** Open ground at a given level, with nothing in the way. */
const flat = (level = 0): Terrain => ({ heightAt: () => level, barred: () => false });
const distance = (a: { col: number; row: number }, b: { col: number; row: number }): number =>
  Math.hypot(a.col - b.col, a.row - b.row);

/** Runs the gems for `secs`, with the hero parked somewhere. */
const settle = (gems: Gems, secs = 2, hero = FAR): number => {
  let taken = 0;
  for (let i = 0; i < secs / DT; i++) taken += gems.update(DT, hero);
  return taken;
};

describe("Gems.spawn", () => {
  it("drops a gem per kill", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, flat(), KILLER);
    expect(gems.list().length).toBe(GEMS_PER_KILL);
  });

  it("throws it up out of the body", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, flat(), KILLER);
    gems.update(DT, FAR);
    const gem = gems.list()[0]!;
    expect(gem.z).toBeGreaterThan(0);
    expect(gem.resting).toBe(false);
  });

  it("throws it a full throw clear of whoever struck it", () => {
    for (const dt of [1 / 60, 1 / 30, MAX_DT]) {
      const gems = new Gems();
      gems.spawn(KILL.col, KILL.row, flat(3), KILLER);
      for (let i = 0; i < 2 / dt; i++) gems.update(dt, FAR);
      const gem = gems.list()[0]!;
      expect(gem.resting, `dt ${dt}`).toBe(true);
      expect(gem.z).toBe(3);
      expect(gem.col).toBeCloseTo(KILL.col + THROW);
      expect(gem.row).toBeCloseTo(KILL.row);
    }
  });

  it("throws it away from the killer, whichever side they struck from", () => {
    for (const side of [-1, 1]) {
      const gems = new Gems();
      const killer = { col: KILL.col, row: KILL.row - side * 2 };
      gems.spawn(KILL.col, KILL.row, flat(), killer);
      settle(gems);
      const gem = gems.list()[0]!;
      expect(distance(gem, killer)).toBeGreaterThan(distance(KILL, killer));
    }
  });

  it("still throws one struck dead-on", () => {
    // No bearing to read off a blow that landed on the spot; it goes somewhere
    // rather than staying underfoot.
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, flat(), KILL);
    settle(gems);
    expect(distance(gems.list()[0]!, KILL)).toBeCloseTo(THROW);
  });

  it("comes down short of a river rather than into it", () => {
    const bank: Terrain = { heightAt: () => 0, barred: (col) => col > KILL.col };
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, bank, KILLER);
    settle(gems);
    const gem = gems.list()[0]!;
    expect(bank.barred(Math.round(gem.col), Math.round(gem.row))).toBe(false);
    expect(gem.col).toBeGreaterThan(KILL.col); // still thrown, just not as far
  });

  it("will not throw one up onto a terrace it would have to be jumped for", () => {
    const step: Terrain = { heightAt: (col) => (col > KILL.col ? 2 : 0), barred: () => false };
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, step, KILLER);
    settle(gems);
    const gem = gems.list()[0]!;
    expect(step.heightAt(Math.round(gem.col), Math.round(gem.row))).toBe(0);
  });

  it("hops high enough to read as a drop, and settles well inside a second", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, flat(), KILLER);
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
  /** Where the throw puts the gem down, given who struck the killing blow. */
  const restingPlace = (killer = KILLER): { col: number; row: number } => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, flat(), killer);
    settle(gems);
    return { col: gems.list()[0]!.col, row: gems.list()[0]!.row };
  };

  it("sweeps up a settled gem the hero walks over, and counts it", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, flat(), KILLER);
    expect(settle(gems, 2, restingPlace())).toBe(GEMS_PER_KILL);
    expect(gems.list().length).toBe(0);
    expect(gems.collected).toBe(GEMS_PER_KILL);
  });

  it("leaves one just out of reach lying there", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, flat(), KILLER);
    const rest = restingPlace();
    settle(gems, 2, { col: rest.col + PICKUP_RANGE + 0.1, row: rest.row });
    expect(gems.list().length).toBe(GEMS_PER_KILL);
    expect(gems.collected).toBe(0);
  });

  it("does not drop one into the hero's lap", () => {
    // The point of the throw: standing where you swung is not enough, so a kill
    // is worth the walk over to what it left behind.
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, flat(), KILLER);
    expect(settle(gems, 2, KILLER)).toBe(0);
    expect(gems.list().length).toBe(GEMS_PER_KILL);
  });

  it("throws further than the hero can reach, so there is always a walk", () => {
    // Even a monster cut down on the spot leaves its gem outside the sweep.
    expect(THROW).toBeGreaterThan(PICKUP_RANGE);
    expect(distance(restingPlace(KILL), KILL)).toBeGreaterThan(PICKUP_RANGE);
  });

  it("will not let the hero snatch one out of the air", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, flat(), KILLER);
    // Standing right on the drop, but only for as long as it is still rising.
    const taken = gems.update(DT, KILL);
    expect(taken).toBe(0);
    expect(gems.list()[0]!.resting).toBe(false);
  });

  it("keeps the tally across drops, and clears it on reset", () => {
    const gems = new Gems();
    const rest = restingPlace();
    gems.spawn(KILL.col, KILL.row, flat(), KILLER);
    settle(gems, 2, rest);
    gems.spawn(KILL.col, KILL.row, flat(), KILLER);
    settle(gems, 2, rest);
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
