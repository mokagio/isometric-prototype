import { describe, expect, it } from "vitest";
import { EMERGE_TIME, KRONOS_HP, makeKronos, SLOW_TIME, STALK_MAX, strikeKronos, SWEEP_DAMAGE, TIRED_TIME, updateKronos, WINDUP_TIME, type Kronos, type KronosEvent } from "./kronos";

const run = (k: Kronos, seconds: number, hero: { x: number; z: number; alive: boolean }): KronosEvent[] => {
  const out: KronosEvent[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) out.push(...updateKronos(k, 1 / 60, hero));
  return out;
};

describe("Kronos", () => {
  it("walks out of the door before he fights", () => {
    const k = makeKronos(0, 0, 0);
    const events = run(k, EMERGE_TIME + 0.05, { x: 0, z: 30, alive: true });
    expect(k.z).toBeGreaterThan(4);
    expect(events).toContainEqual({ kind: "roar" });
  });

  it("sweeps his scythe all the way round, so the hero behind him is hit too", () => {
    const k = makeKronos(0, 0, 0);
    k.state = "windup";
    const events = run(k, WINDUP_TIME + 0.05, { x: 0, z: -2, alive: true });
    expect(events).toContainEqual({ kind: "blow", damage: SWEEP_DAMAGE, x: 0, z: 0, heavy: true });
  });

  it("slows time, then is worn out and open when it runs out", () => {
    const k = makeKronos(0, 0, 0);
    k.state = "stalk";
    const far = { x: 0, z: 30, alive: true };
    const cast = run(k, STALK_MAX + 1.1, far);
    expect(cast).toContainEqual({ kind: "slow" });
    expect(k.slow).toBeGreaterThan(0);
    const after = run(k, SLOW_TIME, far);
    expect(after).toContainEqual({ kind: "tired" });
    expect(strikeKronos(k, 1, k.x + Math.sin(k.yaw) * 2, k.z + Math.cos(k.yaw) * 2)).toBe("hurt");
    run(k, TIRED_TIME + 0.05, far);
    expect(k.state).not.toBe("tired");
  });

  it("turns aside a frontal blow while on guard", () => {
    const k = makeKronos(0, 0, 0);
    k.state = "stalk";
    expect(strikeKronos(k, 1, 0, 2)).toBe("clang");
    expect(k.hp).toBe(KRONOS_HP);
  });
});
