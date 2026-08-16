import { describe, expect, it } from "vitest";
import { DOWN, LEFT, RIGHT, UP } from "./facing";
import { fits, Hero, KNOCKBACK, RADIUS, SPEED, type FloorAt } from "./hero";

const openField: FloorAt = () => true;
/** Floor everywhere except a wall running down column 5. */
const wallAtCol5: FloorAt = (col) => col !== 5;
const room = (c0: number, r0: number, c1: number, r1: number): FloorAt => {
  return (col, row) => col >= c0 && col <= c1 && row >= r0 && row <= r1;
};

const run = (hero: Hero, isFloor: FloorAt, axis: { dc: number; dr: number }, seconds: number): void => {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) hero.update(dt, { axis }, isFloor);
};

describe("fits", () => {
  it("clears a cell whose neighbours are all floor", () => {
    expect(fits(openField, 3, 3)).toBe(true);
  });

  it("refuses a position whose footprint overlaps rock", () => {
    // A radius short of half a cell means the footprint only bites into the
    // neighbouring cell once the centre is past the halfway line.
    expect(fits(wallAtCol5, 4, 0)).toBe(true);
    expect(fits(wallAtCol5, 4.5 - RADIUS + 0.01, 0)).toBe(false);
  });
});

describe("Hero.update", () => {
  it("covers SPEED cells a second on a straight run", () => {
    const hero = new Hero(2, 2);
    run(hero, openField, { dc: 1, dr: 0 }, 1);
    expect(hero.col).toBeCloseTo(2 + SPEED, 1);
    expect(hero.row).toBe(2);
  });

  it("normalises the diagonal, so cutting corners is no faster", () => {
    const hero = new Hero(2, 2);
    run(hero, openField, { dc: 1, dr: 1 }, 1);
    expect(Math.hypot(hero.col - 2, hero.row - 2)).toBeCloseTo(SPEED, 1);
  });

  it("takes its heading from the stick, not the number of keys held", () => {
    const stick = new Hero(2, 2);
    run(stick, openField, { dc: 40, dr: 0 }, 1);
    expect(stick.col).toBeCloseTo(2 + SPEED, 1);
  });

  it("slides along a wall instead of sticking to it", () => {
    const hero = new Hero(3, 3);
    run(hero, wallAtCol5, { dc: 1, dr: 1 }, 1);
    expect(hero.col).toBeLessThan(5);
    expect(hero.row).toBeGreaterThan(3.5);
  });

  it("faces the way it is moving", () => {
    const hero = new Hero(3, 3);
    run(hero, openField, { dc: -1, dr: 0 }, 0.1);
    expect(hero.facing).toBe(LEFT);
    run(hero, openField, { dc: 0, dr: -1 }, 0.1);
    expect(hero.facing).toBe(UP);
    run(hero, openField, { dc: 1, dr: 0 }, 0.1);
    expect(hero.facing).toBe(RIGHT);
    run(hero, openField, { dc: 0, dr: 1 }, 0.1);
    expect(hero.facing).toBe(DOWN);
  });

  it("holds its facing while standing still", () => {
    const hero = new Hero(3, 3);
    run(hero, openField, { dc: -1, dr: 0 }, 0.1);
    run(hero, openField, { dc: 0, dr: 0 }, 0.5);
    expect(hero.facing).toBe(LEFT);
  });
});

describe("Hero.knockback", () => {
  it("covers KNOCKBACK cells however the frame rate falls", () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
      const hero = new Hero(10, 10);
      hero.knockback(1, 0);
      for (let t = 0; t < 2; t += dt) hero.update(dt, { axis: { dc: 0, dr: 0 } }, openField);
      expect(hero.col - 10).toBeCloseTo(KNOCKBACK, 2);
    }
  });

  it("is stopped by a wall like walking is", () => {
    const hero = new Hero(6, 6);
    hero.knockback(-1, 0); // shoved toward the wall in column 5
    for (let t = 0; t < 2; t += 1 / 60) hero.update(1 / 60, { axis: { dc: 0, dr: 0 } }, wallAtCol5);
    expect(hero.col).toBeGreaterThan(5.5);
  });

  it("ignores a zero-length shove rather than dividing by it", () => {
    const hero = new Hero(4, 4);
    hero.knockback(0, 0);
    run(hero, openField, { dc: 0, dr: 0 }, 0.5);
    expect(hero.col).toBe(4);
    expect(hero.row).toBe(4);
  });
});

describe("Hero in a one-cell corridor", () => {
  it("walks the length of it without snagging", () => {
    const corridor = room(2, 5, 12, 5);
    const hero = new Hero(2, 5);
    run(hero, corridor, { dc: 1, dr: 0 }, 3);
    expect(hero.col).toBeGreaterThan(12);
    expect(hero.row).toBeCloseTo(5, 5);
  });
});
