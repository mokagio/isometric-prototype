import { describe, expect, it } from "vitest";
import { DEATH_FADE, INVULN, Lives, MAX_LIVES } from "./lives";

/** A hero with `spent` hearts gone and the immunity from the last one worn off. */
function drained(spent: number): Lives {
  const lives = new Lives();
  for (let i = 0; i < spent; i++) {
    lives.hit();
    if (lives.alive) lives.update(INVULN); // past the last heart, updating would advance the fade
  }
  return lives;
}

describe("Lives", () => {
  it("starts on a full bar", () => {
    const lives = new Lives();
    expect(lives.lives).toBe(MAX_LIVES);
    expect(lives.alive).toBe(true);
    expect(lives.gameOver).toBe(false);
  });

  it("spends a heart per hit", () => {
    const lives = new Lives();
    expect(lives.hit()).toBe(true);
    expect(lives.lives).toBe(MAX_LIVES - 1);
  });

  it("swallows hits taken inside the immunity window", () => {
    const lives = new Lives();
    lives.hit();
    lives.update(INVULN * 0.9);
    expect(lives.hit()).toBe(false);
    expect(lives.lives).toBe(MAX_LIVES - 1);
  });

  it("takes the next hit once the immunity runs out", () => {
    const lives = new Lives();
    lives.hit();
    lives.update(INVULN);
    expect(lives.hit()).toBe(true);
    expect(lives.lives).toBe(MAX_LIVES - 2);
  });

  it("empties the bar after a hit per heart", () => {
    const lives = drained(MAX_LIVES);
    expect(lives.lives).toBe(0);
    expect(lives.alive).toBe(false);
  });

  it("cannot be knocked below zero", () => {
    const lives = drained(MAX_LIVES);
    expect(lives.hit()).toBe(false);
    expect(lives.lives).toBe(0);
  });
});

describe("Lives.alpha", () => {
  it("draws the hero solid when untouched", () => {
    expect(new Lives().alpha()).toBe(1);
  });

  it("blinks through the immunity window", () => {
    const lives = new Lives();
    lives.hit();
    const step = INVULN / 40;
    const seen = new Set<number>();
    for (let t = 0; t < INVULN; t += step) {
      seen.add(lives.alpha());
      lives.update(step);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(Math.min(...seen)).toBeLessThan(1);
  });

  it("stops blinking once the immunity runs out", () => {
    const lives = new Lives();
    lives.hit();
    lives.update(INVULN);
    expect(lives.alpha()).toBe(1);
  });

  it("fades out over the death animation", () => {
    const lives = drained(MAX_LIVES);
    expect(lives.alpha()).toBe(1);
    lives.update(DEATH_FADE / 2);
    expect(lives.alpha()).toBeCloseTo(0.5);
    lives.update(DEATH_FADE / 2);
    expect(lives.alpha()).toBe(0);
  });

  it("never asks for a negative alpha once the fade overruns", () => {
    const lives = drained(MAX_LIVES);
    lives.update(DEATH_FADE * 3);
    expect(lives.alpha()).toBe(0);
  });
});

describe("Lives.gameOver", () => {
  it("holds the sign back until the hero has faded", () => {
    const lives = drained(MAX_LIVES);
    expect(lives.gameOver).toBe(false);
    lives.update(DEATH_FADE * 0.9);
    expect(lives.gameOver).toBe(false);
    lives.update(DEATH_FADE * 0.1);
    expect(lives.gameOver).toBe(true);
  });

  it("stays down once the sign is up", () => {
    const lives = drained(MAX_LIVES);
    lives.update(DEATH_FADE * 10);
    expect(lives.gameOver).toBe(true);
  });
});

describe("Lives.reset", () => {
  it("refills the bar and clears the fade", () => {
    const lives = drained(MAX_LIVES);
    lives.update(DEATH_FADE);
    lives.reset();
    expect(lives.lives).toBe(MAX_LIVES);
    expect(lives.alive).toBe(true);
    expect(lives.gameOver).toBe(false);
    expect(lives.alpha()).toBe(1);
  });

  it("clears the immunity so the next hit lands", () => {
    const lives = new Lives();
    lives.hit();
    lives.reset();
    expect(lives.invulnerable).toBe(false);
    expect(lives.hit()).toBe(true);
  });
});
