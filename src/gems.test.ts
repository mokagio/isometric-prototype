import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_DT } from "./loop";
import { BOSS_GEMS, GemArt, Gems, GEMS_PER_KILL, PICKUP_RANGE, SCATTER, type Terrain } from "./gems";

const DT = 1 / 60;
const KILL = { col: 20, row: 20 };
const FAR = { col: 100, row: 100 }; // the hero nowhere near the drop

/** Open, level ground everywhere. */
const FLAT: Terrain = { heightAt: () => 0, barred: () => false };
/** The same, raised — a gem should come to rest on whatever it was thrown from. */
const TERRACE: Terrain = { heightAt: () => 3, barred: () => false };
/** A river running down +col of the drop: the burst has to stay this side of it. */
const RIVER: Terrain = { heightAt: () => 0, barred: (col) => col > KILL.col };
/** A cell of dry land in a lake, with nowhere at all to throw a gem. */
const ISLET: Terrain = {
  heightAt: () => 0,
  barred: (col, row) => !(col === KILL.col && row === KILL.row),
};

/** Runs the gems for `secs`, with the hero parked somewhere. */
const settle = (gems: Gems, secs = 2, hero = FAR): number => {
  let taken = 0;
  for (let i = 0; i < secs / DT; i++) taken += gems.update(DT, hero);
  return taken;
};

describe("Gems.spawn", () => {
  it("drops a gem per kill", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, FLAT);
    expect(gems.list().length).toBe(GEMS_PER_KILL);
  });

  it("throws it up out of the body", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, FLAT);
    gems.update(DT, FAR);
    const gem = gems.list()[0]!;
    expect(gem.z).toBeGreaterThan(0);
    expect(gem.resting).toBe(false);
  });

  it("lands it back on the cell it died on, at whatever height that is", () => {
    for (const dt of [1 / 60, 1 / 30, MAX_DT]) {
      const gems = new Gems();
      gems.spawn(KILL.col, KILL.row, TERRACE);
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
    gems.spawn(KILL.col, KILL.row, FLAT);
    let peak = 0;
    for (let i = 0; i < 1 / DT; i++) {
      gems.update(DT, FAR);
      peak = Math.max(peak, gems.list()[0]?.z ?? peak);
    }
    expect(peak).toBeGreaterThan(0.2); // levels: a fifth of a terrace step
    expect(gems.list()[0]!.resting).toBe(true);
  });
});

describe("Gems.spawn in a burst", () => {
  it("bursts an armful off the boss", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, FLAT, BOSS_GEMS);
    expect(gems.list().length).toBe(BOSS_GEMS);
    expect(BOSS_GEMS).toBeGreaterThan(GEMS_PER_KILL);
  });

  it("scatters them around the post rather than piling them on it", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, FLAT, BOSS_GEMS);
    settle(gems);
    const at = gems.list().map((g) => `${g.col.toFixed(2)},${g.row.toFixed(2)}`);
    expect(new Set(at).size).toBe(BOSS_GEMS);
    // Spread over more than one ring, or the burst reads as a fence.
    const out = gems.list().map((g) => Math.hypot(g.col - KILL.col, g.row - KILL.row));
    expect(new Set(out.map((d) => d.toFixed(3))).size).toBeGreaterThan(1);
  });

  it("lands every one of them inside SCATTER, whatever the frame rate", () => {
    for (const dt of [1 / 60, 1 / 30, MAX_DT]) {
      const gems = new Gems();
      gems.spawn(KILL.col, KILL.row, FLAT, BOSS_GEMS);
      for (let i = 0; i < 2 / dt; i++) gems.update(dt, FAR);
      for (const gem of gems.list()) {
        expect(gem.resting, `dt ${dt}`).toBe(true);
        expect(Math.hypot(gem.col - KILL.col, gem.row - KILL.row), `dt ${dt}`).toBeLessThanOrEqual(SCATTER + 1e-9);
      }
    }
  });

  it("throws none of them into the water", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, RIVER, BOSS_GEMS);
    settle(gems);
    for (const gem of gems.list()) expect(Math.round(gem.col)).toBeLessThanOrEqual(KILL.col);
  });

  it("huddles them on the one dry cell when there is nowhere to throw them", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, ISLET, BOSS_GEMS);
    settle(gems);
    for (const gem of gems.list()) {
      expect(Math.round(gem.col)).toBe(KILL.col);
      expect(Math.round(gem.row)).toBe(KILL.row);
    }
    // Spread over the cell rather than stacked on its centre, which would draw as
    // one gem however many are really there.
    const at = gems.list().map((g) => `${g.col.toFixed(2)},${g.row.toFixed(2)}`);
    expect(new Set(at).size).toBe(BOSS_GEMS);
    // Still every one of them there to be picked up.
    expect(settle(gems, 1, KILL)).toBe(BOSS_GEMS);
  });

  it("keeps a burst on the level it was thrown from", () => {
    // Terraces are whole levels and the hop clears a third of one, so a gem that
    // came to rest a step up or down would have got there by teleporting.
    const stepped: Terrain = {
      heightAt: (col) => (col > KILL.col ? 1 : 0),
      barred: () => false,
    };
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, stepped, BOSS_GEMS);
    settle(gems);
    for (const gem of gems.list()) {
      expect(gem.z).toBe(0);
      expect(Math.round(gem.col)).toBeLessThanOrEqual(KILL.col);
    }
  });
});

describe("Gems.update", () => {
  it("sweeps up a settled gem the hero stands over, and counts it", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, FLAT);
    expect(settle(gems, 2, KILL)).toBe(GEMS_PER_KILL);
    expect(gems.list().length).toBe(0);
    expect(gems.collected).toBe(GEMS_PER_KILL);
  });

  it("leaves one just out of reach lying there", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, FLAT);
    settle(gems, 2, { col: KILL.col + PICKUP_RANGE + 0.1, row: KILL.row });
    expect(gems.list().length).toBe(GEMS_PER_KILL);
    expect(gems.collected).toBe(0);
  });

  it("will not let the hero snatch one out of the air", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, FLAT);
    // Standing right on the drop, but only for as long as it is still rising.
    const taken = gems.update(DT, KILL);
    expect(taken).toBe(0);
    expect(gems.list()[0]!.resting).toBe(false);
  });

  it("keeps the tally across drops, and clears it on reset", () => {
    const gems = new Gems();
    gems.spawn(KILL.col, KILL.row, FLAT);
    settle(gems, 2, KILL);
    gems.spawn(KILL.col, KILL.row, FLAT);
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
