import { describe, expect, it } from "vitest";
import {
  ARES_HP,
  BRACE_TIME,
  CHARGE_DAMAGE,
  DAZED_TIME,
  INTRO_TIME,
  makeAres,
  STALK_MIN,
  strikeAres,
  SUMMON_AT,
  SUMMON_COUNT,
  updateAres,
  type Ares,
  type AresEvent,
} from "./ares";

const arena = { x: 0, z: 0, r: 20 };

const run = (a: Ares, seconds: number, hero: { x: number; z: number; alive: boolean }): AresEvent[] => {
  const out: AresEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) out.push(...updateAres(a, 1 / 60, hero, arena));
  return out;
};

describe("Ares", () => {
  it("roars before the fight starts", () => {
    const a = makeAres(0, -10, 0);
    expect(run(a, INTRO_TIME + 0.05, { x: 0, z: 10, alive: true })).toContainEqual({ kind: "roar" });
  });

  it("rings a frontal blow off his shield while on guard", () => {
    const a = makeAres(0, 0, 0);
    a.state = "stalk";
    expect(strikeAres(a, 1, 0, 2)).toBe("clang");
    expect(a.hp).toBe(ARES_HP);
  });

  it("takes a blow from behind even on guard", () => {
    const a = makeAres(0, 0, 0);
    a.state = "stalk";
    expect(strikeAres(a, 1, 0, -2)).toBe("hurt");
  });

  it("takes a blow from anywhere while dazed", () => {
    const a = makeAres(0, 0, 0);
    a.state = "dazed";
    expect(strikeAres(a, 1, 0, 2)).toBe("hurt");
  });

  it("braces to charge a hero who keeps their distance", () => {
    const a = makeAres(0, 0, 0);
    a.state = "stalk";
    run(a, STALK_MIN + 0.1, { x: 0, z: 15, alive: true });
    expect(a.state).toBe("brace");
  });

  it("hits hard if the charge connects, then runs on into the wall and is dazed", () => {
    const a = makeAres(0, 0, 0);
    a.state = "brace";
    const events = run(a, BRACE_TIME + 1.5, { x: 0, z: 8, alive: true });
    expect(events.filter((e) => e.kind === "blow")).toEqual([
      { kind: "blow", damage: CHARGE_DAMAGE, x: expect.any(Number), z: expect.any(Number), heavy: true },
    ]);
    expect(events).toContainEqual({ kind: "wall" });
    expect(a.state).toBe("dazed");
    expect(Math.hypot(a.x, a.z)).toBeLessThan(arena.r);
  });

  it("comes round from being dazed", () => {
    const a = makeAres(0, 0, 0);
    a.state = "dazed";
    run(a, DAZED_TIME + 0.1, { x: 0, z: 3, alive: true });
    expect(a.state).not.toBe("dazed");
  });

  it("calls soldiers in once for each line his health drops past", () => {
    const a = makeAres(0, 0, 0);
    a.state = "stalk";
    a.hp = Math.floor(ARES_HP * SUMMON_AT[0]!);
    const first = run(a, 2, { x: 0, z: 2.5, alive: true }).filter((e) => e.kind === "summon");
    expect(first).toEqual([{ kind: "summon", count: SUMMON_COUNT }]);
    const again = run(a, 2, { x: 0, z: 2.5, alive: true }).filter((e) => e.kind === "summon");
    expect(again).toEqual([]);
  });

  it("dies at nothing left", () => {
    const a = makeAres(0, 0, 0);
    a.state = "dazed";
    a.hp = 1;
    expect(strikeAres(a, 1, 0, 2)).toBe("dead");
    expect(strikeAres(a, 1, 0, 2)).toBe("none");
  });
});
