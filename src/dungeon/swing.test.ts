import { describe, expect, it } from "vitest";
import { ATTACK_DURATION, ATTACK_HIT_AT, Swing } from "./swing";

describe("Swing", () => {
  it("is idle until started", () => {
    const swing = new Swing();
    expect(swing.active).toBe(false);
    expect(swing.update(0.1)).toBe(false);
  });

  it("connects exactly once, partway through", () => {
    const swing = new Swing();
    swing.start();
    let hits = 0;
    for (let t = 0; t < ATTACK_DURATION; t += 1 / 60) if (swing.update(1 / 60)) hits++;
    expect(hits).toBe(1);
  });

  it("connects no later than ATTACK_HIT_AT", () => {
    const swing = new Swing();
    swing.start();
    let elapsed = 0;
    while (!swing.update(1 / 60)) elapsed += 1 / 60;
    expect(elapsed).toBeLessThanOrEqual(ATTACK_HIT_AT + 1 / 60);
  });

  it("refuses to restart mid-swing", () => {
    const swing = new Swing();
    expect(swing.start()).toBe(true);
    expect(swing.start()).toBe(false);
    swing.update(ATTACK_DURATION);
    expect(swing.start()).toBe(true);
  });

  it("ends itself once the animation is out", () => {
    const swing = new Swing();
    swing.start();
    swing.update(ATTACK_DURATION);
    expect(swing.active).toBe(false);
  });

  it("runs progress from the wind-up to the follow-through", () => {
    const swing = new Swing();
    swing.start();
    expect(swing.progress).toBe(0);
    swing.update(ATTACK_DURATION / 2);
    expect(swing.progress).toBeCloseTo(0.5, 2);
  });

  it("drops the swing on cancel", () => {
    const swing = new Swing();
    swing.start();
    swing.cancel();
    expect(swing.active).toBe(false);
    expect(swing.update(1)).toBe(false);
  });
});
