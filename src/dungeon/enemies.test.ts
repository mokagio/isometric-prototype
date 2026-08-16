import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSpawn, generateDungeon, type Dungeon } from "./dungeon";
import {
  CONTACT,
  DEATH_TIME,
  EnemyField,
  KINDS,
  MELEE,
  ROSTER_MAX_PER_ROOM,
  SAFE_STEPS,
  SEPARATION,
  SPEED,
  WAKE_STEPS,
} from "./enemies";
import { FlowField } from "./flow";

// Vitest runs in node, so `Image` has to be supplied. Each instance settles the
// field's loader by hand, which is also how the loading state machine is asserted.
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private srcValue = "";
  static made: FakeImage[] = [];
  constructor() {
    FakeImage.made.push(this);
  }
  set src(value: string) {
    this.srcValue = value;
  }
  get src(): string {
    return this.srcValue;
  }
}

const settleAll = (): void => {
  for (const img of FakeImage.made) img.onload?.();
};

const OPEN = 48;
/** A featureless floor with no rooms — the builder-dungeon shape. */
const openDungeon = (): Dungeon => ({
  cols: OPEN,
  rows: OPEN,
  seed: 0,
  rooms: [],
  isFloor: (col, row) => col >= 0 && row >= 0 && col < OPEN && row < OPEN,
});

/** Flood from a point, the way `main.ts` does before placing anything. */
const floodFrom = (dungeon: Dungeon, col: number, row: number): FlowField => {
  const flow = new FlowField(dungeon.cols, dungeon.rows);
  flow.recompute(dungeon.isFloor, col, row);
  return flow;
};

/** A stocked field, plus everything needed to keep driving it. */
const stocked = (
  dungeon: Dungeon,
  start: { col: number; row: number },
  cleared = 0,
): { field: EnemyField; flow: FlowField } => {
  const flow = floodFrom(dungeon, start.col, start.row);
  const field = new EnemyField();
  settleAll();
  field.populate(dungeon, flow, dungeon.isFloor, cleared);
  return { field, flow };
};

/** Advance the field, re-flooding from the hero each frame the way the game does. */
const tick = (
  field: EnemyField,
  hero: { col: number; row: number },
  seconds: number,
  dungeon: Dungeon,
): void => {
  const dt = 1 / 60;
  const flow = new FlowField(dungeon.cols, dungeon.rows);
  let flooded = { col: NaN, row: NaN };
  for (let t = 0; t < seconds; t += dt) {
    const at = { col: Math.round(hero.col), row: Math.round(hero.row) };
    if (at.col !== flooded.col || at.row !== flooded.row) {
      flow.recompute(dungeon.isFloor, at.col, at.row);
      flooded = at;
    }
    field.update(dt, hero, dungeon.isFloor, flow);
  }
};

/** Cut the roster down, for behaviour that needs a known number of bodies. */
const trim = (field: EnemyField, keep: number): void => {
  const live = field.list() as unknown as unknown[];
  while (live.length > keep) live.pop();
};

/** Trim to a single enemy at a known spot, for behaviour that needs exact geometry. */
const only = (field: EnemyField, col: number, row: number): void => {
  trim(field, 1);
  const e = field.list()[0]!;
  e.col = col;
  e.row = row;
  e.asleep = true;
};

beforeEach(() => {
  FakeImage.made = [];
  vi.stubGlobal("Image", FakeImage);
});

describe("EnemyField loading", () => {
  it("stays unready, and inert, until every sheet has settled", () => {
    const dungeon = openDungeon();
    const flow = floodFrom(dungeon, 24, 24);
    const field = new EnemyField();
    expect(field.ready).toBe(false);
    field.populate(dungeon, flow, dungeon.isFloor);
    tick(field, { col: 24, row: 24 }, 1, dungeon);
    expect(field.list().every((e) => e.asleep)).toBe(true);

    settleAll();
    expect(field.ready).toBe(true);
  });

  it("becomes ready even when a sheet fails to load", () => {
    const field = new EnemyField();
    for (const img of FakeImage.made) img.onerror?.();
    expect(field.ready).toBe(true);
  });

  it("prefixes every sheet with the deploy base", () => {
    new EnemyField((path) => `/isometric-prototype/${path}`);
    const srcs = FakeImage.made.map((i) => i.src);
    expect(srcs).toHaveLength(KINDS.length * 4);
    for (const src of srcs) expect(src.startsWith("/isometric-prototype/dungeon/enemies/")).toBe(true);
    expect(srcs).toContain("/isometric-prototype/dungeon/enemies/vampire/death.png");
  });
});

