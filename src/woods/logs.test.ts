import { describe, expect, it } from "vitest";
import { Logs, LOGS_PER_TREE, PICKUP_RANGE } from "./logs";

const DT = 1 / 60;
const STUMP = { x: 200, y: 200 };
const FAR = { x: 1000, y: 1000 }; // feet nowhere near the logs

/** Runs the logs for `secs`, with the feet parked somewhere. */
const settle = (logs: Logs, secs = 3, feet = FAR): void => {
  for (let i = 0; i < secs / DT; i++) logs.update(DT, feet);
};

describe("Logs.spawn", () => {
  it("bursts three logs out of a felled tree", () => {
    const logs = new Logs();
    logs.spawn(STUMP);
    expect(logs.list().length).toBe(LOGS_PER_TREE);
  });

  it("throws them up and outwards, not straight down", () => {
    const logs = new Logs();
    logs.spawn(STUMP);
    logs.update(DT, FAR);
    for (const log of logs.list()) expect(log.z).toBeGreaterThan(0);
    expect(new Set(logs.list().map((l) => Math.sign(l.vx))).size).toBeGreaterThan(1); // they scatter
  });

  it("lands them all, near the stump and in front of it", () => {
    const logs = new Logs();
    logs.spawn(STUMP);
    settle(logs);
    for (const log of logs.list()) {
      expect(log.resting).toBe(true);
      expect(log.z).toBe(0);
      expect(Math.hypot(log.x - STUMP.x, log.y - STUMP.y)).toBeLessThan(32); // within two tiles
      expect(log.y).toBeGreaterThanOrEqual(STUMP.y); // never behind the stump
    }
  });

  it("stops them bouncing, rather than jittering forever", () => {
    const logs = new Logs();
    logs.spawn(STUMP);
    settle(logs);
    const still = logs.list().map((l) => ({ x: l.x, y: l.y }));
    settle(logs, 1);
    expect(logs.list().map((l) => ({ x: l.x, y: l.y }))).toEqual(still);
  });
});

describe("Logs.update collecting", () => {
  it("counts nothing until something is walked over", () => {
    const logs = new Logs();
    logs.spawn(STUMP);
    settle(logs);
    expect(logs.collected).toBe(0);
    expect(logs.list().length).toBe(LOGS_PER_TREE);
  });

  it("sweeps up a log underfoot and counts it", () => {
    const logs = new Logs();
    logs.spawn(STUMP);
    settle(logs);
    const target = logs.list()[0]!;
    const taken = logs.update(DT, { x: target.x, y: target.y });
    expect(taken).toBe(1);
    expect(logs.collected).toBe(1);
    expect(logs.list().length).toBe(LOGS_PER_TREE - 1);
  });

  it("leaves a log just out of reach where it lies", () => {
    const logs = new Logs();
    logs.spawn(STUMP);
    settle(logs);
    // Clear the other two first — they land close enough together that standing
    // clear of one otherwise means standing on another.
    while (logs.list().length > 1) {
      const first = logs.list()[0]!;
      logs.update(DT, { x: first.x, y: first.y });
    }
    const last = logs.list()[0]!;
    const before = logs.collected;
    logs.update(DT, { x: last.x + PICKUP_RANGE + 1, y: last.y });
    expect(logs.collected).toBe(before);
    expect(logs.list().length).toBe(1);
  });

  it("will not snatch one out of the air", () => {
    const logs = new Logs();
    logs.spawn(STUMP);
    logs.update(DT, FAR);
    const flying = logs.list()[0]!;
    expect(flying.resting).toBe(false);
    logs.update(DT, { x: flying.x, y: flying.y });
    expect(logs.collected).toBe(0);
  });

  it("keeps counting across several trees", () => {
    const logs = new Logs();
    logs.spawn(STUMP);
    settle(logs);
    while (logs.list().length) logs.update(DT, { x: logs.list()[0]!.x, y: logs.list()[0]!.y });
    expect(logs.collected).toBe(LOGS_PER_TREE);

    logs.spawn({ x: 400, y: 400 });
    settle(logs);
    while (logs.list().length) logs.update(DT, { x: logs.list()[0]!.x, y: logs.list()[0]!.y });
    expect(logs.collected).toBe(2 * LOGS_PER_TREE);
  });
});
