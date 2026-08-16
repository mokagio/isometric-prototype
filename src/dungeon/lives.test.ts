import { describe, expect, it } from "vitest";
import { DEATH_FADE, INVULN, Lives, MAX_LIVES } from "./lives";

/** Spend every heart without letting the death clock start early. */
const knockOut = (lives: Lives): void => {
  while (lives.alive) {
    lives.hit();
    if (lives.alive) lives.update(INVULN + 0.01);
  }
};

describe("Lives", () => {
  it("starts full and alive", () => {
    const lives = new Lives();
    expect(lives.lives).toBe(MAX_LIVES);
    expect(lives.alive).toBe(true);
    expect(lives.gameOver).toBe(false);
  });

  it("swallows every hit inside the immunity window", () => {
    const lives = new Lives();
    expect(lives.hit()).toBe(true);
    expect(lives.hit()).toBe(false);
    lives.update(INVULN / 2);
    expect(lives.hit()).toBe(false);
    lives.update(INVULN / 2 + 0.01);
    expect(lives.hit()).toBe(true);
    expect(lives.lives).toBe(MAX_LIVES - 2);
  });

  it("stops counting hits once the hero is down", () => {
    const lives = new Lives();
    knockOut(lives);
    expect(lives.alive).toBe(false);
    expect(lives.hit()).toBe(false);
    expect(lives.lives).toBe(0);
  });

  it("raises the sign only once the death fade has run out", () => {
    const lives = new Lives();
    knockOut(lives);
    lives.update(DEATH_FADE - 0.1);
    expect(lives.gameOver).toBe(false);
    lives.update(0.2);
    expect(lives.gameOver).toBe(true);
  });

  it("blinks while immune and is solid otherwise", () => {
    const lives = new Lives();
    expect(lives.alpha()).toBe(1);
    lives.hit();
    const samples = new Set<number>();
    for (let t = 0; t < INVULN; t += 0.02) {
      samples.add(lives.alpha());
      lives.update(0.02);
    }
    expect(samples.size).toBeGreaterThan(1);
  });

  it("fades out over the death, then holds at nothing", () => {
    const lives = new Lives();
    knockOut(lives);
    lives.update(DEATH_FADE / 2);
    expect(lives.alpha()).toBeCloseTo(0.5, 1);
    lives.update(DEATH_FADE);
    expect(lives.alpha()).toBe(0);
  });

  it("comes back whole on reset", () => {
    const lives = new Lives();
    lives.hit();
    lives.update(2);
    lives.reset();
    expect(lives.lives).toBe(MAX_LIVES);
    expect(lives.invulnerable).toBe(false);
    expect(lives.deathTime).toBe(0);
  });
});