describe("EnemyField.populate", () => {
  const SEEDS = [1, 7, 42, 1337];

  it.each(SEEDS)("puts every enemy on floor (seed %i)", (seed) => {
    const dungeon = generateDungeon(64, 48, seed);
    const { field } = stocked(dungeon, findSpawn(dungeon));
    expect(field.list().length).toBeGreaterThan(0);
    for (const e of field.list()) {
      expect(dungeon.isFloor(Math.round(e.col), Math.round(e.row))).toBe(true);
    }
  });

  // Arriving on top of her costs a heart before she has seen anything, so the
  // room she starts in is hers.
  it.each(SEEDS)("leaves the ground round her start empty (seed %i)", (seed) => {
    const dungeon = generateDungeon(64, 48, seed);
    const spawn = findSpawn(dungeon);
    const { field, flow } = stocked(dungeon, spawn);
    for (const e of field.list()) {
      expect(flow.distance(Math.round(e.col), Math.round(e.row))).toBeGreaterThanOrEqual(SAFE_STEPS);
    }
  });

  it("starts them all asleep", () => {
    const dungeon = generateDungeon(64, 48, 7);
    const { field } = stocked(dungeon, findSpawn(dungeon));
    expect(field.list().every((e) => e.asleep)).toBe(true);
  });

  it("stocks a roomless dungeon too, so builder maps are not empty", () => {
    const dungeon = openDungeon();
    const { field } = stocked(dungeon, { col: 24, row: 24 });
    expect(field.list().length).toBeGreaterThan(0);
  });

  it("replaces the last dungeon's roster rather than adding to it", () => {
    const dungeon = generateDungeon(64, 48, 7);
    const spawn = findSpawn(dungeon);
    const flow = floodFrom(dungeon, spawn.col, spawn.row);
    const field = new EnemyField();
    settleAll();
    field.populate(dungeon, flow, dungeon.isFloor);
    const first = field.list().length;
    field.populate(dungeon, flow, dungeon.isFloor);
    expect(field.list().length).toBe(first);
  });

  it("never refills, so a cleared dungeon stays cleared", () => {
    const dungeon = generateDungeon(64, 48, 7);
    const spawn = findSpawn(dungeon);
    const { field } = stocked(dungeon, spawn);
    for (const e of field.list()) {
      e.col = spawn.col;
      e.row = spawn.row;
    }
    field.attackAt(spawn.col, spawn.row);
    tick(field, spawn, DEATH_TIME + 3, dungeon);
    expect(field.remaining()).toBe(0);
    expect(field.list()).toHaveLength(0);
  });
});

describe("EnemyField.rosterPerRoom", () => {
  it("grows with each dungeon cleared", () => {
    expect(EnemyField.rosterPerRoom(4)).toBeGreaterThan(EnemyField.rosterPerRoom(0));
  });

  it("stops growing, so dungeon fifty is not unplayable", () => {
    expect(EnemyField.rosterPerRoom(500)).toBe(ROSTER_MAX_PER_ROOM);
  });
});

describe("EnemyField waking", () => {
  const dungeon = openDungeon();

  it("leaves a sleeping enemy exactly where it was placed", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    only(field, 40, 40);
    tick(field, { col: 4, row: 4 }, 3, dungeon);
    const e = field.list()[0]!;
    expect(e.asleep).toBe(true);
    expect(e.col).toBe(40);
    expect(e.row).toBe(40);
    expect(e.attacking).toBe(false);
  });

  it("wakes it once she is within WAKE_STEPS, and it closes in", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    only(field, 24, 24);
    const hero = { col: 24 - (WAKE_STEPS - 1), row: 24 };
    tick(field, hero, 2, dungeon);
    const e = field.list()[0]!;
    expect(e.asleep).toBe(false);
    expect(e.col).toBeLessThan(24);
  });

  // On open floor the flood's step count is the Manhattan distance, so a hero
  // that far off on one axis is outside the radius however close she looks.
  it("stays asleep for someone just out of range", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    only(field, 24, 24);
    tick(field, { col: 24 - (WAKE_STEPS + 2), row: 24 }, 2, dungeon);
    expect(field.list()[0]!.asleep).toBe(true);
  });

  it("loses interest in lurk mode when she gets away", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    field.setMode("lurk");
    only(field, 24, 24);
    tick(field, { col: 24 - (WAKE_STEPS - 1), row: 24 }, 0.5, dungeon);
    expect(field.list()[0]!.asleep).toBe(false);
    tick(field, { col: 4, row: 4 }, 0.5, dungeon);
    expect(field.list()[0]!.asleep).toBe(true);
  });

  it("keeps following in hunt mode however far she runs", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    field.setMode("hunt");
    only(field, 24, 24);
    tick(field, { col: 24 - (WAKE_STEPS - 1), row: 24 }, 0.5, dungeon);
    expect(field.list()[0]!.asleep).toBe(false);
    tick(field, { col: 4, row: 4 }, 0.5, dungeon);
    expect(field.list()[0]!.asleep).toBe(false);
  });
});

