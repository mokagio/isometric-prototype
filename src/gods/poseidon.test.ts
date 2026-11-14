import { describe, expect, it } from "vitest";
import {
  AIM_TIME,
  FLOOD_AT,
  FLOOD_TIME,
  floodLevel,
  INTRO_TIME,
  makePoseidon,
  POSEIDON_HP,
  SPEAR_DAMAGE,
  STALK_MIN,
  strikePoseidon,
  THROW_FROM,
  UNARMED_TIME,
  updatePoseidon,
  type Poseidon,
  type PoseidonEvent,
} from "./poseidon";

const arena = { x: 0, z: 0, r: 16 };

const run = (p: Poseidon, seconds: number, hero: { x: number; z: number; alive: boolean }): PoseidonEvent[] => {
  const out: PoseidonEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) out.push(...updatePoseidon(p, 1 / 60, hero, arena));
  return out;
};

const stalking = (): Poseidon => {
  const p = makePoseidon(0, 0, 0);
  p.state = "stalk";
  return p;
};

describe("Poseidon", () => {
  it("roars before the fight starts", () => {
    const p = makePoseidon(0, -5, 0);
    expect(run(p, INTRO_TIME + 0.05, { x: 0, z: 5, alive: true })).toContainEqual({ kind: "roar" });
  });

  it("parries a frontal blow while he holds his trident", () => {
    const p = stalking();
    expect(strikePoseidon(p, 1, 0, 2)).toBe("clang");
    expect(p.hp).toBe(POSEIDON_HP);
  });

  it("throws his trident at a hero who keeps away", () => {
    const p = stalking();
    const far = { x: 0, z: THROW_FROM + 5, alive: true };
    const events = run(p, STALK_MIN + AIM_TIME + 0.1, far);
    expect(events).toContainEqual({ kind: "throw" });
    expect(p.state).toBe("unarmed");
  });

  it("hits a hero who stands in the trident's path", () => {
    const p = stalking();
    p.state = "aim";
    const hero = { x: 0, z: 9, alive: true };
    const blows = run(p, AIM_TIME + 1, hero).filter((e) => e.kind === "blow");
    expect(blows).toHaveLength(1);
    expect(blows[0]).toMatchObject({ damage: SPEAR_DAMAGE, heavy: true });
    // The blow comes from his side, so a shield raised toward him stops it.
    expect((blows[0] as { z: number }).z).toBeLessThan(hero.z);
  });

  it("sticks the trident in the wall when it misses", () => {
    const p = stalking();
    p.state = "aim";
    const events = run(p, AIM_TIME + 1.5, { x: 0, z: 30, alive: true });
    expect(events.some((e) => e.kind === "stuck")).toBe(true);
  });

  it("can be hit from the front once the trident is thrown, and takes it back after", () => {
    const p = stalking();
    p.state = "unarmed";
    expect(strikePoseidon(p, 1, 0, 2)).toBe("hurt");
    run(p, UNARMED_TIME + 0.05, { x: 0, z: 2, alive: true });
    expect(p.state).not.toBe("unarmed");
    expect(p.spear).toBeNull();
  });

  it("floods the arena at each line, and nothing reaches him while the sea is up", () => {
    const p = stalking();
    p.hp = Math.floor(POSEIDON_HP * FLOOD_AT[0]!);
    const events = run(p, 0.1, { x: 0, z: 2, alive: true });
    expect(events).toContainEqual({ kind: "flood" });
    run(p, 2, { x: 0, z: 2, alive: true });
    expect(floodLevel(p)).toBe(1);
    expect(strikePoseidon(p, 1, 0, -2)).toBe("clang");
    run(p, FLOOD_TIME, { x: 0, z: 2, alive: true });
    expect(floodLevel(p)).toBe(0);
    expect(p.floods).toBe(1);
  });

  it("floods only once per line", () => {
    const p = stalking();
    p.hp = Math.floor(POSEIDON_HP * FLOOD_AT[0]!);
    const floods = run(p, FLOOD_TIME + 3, { x: 0, z: 30, alive: true }).filter((e) => e.kind === "flood");
    expect(floods).toHaveLength(1);
  });
});
