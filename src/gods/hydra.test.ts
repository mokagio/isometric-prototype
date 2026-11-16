import { describe, expect, it } from "vitest";
import { dist } from "./bearing";
import {
  BITE_DAMAGE,
  BODY_HP,
  HEAD_HP,
  ledgeAt,
  makeHydra,
  PEAK,
  peakFooting,
  REAR_TIME,
  REGROW_TIME,
  strikeHydra,
  updateHydra,
  type Hydra,
  type HydraEvent,
} from "./hydra";

const run = (h: Hydra, s: number, hero: { x: number; z: number; alive: boolean }): HydraEvent[] => {
  const out: HydraEvent[] = [];
  for (let t = 0; t < s; t += 1 / 60) out.push(...updateHydra(h, 1 / 60, hero));
  return out;
};
const awake = (): Hydra => {
  const h = makeHydra(0, 0, 0);
  h.intro = 0;
  return h;
};
const cut = (h: Hydra, i = 0): void => {
  for (let k = 0; k < HEAD_HP; k++) strikeHydra(h, 1, i);
};

describe("Hydra's Peak", () => {
  it("climbs the winding stairs from the foot to the top without a jump", () => {
    let last = 0;
    for (let u = 0; u <= 1; u += 0.0005) {
      const p = ledgeAt(u);
      const y = peakFooting(p.x, p.z);
      expect(y, `u=${u.toFixed(4)}`).not.toBeNull();
      expect(Math.abs(y! - last)).toBeLessThan(0.6);
      last = y!;
    }
    expect(peakFooting(PEAK.x, PEAK.z)).toBe(PEAK.h);
  });

  it("starts the stairs on the side facing the city", () => {
    const foot = ledgeAt(0);
    expect(dist(foot.x, foot.z, 0, 0)).toBeLessThan(dist(PEAK.x, PEAK.z, 0, 0));
  });

  it("has nothing between one turn of the stairs and the next", () => {
    const p = ledgeAt(0.3);
    const out = { x: PEAK.x + (p.x - PEAK.x) * 0.8, z: PEAK.z + (p.z - PEAK.z) * 0.8 };
    expect(peakFooting(out.x, out.z)).toBeNull();
  });
});

describe("the Hydra", () => {
  it("rears and bites a hero in reach", () => {
    const h = awake();
    const events = run(h, 1 + REAR_TIME + 1, { x: 0, z: 5, alive: true });
    expect(events).toContainEqual(expect.objectContaining({ kind: "blow", damage: BITE_DAMAGE }));
  });

  it("grows two heads back where one was cut, unless the body is struck first", () => {
    const h = awake();
    cut(h);
    expect(h.heads).toHaveLength(2);
    run(h, REGROW_TIME + 0.1, { x: 0, z: 30, alive: true });
    expect(h.heads).toHaveLength(4);

    const g = awake();
    cut(g);
    expect(strikeHydra(g, 1, null)).toBe("sealed");
    run(g, REGROW_TIME + 0.1, { x: 0, z: 30, alive: true });
    expect(g.heads).toHaveLength(2);
  });

  it("can only be hurt in the body once every head is gone", () => {
    const h = awake();
    expect(strikeHydra(h, 1, null)).toBe("none");
    for (let i = 0; i < 3; i++) {
      cut(h, 0);
      strikeHydra(h, 1, null);
    }
    expect(h.heads).toHaveLength(0);
    for (let k = 0; k < BODY_HP - 1; k++) expect(strikeHydra(h, 1, null)).toBe("body");
    expect(strikeHydra(h, 1, null)).toBe("dead");
  });
});
