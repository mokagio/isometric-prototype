import { describe, expect, it } from "vitest";
import { GAZE_WINDUP, gazeMeets, makeMedusa, MEDUSA_HP, STALK_MAX, strikeMedusa, stun, STUN_TIME, updateMedusa, type Medusa, type MedusaEvent } from "./medusa";

const run = (m: Medusa, s: number, hero: { x: number; z: number; alive: boolean }): MedusaEvent[] => {
  const out: MedusaEvent[] = [];
  for (let t = 0; t < s; t += 1 / 60) out.push(...updateMedusa(m, 1 / 60, hero));
  return out;
};

describe("Medusa", () => {
  it("warns with a glare before her gaze comes", () => {
    const m = makeMedusa(0, 0, 0);
    m.state = "stalk";
    const far = { x: 0, z: 20, alive: true };
    const events = run(m, STALK_MAX + GAZE_WINDUP + 0.1, far);
    const kinds = events.map((e) => e.kind);
    expect(kinds.indexOf("glare")).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf("gaze")).toBeGreaterThan(kinds.indexOf("glare"));
  });

  it("turns to stone a hero looking at her, misses one looking away, and rebounds off a shield", () => {
    const m = { x: 0, z: 10 };
    // Facing +z, toward her.
    expect(gazeMeets({ x: 0, z: 0, yaw: 0, blocking: false }, m)).toBe("stone");
    expect(gazeMeets({ x: 0, z: 0, yaw: Math.PI, blocking: false }, m)).toBe("safe");
    expect(gazeMeets({ x: 0, z: 0, yaw: 0, blocking: true }, m)).toBe("reflect");
    // A shield held the wrong way does nothing; looking away is what saves you.
    expect(gazeMeets({ x: 0, z: 0, yaw: Math.PI, blocking: true }, m)).toBe("safe");
  });

  it("is stunned by her own gaze and takes blows twice over until she shakes it off", () => {
    const m = makeMedusa(0, 0, 0);
    m.state = "stalk";
    stun(m);
    strikeMedusa(m, 2);
    expect(m.hp).toBe(MEDUSA_HP - 4);
    run(m, STUN_TIME + 0.05, { x: 0, z: 20, alive: true });
    expect(m.state).not.toBe("stunned");
    strikeMedusa(m, 2);
    expect(m.hp).toBe(MEDUSA_HP - 6);
  });
});
