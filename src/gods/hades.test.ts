import { describe, expect, it } from "vitest";
import {
  AMBUSH_DAMAGE,
  AMBUSH_TIME,
  BEHIND,
  EXPOSED_TIME,
  HADES_HP,
  INTRO_TIME,
  CRUSH_DAMAGE,
  ARRIVAL,
  BRIDGES,
  ISLAND,
  ISLANDS,
  LOW_Y,
  QUAKE_COUNT,
  QUAKE_WARN,
  STAIRS,
  TARTARUS,
  tartarusFooting,
  makeHades,
  RAISE_AT,
  RAISE_COUNT,
  STALK_MIN,
  strikeHades,
  updateHades,
  VANISH_FROM,
  VANISH_TIME,
  type Hades,
  type HadesEvent,
} from "./hades";
import { dist } from "./bearing";

const arena = { x: 0, z: 0, r: 18 };
type HeroAt = { x: number; z: number; yaw: number; alive: boolean };

const run = (h: Hades, seconds: number, hero: HeroAt): HadesEvent[] => {
  const out: HadesEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) out.push(...updateHades(h, 1 / 60, hero, arena));
  return out;
};

const stalking = (): Hades => {
  const h = makeHades(0, 0, 0);
  h.state = "stalk";
  return h;
};

describe("Hades", () => {
  it("roars before the fight starts", () => {
    expect(run(makeHades(0, -5, 0), INTRO_TIME + 0.05, { x: 0, z: 5, yaw: Math.PI, alive: true })).toContainEqual({ kind: "roar" });
  });

  it("turns aside a frontal blow with his bident", () => {
    const h = stalking();
    expect(strikeHades(h, 1, 0, 2)).toBe("clang");
    expect(h.hp).toBe(HADES_HP);
  });

  it("vanishes when the hero keeps away, and can't be hit while gone", () => {
    const h = stalking();
    const events = run(h, STALK_MIN + 0.1, { x: 0, z: VANISH_FROM + 6, yaw: Math.PI, alive: true });
    expect(events).toContainEqual({ kind: "vanish" });
    expect(strikeHades(h, 1, h.x, h.z - 2)).toBe("none");
  });

  it("comes back behind the hero and strikes after a warning", () => {
    const h = stalking();
    h.state = "vanish";
    const hero = { x: 0, z: 8, yaw: Math.PI, alive: true };
    const events = run(h, VANISH_TIME + AMBUSH_TIME + 0.1, hero);
    const appear = events.find((e) => e.kind === "appear") as { x: number; z: number };
    expect(dist(appear.x, appear.z, hero.x, hero.z)).toBeCloseTo(BEHIND);
    // Behind a hero facing -z is further along +z.
    expect(appear.z).toBeGreaterThan(hero.z);
    expect(events).toContainEqual(expect.objectContaining({ kind: "blow", damage: AMBUSH_DAMAGE, heavy: true }));
    expect(h.state).toBe("exposed");
  });

  it("stands open after the blow from behind, even from the front", () => {
    const h = stalking();
    h.state = "exposed";
    expect(strikeHades(h, 1, 0, 2)).toBe("hurt");
    run(h, EXPOSED_TIME + 0.05, { x: 0, z: 2, yaw: Math.PI, alive: true });
    expect(h.state).not.toBe("exposed");
  });

  it("raises the dead once per line", () => {
    const h = stalking();
    h.hp = Math.floor(HADES_HP * RAISE_AT[0]!);
    const raises = run(h, 4, { x: 0, z: 30, yaw: Math.PI, alive: true }).filter((e) => e.kind === "raise");
    expect(raises).toEqual([{ kind: "raise", count: RAISE_COUNT }]);
  });

  it("takes turns: vanishing first, then bringing the roof down", () => {
    const h = stalking();
    h.tricks = 1;
    const events = run(h, STALK_MIN + 0.1, { x: 0, z: VANISH_FROM + 6, yaw: Math.PI, alive: true });
    const quake = events.find((e) => e.kind === "quake") as { spots: Array<{ x: number; z: number }> };
    expect(quake.spots).toHaveLength(QUAKE_COUNT);
    expect(quake.spots[0]).toEqual({ x: 0, z: VANISH_FROM + 6 });
  });

  it("crushes a hero who stays under a stalactite, and not one who moves", () => {
    const stay = stalking();
    stay.tricks = 1;
    const hero = { x: 0, z: 10, yaw: Math.PI, alive: true };
    const events = run(stay, STALK_MIN + QUAKE_WARN + 0.2, hero);
    expect(events).toContainEqual({ kind: "crush", damage: CRUSH_DAMAGE });

    const move = stalking();
    move.tricks = 1;
    run(move, STALK_MIN + 0.1, hero);
    const later = run(move, QUAKE_WARN, { ...hero, x: -6, z: -10 }).filter((e) => e.kind === "crush");
    // Moved off the marked spot; only an unlucky random one could still land there.
    expect(later.length).toBeLessThanOrEqual(1);
    expect(move.spots).toEqual([]);
  });

  it("climbs from the island up the stairs to the colosseum without a gap", () => {
    expect(tartarusFooting(ISLAND.x, ISLAND.z)).toBe(LOW_Y);
    let last = LOW_Y;
    for (let x = ISLAND.x; x > TARTARUS.x; x -= 0.25) {
      const y = tartarusFooting(x, TARTARUS.z);
      expect(y).not.toBeNull();
      expect(Math.abs(y! - last)).toBeLessThan(0.4);
      last = y!;
    }
    expect(last).toBe(TARTARUS.y);
  });

  it("has nothing beside the stairs but the drop", () => {
    expect(tartarusFooting((STAIRS.x0 + STAIRS.x1) / 2, TARTARUS.z + STAIRS.half + 0.5)).toBeNull();
  });

  it("joins every island by a bridge you can walk the length of", () => {
    for (const [a, b] of BRIDGES) {
      const p = ISLANDS[a]!;
      const q = ISLANDS[b]!;
      for (let t = 0; t <= 1; t += 0.02) expect(tartarusFooting(p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t)).toBe(LOW_Y);
    }
    expect(tartarusFooting(ARRIVAL.x, ARRIVAL.z)).toBe(LOW_Y);
  });

  it("has nothing beside a bridge but the drop", () => {
    const p = ISLANDS[0]!;
    const q = ISLANDS[1]!;
    const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 };
    const across = { x: -(q.z - p.z), z: q.x - p.x };
    const k = 3 / Math.hypot(across.x, across.z);
    expect(tartarusFooting(mid.x + across.x * k, mid.z + across.z * k)).toBeNull();
  });
});
