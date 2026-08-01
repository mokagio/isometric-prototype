import { describe, expect, it } from "vitest";
import { FIRST_TARGET, hpFor, Progress, targetFor } from "./levels";

// The ladder as designed, 0-based. Every other level moves one dial.
const LADDER = [
  { gems: 6, hearts: 1 },
  { gems: 8, hearts: 1 },
  { gems: 8, hearts: 2 },
  { gems: 10, hearts: 2 },
  { gems: 10, hearts: 3 },
  { gems: 12, hearts: 3 },
];

describe("the ladder", () => {
  it("climbs the rungs it was designed to", () => {
    expect(LADDER.map((_, i) => targetFor(i))).toEqual(LADDER.map((l) => l.gems));
    expect(LADDER.map((_, i) => hpFor(i))).toEqual(LADDER.map((l) => l.hearts));
  });

  it("moves one dial at a time, never both", () => {
    for (let level = 1; level < 20; level++) {
      const gemsMoved = targetFor(level) !== targetFor(level - 1);
      const heartsMoved = hpFor(level) !== hpFor(level - 1);
      expect(gemsMoved && heartsMoved, `level ${level}`).toBe(false);
      expect(gemsMoved || heartsMoved, `level ${level}`).toBe(true);
    }
  });

  it("never runs out of rungs, and never eases off", () => {
    for (let level = 1; level < 200; level++) {
      expect(targetFor(level)).toBeGreaterThanOrEqual(targetFor(level - 1));
      expect(hpFor(level)).toBeGreaterThanOrEqual(hpFor(level - 1));
    }
    expect(targetFor(199)).toBeGreaterThan(FIRST_TARGET);
  });

  it("opens on one heart, so the first monster dies to a single blow", () => {
    expect(hpFor(0)).toBe(1);
  });
});

describe("Progress", () => {
  it("starts at the foot of the ladder", () => {
    const p = new Progress();
    expect(p.level).toBe(0);
    expect(p.banked).toBe(0);
    expect(p.target).toBe(LADDER[0]!.gems);
    expect(p.hp).toBe(LADDER[0]!.hearts);
  });

  it("banks gems without clearing the level until the target is met", () => {
    const p = new Progress();
    for (let i = 1; i < LADDER[0]!.gems; i++) {
      expect(p.bank(1), `gem ${i}`).toBe(false);
      expect(p.banked).toBe(i);
    }
    expect(p.bank(1)).toBe(true);
    expect(p.level).toBe(1);
  });

  it("starts the next level's count from zero, not from the last one's total", () => {
    const p = new Progress();
    p.bank(LADDER[0]!.gems);
    expect(p.banked).toBe(0);
    expect(p.target).toBe(LADDER[1]!.gems);
  });

  it("carries the surplus when several land at once", () => {
    const p = new Progress();
    p.bank(LADDER[0]!.gems - 1);
    expect(p.bank(3)).toBe(true);
    expect(p.banked).toBe(2);
  });

  it("toughens the monsters as it climbs", () => {
    const p = new Progress();
    const hp = [p.hp];
    for (let i = 0; i < 4; i++) {
      p.bank(p.target);
      hp.push(p.hp);
    }
    expect(hp).toEqual(LADDER.slice(0, 5).map((l) => l.hearts));
  });

  it("sends a different creature every level, wrapping at the end of the cast", () => {
    const p = new Progress();
    const seen = [p.kind(3)];
    for (let i = 0; i < 3; i++) {
      p.bank(p.target);
      seen.push(p.kind(3));
    }
    expect(seen).toEqual([0, 1, 2, 0]);
  });

  it("stays on the one creature a skin of one holds", () => {
    const p = new Progress();
    p.bank(p.target);
    expect(p.kind(1)).toBe(0);
    expect(p.kind(0)).toBe(0);
  });

  it("goes back to the foot of the ladder on reset", () => {
    const p = new Progress();
    p.bank(p.target + 1);
    p.reset();
    expect(p.level).toBe(0);
    expect(p.banked).toBe(0);
  });
});
