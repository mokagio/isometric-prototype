import { describe, expect, it } from "vitest";
import {
  AMBUSH_DAMAGE,
  AMBUSH_TIME,
  BEHIND,
  EXPOSED_TIME,
  HADES_HP,
  INTRO_TIME,
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
});
