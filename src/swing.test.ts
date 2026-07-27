import { describe, expect, it } from "vitest";
import { ATTACK_DURATION, ATTACK_HIT_AT, Swing } from "./swing";

const DT = 1 / 60;

/** Steps `seconds` forward in frame-sized slices, counting the frames that connected. */
function advance(swing: Swing, seconds: number): number {
  let hits = 0;
  for (let t = 0; t < seconds; t += DT) if (swing.update(DT)) hits++;
  return hits;
}

describe("Swing", () => {
  it("starts idle", () => {
    const swing = new Swing();
    expect(swing.active).toBe(false);
    expect(swing.update(DT)).toBe(false);
  });

  it("goes active on start", () => {
    const swing = new Swing();
    expect(swing.start()).toBe(true);
    expect(swing.active).toBe(true);
  });

  it("refuses to restart mid-swing", () => {
    const swing = new Swing();
    swing.start();
    expect(swing.start()).toBe(false);
  });

  it("holds the blow back until the blade is out", () => {
    const swing = new Swing();
    swing.start();
    expect(advance(swing, ATTACK_HIT_AT * 0.9)).toBe(0);
  });

  it("connects once the blade is out", () => {
    const swing = new Swing();
    swing.start();
    expect(advance(swing, ATTACK_HIT_AT + DT)).toBe(1);
  });

  it("connects before the animation finishes", () => {
    // The whole point: a blow landing on the last frame arrives after the bump.
    expect(ATTACK_HIT_AT).toBeLessThan(ATTACK_DURATION);
  });

  it("connects only once per swing", () => {
    const swing = new Swing();
    swing.start();
    expect(advance(swing, ATTACK_DURATION)).toBe(1);
  });

  it("goes idle once the animation runs out", () => {
    const swing = new Swing();
    swing.start();
    advance(swing, ATTACK_DURATION + DT);
    expect(swing.active).toBe(false);
  });

  it("connects exactly once even if a frame swallows the whole swing", () => {
    const swing = new Swing();
    swing.start();
    expect(swing.update(ATTACK_DURATION * 2)).toBe(true);
    expect(swing.active).toBe(false);
    expect(swing.update(DT)).toBe(false);
  });

  it("connects again on the next swing", () => {
    const swing = new Swing();
    swing.start();
    advance(swing, ATTACK_DURATION + DT);
    swing.start();
    expect(advance(swing, ATTACK_DURATION)).toBe(1);
  });

  it("tracks how far into the swing it is", () => {
    const swing = new Swing();
    swing.start();
    expect(swing.time).toBe(0);
    swing.update(ATTACK_HIT_AT);
    expect(swing.time).toBeCloseTo(ATTACK_HIT_AT);
  });

  it("drops the swing on cancel, without connecting", () => {
    const swing = new Swing();
    swing.start();
    swing.cancel();
    expect(swing.active).toBe(false);
    expect(advance(swing, ATTACK_DURATION)).toBe(0);
  });

  it("reports no elapsed time while idle", () => {
    expect(new Swing().time).toBe(0);
  });
});
