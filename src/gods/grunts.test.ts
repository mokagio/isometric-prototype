import { describe, expect, it } from "vitest";
import { DOWN_TIME, GRUNTS, makeGrunt, RISE_TIME, strikeGrunt, updateGrunt, type Blow, type Grunt } from "./grunts";

const run = (g: Grunt, seconds: number, hero: { x: number; z: number; alive: boolean }): Blow[] => {
  const blows: Blow[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    const b = updateGrunt(g, 1 / 60, hero);
    if (b) blows.push(b);
  }
  return blows;
};

describe("a bandit", () => {
  it("ignores a hero out of sight", () => {
    const g = makeGrunt(1, "bandit", 0, 0);
    run(g, 1, { x: 0, z: GRUNTS.bandit.aggro + 5, alive: true });
    expect(g.state).toBe("idle");
  });

  it("walks up to a hero it notices and swings", () => {
    const g = makeGrunt(1, "bandit", 0, 0);
    const blows = run(g, 6, { x: 0, z: 6, alive: true });
    expect(blows.length).toBeGreaterThan(0);
    expect(blows[0]!.damage).toBe(GRUNTS.bandit.damage);
  });

  it("misses a hero who stepped out of reach during the wind-up", () => {
    const g = makeGrunt(1, "bandit", 0, 0);
    g.state = "windup";
    expect(run(g, GRUNTS.bandit.windup + 0.05, { x: 0, z: GRUNTS.bandit.reach + 2, alive: true })).toEqual([]);
  });

  it("falls into a heap rather than dying, and gets back up", () => {
    const g = makeGrunt(1, "bandit", 0, 0);
    for (let i = 0; i < GRUNTS.bandit.hp - 1; i++) expect(strikeGrunt(g, 1, 0, -1)).toBe("hurt");
    expect(strikeGrunt(g, 1, 0, -1)).toBe("down");
    run(g, DOWN_TIME + RISE_TIME + 0.1, { x: 0, z: 50, alive: true });
    expect(g.state).not.toBe("down");
    expect(g.hp).toBe(GRUNTS.bandit.hp);
  });

  it("is finished for good by a blow while it is down", () => {
    const g = makeGrunt(1, "bandit", 0, 0);
    g.hp = 1;
    strikeGrunt(g, 1, 0, -1);
    expect(strikeGrunt(g, 1, 0, -1)).toBe("dead");
    expect(strikeGrunt(g, 1, 0, -1)).toBe("none");
  });

  it("is knocked away from the blow", () => {
    const g = makeGrunt(1, "bandit", 0, 0);
    strikeGrunt(g, 1, 0, -1);
    expect(g.vz).toBeGreaterThan(0);
  });
});

describe("a spartan", () => {
  it("dies outright, with no heap to finish", () => {
    const g = makeGrunt(1, "spartan", 0, 0);
    g.hp = 1;
    expect(strikeGrunt(g, 1, 0, -1)).toBe("dead");
  });
});
