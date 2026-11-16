import { describe, expect, it } from "vitest";
import { carve, DOOR_ROW, MAZE, mazeWalls, ROOM } from "./maze";
import { CHARGE_DAMAGE, makeMinotaur, PAW_TIME, strikeMinotaur, STUCK_TIME, updateMinotaur, type Minotaur, type MinotaurEvent } from "./minotaur";

const run = (m: Minotaur, s: number, hero: { x: number; z: number; alive: boolean }, blocked = (_x: number, z: number) => z > 20): MinotaurEvent[] => {
  const out: MinotaurEvent[] = [];
  for (let t = 0; t < s; t += 1 / 60) out.push(...updateMinotaur(m, 1 / 60, hero, blocked));
  return out;
};

describe("the labyrinth", () => {
  it("reaches every cell, and the room in the middle, from the door", () => {
    const { east, south } = carve();
    const n = MAZE.size;
    const seen = new Set<string>([`${n - 1},${DOOR_ROW}`]);
    const queue: Array<[number, number]> = [[n - 1, DOOR_ROW]];
    while (queue.length > 0) {
      const [c, r] = queue.shift()!;
      const go = (nc: number, nr: number, open: boolean): void => {
        if (open && !seen.has(`${nc},${nr}`)) {
          seen.add(`${nc},${nr}`);
          queue.push([nc, nr]);
        }
      };
      if (c < n - 1) go(c + 1, r, !east[c]![r]);
      if (c > 0) go(c - 1, r, !east[c - 1]![r]);
      if (r < n - 1) go(c, r + 1, !south[c]![r]);
      if (r > 0) go(c, r - 1, !south[c]![r - 1]);
    }
    expect(seen.size).toBe(n * n);
    expect(seen.has(`${ROOM.from + 1},${ROOM.from + 1}`)).toBe(true);
  });

  it("is a real maze: plenty of walls, the same every game", () => {
    expect(mazeWalls().length).toBeGreaterThan(40);
    expect(mazeWalls()).toEqual(mazeWalls());
  });
});

describe("the Minotaur", () => {
  it("paws the ground then charges, goring a hero in his path", () => {
    const m = makeMinotaur(0, 0, 0);
    m.state = "paw";
    const events = run(m, PAW_TIME + 0.6, { x: 0, z: 8, alive: true });
    expect(events).toContainEqual(expect.objectContaining({ kind: "blow", damage: CHARGE_DAMAGE }));
  });

  it("drives his horns into a wall and is stuck there, open to blows from the front", () => {
    const m = makeMinotaur(0, 0, 0);
    m.state = "paw";
    const events = run(m, PAW_TIME + 2, { x: 5, z: 30, alive: true });
    expect(events).toContainEqual({ kind: "stuck" });
    expect(m.state).toBe("stuck");
    expect(strikeMinotaur(m, 1, m.x, m.z + 2)).toBe("hurt");
    run(m, STUCK_TIME + 0.05, { x: 5, z: 30, alive: true });
    expect(m.state).not.toBe("stuck");
  });

  it("turns aside a frontal blow while on guard", () => {
    const m = makeMinotaur(0, 0, 0);
    m.state = "stalk";
    expect(strikeMinotaur(m, 1, 0, 2)).toBe("clang");
  });
});
