import { describe, expect, it } from "vitest";
import { autoTurn, dragTurn, lockOn, moveFromStick, stickFrom } from "./follow";

describe("the stick", () => {
  it("walks away from the camera when pushed up", () => {
    const m = moveFromStick(0, -1, 0);
    expect(m.x).toBeCloseTo(0);
    expect(m.z).toBeCloseTo(1);
  });

  it("walks to the camera's right when pushed right", () => {
    // Facing +z with y up, right is -x.
    const m = moveFromStick(1, 0, 0);
    expect(m.x).toBeCloseTo(-1);
    expect(m.z).toBeCloseTo(0);
  });

  it("turns with the camera", () => {
    const m = moveFromStick(0, -1, Math.PI / 2);
    expect(m.x).toBeCloseTo(1);
    expect(m.z).toBeCloseTo(0);
  });

  it("reads centred inside the dead zone", () => {
    expect(stickFrom(3, 0, 50)).toEqual({ x: 0, y: 0 });
  });

  it("tops out at full tilt past its rim", () => {
    const s = stickFrom(0, 400, 50);
    expect(s.x).toBeCloseTo(0);
    expect(s.y).toBeCloseTo(1);
  });

  it("reads part tilt as part tilt", () => {
    expect(stickFrom(25, 0, 50).x).toBeCloseTo(0.5);
  });
});

describe("the camera", () => {
  it("swings round after a hero walking right, the way a drag right would", () => {
    expect(Math.sign(autoTurn(0, 1, 0.1))).toBe(Math.sign(dragTurn(0, 10)));
  });

  it("leaves the camera be when walking straight", () => {
    expect(autoTurn(0.3, 0, 0.1)).toBeCloseTo(0.3);
  });

  it("turns toward a god to one side", () => {
    const yaw = lockOn(0, { x: 0, z: 0 }, { x: 10, z: 0 }, 0.1);
    expect(yaw).toBeGreaterThan(0);
  });
});
