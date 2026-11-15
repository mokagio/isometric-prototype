import { describe, expect, it } from "vitest";
import {
  AIM_TIME,
  BOLT_DAMAGE,
  makeZeus,
  OLYMPUS,
  OLYMPUS_STAIR_HALF,
  olympiaHouses,
  MONUMENT,
  ZEUS_RING,
  olympusFooting,
  SPENT_TIME,
  STALK_MAX,
  STORM_COUNT,
  STORM_DAMAGE,
  STORM_WARN,
  strikeZeus,
  THROW_FROM,
  updateZeus,
  ZEUS_HP,
  type Zeus,
  type ZeusEvent,
} from "./zeus";

const arena = { x: 0, z: 0, r: 16 };
const run = (zs: Zeus, seconds: number, hero: { x: number; z: number; alive: boolean }): ZeusEvent[] => {
  const out: ZeusEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) out.push(...updateZeus(zs, 1 / 60, hero, arena));
  return out;
};
const stalking = (): Zeus => {
  const zs = makeZeus(0, 0, 0);
  zs.state = "stalk";
  return zs;
};

describe("Zeus", () => {
  it("turns aside a frontal blow while on guard", () => {
    const zs = stalking();
    expect(strikeZeus(zs, 1, 0, 2)).toBe("clang");
    expect(zs.hp).toBe(ZEUS_HP);
  });

  it("throws a bolt at a hero who keeps away, from his own side so a shield can stop it", () => {
    const zs = stalking();
    zs.t = 1.2;
    const hero = { x: 0, z: THROW_FROM + 4, alive: true };
    const events = run(zs, AIM_TIME + 1, hero);
    expect(events).toContainEqual({ kind: "throw" });
    const blow = events.find((e) => e.kind === "blow") as { damage: number; z: number };
    expect(blow.damage).toBe(BOLT_DAMAGE);
    expect(blow.z).toBeLessThan(hero.z);
  });

  it("calls a storm with a ring under the hero, strikes it, and is left open after", () => {
    const zs = stalking();
    zs.t = STALK_MAX - 0.01;
    const hero = { x: 3, z: 4, alive: true };
    const called = run(zs, 0.05, hero);
    const storm = called.find((e) => e.kind === "storm") as { spots: Array<{ x: number; z: number }> };
    expect(storm.spots).toHaveLength(STORM_COUNT);
    expect(storm.spots[0]).toEqual({ x: 3, z: 4 });
    const struck = run(zs, STORM_WARN, hero);
    expect(struck).toContainEqual({ kind: "zap", damage: STORM_DAMAGE });
    expect(zs.state).toBe("spent");
    expect(strikeZeus(zs, 1, 0, 2)).toBe("hurt");
    run(zs, SPENT_TIME + 0.05, hero);
    expect(zs.state).not.toBe("spent");
  });
});

describe("Mount Olympus", () => {
  it("climbs the stairs a step at a time from the foot to the summit", () => {
    let last = olympusFooting(OLYMPUS.x, OLYMPUS.z - OLYMPUS.r + 0.01)!;
    expect(last).toBeLessThan(1.1);
    for (let d = OLYMPUS.r - 0.01; d > 0; d -= 0.1) {
      const y = olympusFooting(OLYMPUS.x, OLYMPUS.z - d);
      expect(y).not.toBeNull();
      expect(Math.abs(y! - last)).toBeLessThan(1.1);
      last = y!;
    }
    expect(last).toBe(OLYMPUS.h);
  });

  it("has nothing beside the stairs", () => {
    expect(olympusFooting(OLYMPUS.x + OLYMPUS_STAIR_HALF + 0.5, OLYMPUS.z - 40)).toBeNull();
  });

  it("puts Zeus's colosseum at the foot, its back to the bottom step", () => {
    const back = ZEUS_RING.z + ZEUS_RING.r + ZEUS_RING.thick;
    const foot = OLYMPUS.z - OLYMPUS.r;
    expect(back).toBeLessThan(foot);
    expect(foot - back).toBeLessThan(5);
  });

  it("fits Olympia on the summit, clear of the monument and the top of the stairs", () => {
    for (const h of olympiaHouses()) {
      const reach = Math.hypot(h.x - OLYMPUS.x, h.z - OLYMPUS.z) + Math.max(h.w, h.d) / 2;
      expect(reach).toBeLessThan(OLYMPUS.top);
      expect(Math.abs(h.x - MONUMENT.x) > MONUMENT.w / 2 + 3 || Math.abs(h.z - MONUMENT.z) > MONUMENT.d / 2 + 3).toBe(true);
      expect(Math.abs(h.x - OLYMPUS.x) < OLYMPUS_STAIR_HALF + 3 && h.z < OLYMPUS.z).toBe(false);
    }
  });
});
