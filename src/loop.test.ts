import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Loop, MAX_DT } from "./loop";

// A hand-driven requestAnimationFrame: `tick(now)` fires the frame the loop
// queued, at the timestamp a test chooses. cancel clears the pending frame, as
// the browser's does.
let scheduled: FrameRequestCallback | null;
let rafCalls: number;

beforeEach(() => {
  scheduled = null;
  rafCalls = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCalls++;
    scheduled = cb;
    return rafCalls;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    scheduled = null;
  });
});

afterEach(() => vi.unstubAllGlobals());

const tick = (now: number): void => {
  const cb = scheduled;
  scheduled = null;
  cb?.(now);
};

describe("Loop", () => {
  it("hands the first frame a zero delta", () => {
    const dts: number[] = [];
    new Loop((dt) => dts.push(dt)).start();
    tick(0);
    expect(dts).toEqual([0]);
  });

  it("hands each later frame the seconds since the previous one", () => {
    const dts: number[] = [];
    new Loop((dt) => dts.push(dt)).start();
    tick(0);
    tick(16);
    tick(32);
    expect(dts[1]).toBeCloseTo(0.016);
    expect(dts[2]).toBeCloseTo(0.016);
  });

  it("clamps a long background gap to MAX_DT", () => {
    const dts: number[] = [];
    new Loop((dt) => dts.push(dt)).start();
    tick(0);
    tick(5000); // five seconds away
    expect(dts[1]).toBe(MAX_DT);
  });

  it("honours a custom max delta", () => {
    const dts: number[] = [];
    new Loop((dt) => dts.push(dt), 0.1).start();
    tick(0);
    tick(1000);
    expect(dts[1]).toBe(0.1);
  });

  it("re-arms itself for the next frame while running", () => {
    let count = 0;
    new Loop(() => count++).start();
    tick(0);
    tick(16);
    expect(count).toBe(2);
    expect(scheduled).not.toBeNull();
  });

  it("stops re-arming after stop()", () => {
    let count = 0;
    const loop = new Loop(() => count++);
    loop.start();
    tick(0);
    loop.stop();
    expect(scheduled).toBeNull(); // the queued frame was cancelled
    tick(16);
    expect(count).toBe(1);
  });

  it("ignores a redundant start()", () => {
    const loop = new Loop(() => {});
    loop.start();
    loop.start();
    expect(rafCalls).toBe(1);
  });

  it("restarts the clock after a stop, so the next frame is a fresh zero", () => {
    const dts: number[] = [];
    const loop = new Loop((dt) => dts.push(dt));
    loop.start();
    tick(0);
    tick(100);
    loop.stop();
    loop.start();
    tick(200); // long after the last frame, but the clock was reset
    expect(dts.at(-1)).toBe(0);
  });
});
