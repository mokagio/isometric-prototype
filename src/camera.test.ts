import { describe, expect, it } from "vitest";
import { Camera, FOLLOW_RATE } from "./camera";
import { SX, SY, SZ } from "./iso";

const VIEW = { width: 800, height: 600 };

describe("Camera.origin", () => {
  it("puts the target's cell at the viewport centre, one step up", () => {
    const o = new Camera(0).origin({ col: 0, row: 0 }, VIEW);
    expect(o.x).toBe(VIEW.width / 2);
    expect(o.y).toBe(VIEW.height / 2 - SY);
  });

  it("scrolls the world opposite the target's screen position", () => {
    const cam = new Camera(0);
    const base = cam.origin({ col: 0, row: 0 }, VIEW);
    const east = cam.origin({ col: 1, row: 0 }, VIEW); // one cell along +col
    expect(base.x - east.x).toBe(SX); // screen-x runs with col - row
    expect(base.y - east.y).toBe(SY); // and screen-y with col + row
  });

  it("lifts the origin by one level's screen height per unit of camera height", () => {
    const low = new Camera(0).origin({ col: 0, row: 0 }, VIEW);
    const high = new Camera(1).origin({ col: 0, row: 0 }, VIEW);
    expect(high.y - low.y).toBe(SZ);
  });
});

describe("Camera.follow", () => {
  it("eases a fraction of the way toward the target each frame", () => {
    const cam = new Camera(0);
    cam.follow(10, 1 / 16); // dt * rate = 8/16 = 0.5
    expect(cam.height).toBe(5);
  });

  it("never overshoots, however large the step", () => {
    const cam = new Camera(0);
    cam.follow(10, 100); // dt * rate clamps to 1
    expect(cam.height).toBe(10);
  });

  it("converges on the target over many frames", () => {
    const cam = new Camera(0);
    for (let i = 0; i < 200; i++) cam.follow(10, 1 / 60);
    expect(cam.height).toBeCloseTo(10, 6);
  });

  it("uses FOLLOW_RATE when no rate is given", () => {
    const cam = new Camera(0);
    cam.follow(10, 1 / FOLLOW_RATE); // dt * FOLLOW_RATE = 1 → full step
    expect(cam.height).toBe(10);
  });

  it("reflects the new height in the next origin", () => {
    const cam = new Camera(0);
    const before = cam.origin({ col: 0, row: 0 }, VIEW).y;
    cam.follow(2, 1 / FOLLOW_RATE); // full step to z = 2
    const after = cam.origin({ col: 0, row: 0 }, VIEW).y;
    expect(after - before).toBe(2 * SZ);
  });
});

describe("Camera.snap", () => {
  it("jumps straight to the height with no easing", () => {
    const cam = new Camera(0);
    cam.snap(7);
    expect(cam.height).toBe(7);
  });
});