describe("EnemyField behaviour", () => {
  const dungeon = openDungeon();

  it("closes on the hero and stops at contact range", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    const hero = { col: 24, row: 24 };
    only(field, hero.col + 6, hero.row);
    tick(field, hero, 6, dungeon);
    const e = field.list()[0]!;
    expect(Math.hypot(e.col - hero.col, e.row - hero.row)).toBeCloseTo(CONTACT, 1);
    expect(e.attacking).toBe(true);
  });

  it("cannot outrun the hero", () => {
    expect(SPEED).toBeLessThan(5.2);
  });

  it("faces the hero", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    const hero = { col: 24, row: 24 };
    only(field, hero.col + 4, hero.row);
    tick(field, hero, 0.1, dungeon);
    expect(field.list()[0]!.faceLeft).toBe(true);
  });

  // Three, because that is how many can crowd the hero at contact range and
  // still have room to stand apart — more and the geometry, not the code, is
  // what decides the spacing.
  it("keeps a group from stacking into one figure", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    const hero = { col: 24, row: 24 };
    trim(field, 3);
    for (const e of field.list()) {
      e.col = hero.col + 3;
      e.row = hero.row;
      e.asleep = false;
    }
    tick(field, hero, 3, dungeon);
    const live = field.list();
    expect(live.length).toBeGreaterThan(1);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i]!;
        const b = live[j]!;
        expect(Math.hypot(a.col - b.col, a.row - b.row)).toBeGreaterThan(SEPARATION * 0.5);
      }
    }
  });

  // Two rooms joined only along the bottom. Walking straight at the hero puts an
  // enemy in the top-left corner and holds it there; it has to give up ground
  // through the corridor first.
  const TWO_ROOMS = [
    "###########",
    "#....#....#",
    "#....#....#",
    "#....#....#",
    "#.........#",
    "###########",
  ];
  const twoRooms: Dungeon = {
    cols: 11,
    rows: 6,
    seed: 0,
    rooms: [],
    isFloor: (col, row) => TWO_ROOMS[row]?.[col] === ".",
  };

  it("backtracks out of a corner and takes the corridor round", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    const hero = { col: 9, row: 1 };
    only(field, 1, 1);
    field.list()[0]!.asleep = false;
    tick(field, hero, 12, twoRooms);
    const e = field.list()[0]!;
    expect(Math.hypot(e.col - hero.col, e.row - hero.row)).toBeLessThanOrEqual(CONTACT + 0.05);
  });

  it("keeps to the floor the whole way round", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    const hero = { col: 9, row: 1 };
    only(field, 1, 1);
    field.list()[0]!.asleep = false;
    for (let i = 0; i < 60; i++) {
      tick(field, hero, 0.2, twoRooms);
      const e = field.list()[0]!;
      expect(twoRooms.isFloor(Math.round(e.col), Math.round(e.row))).toBe(true);
    }
  });
});

describe("EnemyField combat", () => {
  const dungeon = openDungeon();

  it("kills what is within reach and leaves the rest", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    const hero = { col: 24, row: 24 };
    const list = field.list();
    expect(list.length).toBeGreaterThan(1);
    list[0]!.col = hero.col + MELEE - 0.1;
    list[0]!.row = hero.row;
    for (const e of list.slice(1)) {
      e.col = hero.col + MELEE + 3;
      e.row = hero.row;
    }
    expect(field.attackAt(hero.col, hero.row)).toBe(1);
    expect(list[0]!.dying).toBe(true);
    expect(list[1]!.dying).toBe(false);
  });

  // A sleeping enemy is still a target — she can catch one before it notices her.
  it("kills a sleeping enemy too", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    only(field, 24, 24);
    expect(field.attackAt(24, 24)).toBe(1);
    expect(field.list()[0]!.dying).toBe(true);
  });

  // The reach has to cover the ground an enemy crosses between the blade landing
  // and the next swing, or a well-timed swing still costs a heart.
  it("reaches further than an enemy travels while a swing plays out", () => {
    expect(MELEE).toBeGreaterThan(CONTACT + SPEED * 0.36);
  });

  it("does not report a body as still touching the hero", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    const hero = { col: 24, row: 24 };
    only(field, hero.col, hero.row);
    const e = field.list()[0]!;
    expect(field.contactAt(hero.col, hero.row)).toBe(e);
    field.attackAt(hero.col, hero.row);
    expect(field.contactAt(hero.col, hero.row)).toBeNull();
  });

  it("clears bodies once the death animation is done", () => {
    const { field } = stocked(dungeon, { col: 4, row: 4 });
    const hero = { col: 24, row: 24 };
    for (const e of field.list()) {
      e.col = hero.col;
      e.row = hero.row;
    }
    field.attackAt(hero.col, hero.row);
    tick(field, hero, DEATH_TIME + 0.1, dungeon);
    expect(field.list()).toHaveLength(0);
  });
});
