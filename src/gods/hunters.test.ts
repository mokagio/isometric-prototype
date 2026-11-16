import { describe, expect, it } from "vitest";
import { ARROW_DAMAGE, makeArtemis, makeWolf, RELOAD_TIME, stepWolf, strikeArtemis, strikeWolf, TOO_CLOSE, updateArtemis, WOLF_AT, WOLVES, type Artemis, type ArtemisEvent } from "./artemis";
import { KRATOS_HP, makeKratos, strikeKratos, STUCK_TIME, updateKratos, WAVE_DAMAGE, WAVE_REACH, type Kratos, type KratosEvent } from "./kratos";

const arena = { x: 0, z: 0, r: 18 };
const runA = (a: Artemis, s: number, hero: { x: number; z: number; alive: boolean }): ArtemisEvent[] => {
  const out: ArtemisEvent[] = [];
  for (let t = 0; t < s; t += 1 / 60) out.push(...updateArtemis(a, 1 / 60, hero, arena));
  return out;
};
const runK = (k: Kratos, s: number, hero: { x: number; z: number; alive: boolean }): KratosEvent[] => {
  const out: KratosEvent[] = [];
  for (let t = 0; t < s; t += 1 / 60) out.push(...updateKratos(k, 1 / 60, hero, arena));
  return out;
};

describe("Artemis", () => {
  it("looses a volley of arrows that hit a hero standing in their way, from her side", () => {
    const a = makeArtemis(0, 0, 0);
    a.state = "hunt";
    const hero = { x: 0, z: 9, alive: true };
    const blows = runA(a, 4, hero).filter((e) => e.kind === "blow");
    expect(blows.length).toBeGreaterThan(0);
    expect(blows[0]).toMatchObject({ damage: ARROW_DAMAGE });
    expect((blows[0] as { z: number }).z).toBeLessThan(hero.z);
  });

  it("leaps away from a hero who gets close, and can't be hit mid-leap", () => {
    const a = makeArtemis(0, 0, 0);
    a.state = "hunt";
    const events = runA(a, 0.1, { x: 0, z: TOO_CLOSE - 1, alive: true });
    expect(events).toContainEqual({ kind: "leap" });
    expect(strikeArtemis(a, 1)).toBe("none");
    runA(a, 1, { x: 0, z: TOO_CLOSE - 1, alive: true });
    expect(a.z).toBeLessThan(-3);
  });

  it("stands still to reload after a volley: the opening", () => {
    const a = makeArtemis(0, 0, 0);
    a.state = "reload";
    expect(strikeArtemis(a, 2)).toBe("hurt");
    runA(a, RELOAD_TIME + 0.05, { x: 0, z: 30, alive: true });
    expect(a.state).not.toBe("reload");
  });

  it("calls wolves once per line, and a wolf bites then falls to two blows", () => {
    const a = makeArtemis(0, 0, 0);
    a.state = "hunt";
    a.hp = Math.floor(20 * WOLF_AT[0]!);
    const calls = runA(a, 2, { x: 0, z: 9, alive: true }).filter((e) => e.kind === "wolves");
    expect(calls).toEqual([{ kind: "wolves", count: WOLVES }]);
    const w = makeWolf(0, 0);
    let bit = false;
    for (let t = 0; t < 3; t += 1 / 60) bit = stepWolf(w, 1 / 60, { x: 0, z: 6, alive: true }) || bit;
    expect(bit).toBe(true);
    strikeWolf(w, 1);
    strikeWolf(w, 1);
    expect(w.dead).toBe(0);
  });
});

describe("Kratos", () => {
  it("slams the ground: the shockwave throws a hero it rolls over, and he is stuck after", () => {
    const k = makeKratos(0, 0, 0);
    k.state = "slamWindup";
    const events = runK(k, 3, { x: 0, z: 6, alive: true });
    expect(events.some((e) => e.kind === "slam")).toBe(true);
    expect(events).toContainEqual(expect.objectContaining({ kind: "blow", damage: WAVE_DAMAGE }));
    expect(k.state).toBe("stuck");
    expect(strikeKratos(k, 1, 0, 2)).toBe("hurt");
    runK(k, STUCK_TIME, { x: 0, z: 30, alive: true });
    expect(k.state).not.toBe("stuck");
  });

  it("does not reach a hero beyond the shockwave's reach", () => {
    const k = makeKratos(0, 0, 0);
    k.state = "slamWindup";
    const blows = runK(k, 4, { x: 0, z: WAVE_REACH + 3, alive: true }).filter((e) => e.kind === "blow" && e.damage === WAVE_DAMAGE);
    expect(blows).toHaveLength(0);
  });

  it("turns aside a frontal blow while on guard", () => {
    const k = makeKratos(0, 0, 0);
    k.state = "stalk";
    expect(strikeKratos(k, 1, 0, 2)).toBe("clang");
    expect(k.hp).toBe(KRATOS_HP);
  });
});
