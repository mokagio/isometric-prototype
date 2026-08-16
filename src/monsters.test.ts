import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGGRO_HALF,
  AGGRO_REACH,
  CONTACT,
  FADE,
  GIVE_UP,
  HURT,
  KNOCKBACK,
  MELEE,
  MonsterField,
  RECOIL,
  RECOIL_TIME,
  SPAWN_MAX,
  SPAWN_MIN,
  SEPARATION,
  SPEED,
  WANDER_ARRIVE,
  WANDER_HALF,
  WANDER_PAUSE,
  WANDER_SPEED,
  WAVE_BREAK,
  WAVE_SIZE,
  WAVE_STAGGER,
  type Monster,
} from "./monsters";
import { MONS_IN_CAST, SLIME_FPS as MON_FPS, SLIME_FRAMES as FRAMES } from "./monsterSkin";
import type { World } from "./world";

// The field loads its sheets through `new Image()`, which the node test
// environment lacks. Handlers are attached before `src`, so nothing settles
// until a test says so.
let pending: FakeImage[] = [];

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";

  constructor() {
    pending.push(this);
  }
}

vi.stubGlobal("Image", FakeImage);

beforeEach(() => {
  pending = [];
});

const loadAll = (): void => pending.forEach((i) => i.onload?.());

const worldOf = (cols: number, rows: number): World => ({ cols, rows }) as unknown as World;

const BASE = "/";
const WORLD = worldOf(200, 200);
// A hazard river three columns wide: crossable by the hero, not by a monster.
const RIVER = { cols: 200, rows: 200, isHazard: (c: number) => c >= 101 && c <= 103 } as unknown as World;
const HERO = { col: 100, row: 100 };
const DT = 1 / 60;

/** A field with both sheets loaded and its first wave spawned. */
function loaded(): MonsterField {
  const field = new MonsterField(BASE, "slime");
  loadAll();
  field.update(0, HERO, WORLD);
  return field;
}

// Somewhere the rest of a wave cannot reach the hero or each other during a test.
const OFFSTAGE = 900;

/** Move a monster as though it had spawned there: post, waypoint and all. */
function park(m: Monster, col: number, row: number): void {
  m.col = col;
  m.row = row;
  m.home = { col, row };
  m.waypoint = { col, row };
}

/**
 * A loaded field holding one monster parked at (col, row), with the rest of its
 * wave sent offstage — so a test about one monster is about one monster, while
 * still running against the real WAVE_SIZE.
 */
function fieldWith(col: number, row: number): { field: MonsterField; mon: Monster } {
  const field = loaded();
  const [mon, ...rest] = field.list();
  park(mon!, col, row);
  rest.forEach((m, i) => park(m, OFFSTAGE + i * SEPARATION * 4, OFFSTAGE));
  return { field, mon: mon! };
}

const distanceToHero = (m: Monster): number => Math.hypot(m.col - HERO.col, m.row - HERO.row);

describe("MonsterField loading", () => {
  it("waits for every sheet before it is ready", () => {
    const field = new MonsterField(BASE, "slime");
    expect(field.ready).toBe(false);
    pending[0]!.onload?.();
    expect(field.ready).toBe(false);
    loadAll();
    expect(field.ready).toBe(true);
  });

  it("prefixes the sheet paths with the given base", () => {
    new MonsterField("/isometric-prototype/", "slime");
    for (const img of pending) {
      expect(img.src.startsWith("/isometric-prototype/oboro/slime/")).toBe(true);
    }
  });

  it("takes its default base from the deploy base URL", async () => {
    // A project page serves from /<repo>/, so a hardcoded root path 404s there.
    vi.stubEnv("BASE_URL", "/isometric-prototype/");
    vi.resetModules();
    const { MonsterField: Fresh } = await import("./monsters");
    pending = [];
    new Fresh();

    expect(pending.length).toBeGreaterThan(0);
    for (const img of pending) {
      expect(img.src.startsWith("/isometric-prototype/")).toBe(true);
    }

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sends in whichever skin is the active one, not a hardcoded slime", async () => {
    vi.resetModules();
    const { MONSTER_SKIN } = await import("./monsterSkin");
    const { MonsterField: Fresh } = await import("./monsters");
    pending = [];
    new Fresh("/");
    const wanted = MONSTER_SKIN === "slime" ? "oboro/slime/" : "mons/";
    for (const img of pending) expect(img.src).toContain(wanted);
    vi.resetModules();
  });

  it("holds off spawning until the sheets have loaded", () => {
    const field = new MonsterField(BASE, "slime");
    field.update(0.1, HERO, WORLD);
    expect(field.list()).toHaveLength(0);
  });
});

describe("MonsterField spawning", () => {
  it("spawns a whole wave at once", () => {
    expect(loaded().list()).toHaveLength(WAVE_SIZE);
  });

  it("spawns into a ring around the hero, never on top of them", () => {
    const field = loaded();
    for (let i = 0; i < 200; i++) {
      // Each monster sits a stagger's walk further out than the one before it.
      field.list().forEach((m, slot) => {
        const back = slot * SPEED * WAVE_STAGGER;
        expect(distanceToHero(m)).toBeGreaterThanOrEqual(SPAWN_MIN + back - 1e-9);
        expect(distanceToHero(m)).toBeLessThanOrEqual(SPAWN_MAX + back + 1e-9);
      });
      field.reset();
      field.update(0, HERO, WORLD);
    }
  });

  it("keeps spawns inside the map when the hero is near an edge", () => {
    // The spawn ring reaches well past this map's edge, so every spawn clamps.
    const small = worldOf(10, 10);
    const corner = { col: 1, row: 1 };
    const field = new MonsterField(BASE, "slime");
    loadAll();
    for (let i = 0; i < 200; i++) {
      field.reset();
      field.update(0, corner, small);
      for (const m of field.list()) {
        expect(m.col).toBeGreaterThanOrEqual(1);
        expect(m.col).toBeLessThanOrEqual(small.cols - 2);
        expect(m.row).toBeGreaterThanOrEqual(1);
        expect(m.row).toBeLessThanOrEqual(small.rows - 2);
      }
    }
  });

  it("empties the field on reset", () => {
    const field = loaded();
    field.reset();
    expect(field.list()).toHaveLength(0);
  });
});

describe("MonsterField chasing", () => {
  it("closes on the hero", () => {
    const { field, mon } = fieldWith(HERO.col, HERO.row + 10);
    const before = distanceToHero(mon);
    field.update(DT, HERO, WORLD);
    expect(distanceToHero(mon)).toBeLessThan(before);
    expect(mon.col).toBeCloseTo(HERO.col, 10); // straight up the row axis
  });

  it("stops at contact range instead of walking through the hero", () => {
    const { field, mon } = fieldWith(HERO.col, HERO.row + 5);
    for (let i = 0; i < 300; i++) field.update(DT, HERO, WORLD);
    const d = distanceToHero(mon);
    expect(d).toBeLessThanOrEqual(CONTACT);
    // Parked just shy of contact rather than converging onto the hero's cell.
    expect(d).toBeGreaterThan(CONTACT - SPEED * DT - 1e-9);
  });

  it("holds still once it is already inside contact range", () => {
    const { field, mon } = fieldWith(HERO.col, HERO.row + CONTACT / 2);
    const { col, row } = mon;
    field.update(DT, HERO, WORLD);
    expect(mon.col).toBe(col);
    expect(mon.row).toBe(row);
  });

  it("stops chasing once it is dying", () => {
    const { field, mon } = fieldWith(HERO.col, HERO.row + 5);
    mon.dying = true;
    const { col, row } = mon;
    field.update(DT, HERO, WORLD);
    expect(mon.col).toBe(col);
    expect(mon.row).toBe(row);
  });

  it("faces whichever way the hero lies on screen", () => {
    // Screen-x runs with (col - row), so a hero up-left of the monster on the
    // grid is still to its left on screen.
    const { field, mon } = fieldWith(HERO.col + 5, HERO.row);
    field.update(DT, HERO, WORLD);
    expect(mon.faceLeft).toBe(true);

    const away = fieldWith(HERO.col - 5, HERO.row);
    away.field.update(DT, HERO, WORLD);
    expect(away.mon.faceLeft).toBe(false);
  });
});

describe("MonsterField contact", () => {
  it("hands back the monster doing the bumping", () => {
    const { field, mon } = fieldWith(HERO.col + CONTACT * 0.5, HERO.row);
    expect(field.contactAt(HERO.col, HERO.row)).toBe(mon);
  });

  it("bumps at exactly the contact radius", () => {
    // Measured from the origin so the distance is exactly CONTACT rather than a
    // float a hair over it, which would pass whether the bound is < or <=.
    const { field, mon } = fieldWith(0, 0);
    expect(field.contactAt(CONTACT, 0)).toBe(mon);
  });

  it("leaves alone whatever is beyond contact range", () => {
    const { field } = fieldWith(HERO.col + CONTACT * 1.1, HERO.row);
    expect(field.contactAt(HERO.col, HERO.row)).toBeNull();
  });

  it("cannot be bumped by a monster that is already dying", () => {
    const { field, mon } = fieldWith(HERO.col, HERO.row);
    mon.dying = true;
    expect(field.contactAt(HERO.col, HERO.row)).toBeNull();
  });

  it("reports nothing on an empty field", () => {
    const field = loaded();
    field.reset();
    expect(field.contactAt(HERO.col, HERO.row)).toBeNull();
  });
});

describe("MonsterField swings", () => {
  it("kills what is inside melee range", () => {
    const { field, mon } = fieldWith(HERO.col + MELEE * 0.9, HERO.row);
    field.attackAt(HERO.col, HERO.row);
    expect(mon.dying).toBe(true);
  });

  it("kills at exactly the melee radius", () => {
    // Measured from the origin so the distance is exactly MELEE rather than a
    // float a hair under it, which would pass whether the bound is < or <=.
    const { field, mon } = fieldWith(0, 0);
    field.attackAt(MELEE, 0);
    expect(mon.dying).toBe(true);
  });

  it("spares what is beyond melee range", () => {
    const { field, mon } = fieldWith(HERO.col + MELEE * 1.1, HERO.row);
    field.attackAt(HERO.col, HERO.row);
    expect(mon.dying).toBe(false);
  });

  it("measures range from the swing, not from the hero's last position", () => {
    const { field, mon } = fieldWith(HERO.col + 20, HERO.row);
    field.attackAt(mon.col, mon.row);
    expect(mon.dying).toBe(true);
  });

  it("does not restart the death of something already dying", () => {
    const { field, mon } = fieldWith(HERO.col, HERO.row);
    field.attackAt(mon.col, mon.row);
    field.update(FADE / 2, HERO, WORLD);
    const partway = mon.dyingT;
    field.attackAt(mon.col, mon.row);
    expect(mon.dyingT).toBe(partway);
  });

  it("hands back what it felled, standing where the blow caught it", () => {
    const { field, mon } = fieldWith(HERO.col + MELEE * 0.9, HERO.row);
    const at = { col: mon.col, row: mon.row };
    const felled = field.attackAt(HERO.col, HERO.row);
    expect(felled).toEqual([mon]);
    expect(felled[0]!.col).toBe(at.col);
    expect(felled[0]!.row).toBe(at.row);
  });

  it("hands back nothing when the swing misses, or lands on a body", () => {
    const { field, mon } = fieldWith(HERO.col + MELEE * 1.1, HERO.row);
    expect(field.attackAt(HERO.col, HERO.row)).toEqual([]);
    field.attackAt(mon.col, mon.row);
    expect(field.attackAt(mon.col, mon.row)).toEqual([]);
  });
});

describe("MonsterField giving up", () => {
  // A river all the way across, with the hero on the far side of it: nothing can
  // reach them, which before `GIVE_UP` meant the field never emptied again.
  const MOAT = {
    cols: 200,
    rows: 200,
    blocks: (c: number, r: number) => r > HERO.row + 2 && r < HERO.row + 6 && c > -1,
  } as unknown as World;

  /** Run a field for `secs` against the moat, with the whole wave parked south of it. */
  function marooned(secs: number): { field: MonsterField; mon: Monster; wave: Set<Monster> } {
    const field = loaded();
    const wave = field.list();
    // All of them, or the ones left on open ground would keep the field busy and
    // the "next wave arrives" case would never be reached.
    wave.forEach((m, i) => park(m, HERO.col + i * SEPARATION * 2, HERO.row + 8));
    const parked = new Set(wave);
    for (let i = 0; i < secs / DT; i++) field.update(DT, HERO, MOAT);
    return { field, mon: wave[0]!, wave: parked };
  }

  it("keeps trying for a while before it does", () => {
    expect(marooned(GIVE_UP / 2).mon.dying).toBe(false);
  });

  it("gives up on a hero it cannot reach", () => {
    expect(marooned(GIVE_UP * 2).mon.dying).toBe(true);
  });

  it("leaves empty-handed: only a killing blow drops anything", () => {
    // `knock` is what a felled monster carries; giving up must not fake one, and
    // `attackAt` is the only thing that hands a monster back to be looted.
    expect(marooned(GIVE_UP + 1).mon.knock).toBe(null);
  });

  it("clears the way for the next wave, so the ladder cannot stall", () => {
    // Give up, fade, wait out the calm — and stop there. Left running another
    // GIVE_UP, a replacement that happens to spawn beyond the moat gives up in
    // its turn, which is this same rule working rather than the field stalling.
    const { field, wave } = marooned(GIVE_UP + FADE + WAVE_BREAK + 2);
    // The marooned ones are gone and a fresh wave has walked in behind them.
    expect(field.list().length).toBe(WAVE_SIZE);
    expect(field.list().some((m) => wave.has(m))).toBe(false);
    expect(field.list().every((m) => !m.dying)).toBe(true);
  });

  it("never gives up on open ground, however long the walk", () => {
    const { mon } = (() => {
      const field = loaded();
      const [m, ...rest] = field.list();
      park(m!, HERO.col, HERO.row + SPAWN_MAX);
      rest.forEach((r, i) => park(r, OFFSTAGE + i * SEPARATION * 4, OFFSTAGE));
      for (let i = 0; i < (GIVE_UP * 3) / DT; i++) field.update(DT, HERO, WORLD);
      return { mon: m! };
    })();
    expect(mon.dying).toBe(false);
  });

  it("does not count bumping the hero as being stuck", () => {
    // It has arrived and stopped: standing still on purpose is not being blocked.
    const { field, mon } = fieldWith(HERO.col, HERO.row + CONTACT / 2);
    for (let i = 0; i < (GIVE_UP * 3) / DT; i++) field.update(DT, HERO, WORLD);
    expect(mon.dying).toBe(false);
  });
});

describe("MonsterField hearts", () => {
  /** A loaded field on `hp` hearts, with one monster parked in reach of the origin. */
  function atLevel(hp: number): { field: MonsterField; mon: Monster } {
    const field = new MonsterField(BASE, "slime");
    loadAll();
    field.setLevel(hp, 0);
    field.update(0, HERO, WORLD);
    const [mon, ...rest] = field.list();
    park(mon!, 0, 0);
    rest.forEach((m, i) => park(m, OFFSTAGE + i * SEPARATION * 4, OFFSTAGE));
    return { field, mon: mon! };
  }

  it("spawns a wave on the level's hearts", () => {
    const { field } = atLevel(3);
    for (const m of field.list()) {
      expect(m.hp).toBe(3);
      expect(m.hpMax).toBe(3);
    }
  });

  it("takes a heart per blow, and only the last one kills", () => {
    const { field, mon } = atLevel(3);
    expect(field.attackAt(0, 0)).toEqual([]);
    expect(mon.hp).toBe(2);
    expect(mon.dying).toBe(false);
    expect(field.attackAt(0, 0)).toEqual([]);
    expect(mon.hp).toBe(1);
    expect(field.attackAt(0, 0)).toEqual([mon]);
    expect(mon.dying).toBe(true);
  });

  it("dies to a single blow on a one-heart level", () => {
    const { field, mon } = atLevel(1);
    expect(field.attackAt(0, 0)).toEqual([mon]);
    expect(mon.dying).toBe(true);
  });

  it("blinks while smarting from a blow it survived, and settles again", () => {
    const { field, mon } = atLevel(2);
    field.attackAt(0, 0);
    expect(mon.hurtT).toBeGreaterThan(0);
    field.update(HURT / 2, HERO, WORLD);
    expect(mon.hurtT).toBeGreaterThan(0);
    field.update(HURT, HERO, WORLD);
    expect(mon.hurtT).toBe(0);
  });

  it("keeps a wave to one creature, so a level looks like itself", () => {
    const field = new MonsterField(BASE, "mons");
    loadAll();
    field.setLevel(1, 7);
    field.update(0, HERO, WORLD);
    expect(new Set(field.list().map((m) => m.kind))).toEqual(new Set([7]));
  });

  it("leaves a wave already walking on the level it spawned with", () => {
    const field = new MonsterField(BASE, "mons");
    loadAll();
    field.setLevel(1, 3);
    field.update(0, HERO, WORLD);
    field.setLevel(2, 4);
    for (const m of field.list()) {
      expect(m.kind).toBe(3);
      expect(m.hpMax).toBe(1);
    }
  });

  it("never sends in a monster that cannot be hit at all", () => {
    const field = new MonsterField(BASE, "slime");
    loadAll();
    field.setLevel(0, 0);
    field.update(0, HERO, WORLD);
    for (const m of field.list()) expect(m.hp).toBeGreaterThanOrEqual(1);
  });

  it("tells the ladder how many creatures it has to choose from", () => {
    expect(new MonsterField(BASE, "mons").cast).toBe(MONS_IN_CAST);
    expect(new MonsterField(BASE, "slime").cast).toBe(1);
  });

  /** The heart pips one monster in the given state puts on the canvas. */
  function pipsFor(hp: number, mutate: (m: Monster) => void = () => {}): Pip[] {
    const field = new MonsterField(BASE, "slime");
    loadAll();
    field.setLevel(hp, 0);
    field.update(0, HERO, WORLD);
    const mon = field.list()[0]!;
    mutate(mon);
    const { ctx, pips } = recordingCtx();
    field.draw(ctx, mon, 0, 0);
    return pips;
  }

  it("shows one heart over a one-heart monster", () => {
    expect(pipsFor(1)).toHaveLength(1);
  });

  it("keeps the row's width as hearts are taken", () => {
    const full = pipsFor(3);
    const hurt = pipsFor(3, (m) => (m.hp = 1));
    expect(hurt).toHaveLength(3);
    expect(hurt.map((p) => p.x)).toEqual(full.map((p) => p.x));
    expect(hurt.map((p) => p.alpha < 1)).toEqual([false, true, true]);
  });

  it("lays them clear of the top of the art, not over the monster's face", () => {
    // Screen y runs downward, so above the feet is negative.
    for (const pip of pipsFor(1)) expect(pip.y).toBeLessThan(0);
  });

  it("takes the hearts away with the body", () => {
    expect(pipsFor(1, (m) => (m.dying = true))).toHaveLength(0);
  });

  it("holds the hearts steady through the hurt blink", () => {
    // A count that flickers is one nobody can read, however hard the sprite blinks.
    const field = new MonsterField(BASE, "slime");
    loadAll();
    field.setLevel(2, 0);
    field.update(0, HERO, WORLD);
    const mon = field.list()[0]!;
    park(mon, 0, 0);
    field.attackAt(0, 0);
    const { ctx, calls, pips } = recordingCtx();
    field.draw(ctx, mon, 0, 0);
    expect(calls[0]!.alpha).toBeLessThan(1); // the sprite is mid-blink
    expect(pips[0]!.alpha).toBe(1); // the heart it has left is not
  });
});

// The blow has to land inside MELEE or the monster simply is not killed, so the
// struck monster sits one cell along +col from a swing at the origin.
const STRUCK_AT = 1;
const struck = (): { field: MonsterField; mon: Monster } => {
  const both = fieldWith(STRUCK_AT, 0);
  both.field.attackAt(0, 0);
  return both;
};

describe("MonsterField knockback", () => {
  it("throws the body away from the blow", () => {
    const { field, mon } = struck();
    field.update(FADE, HERO, WORLD);
    expect(mon.col - STRUCK_AT).toBeCloseTo(KNOCKBACK);
    expect(mon.row).toBeCloseTo(0);
  });

  it("throws it the full distance over the fade, and no further", () => {
    const { field, mon } = struck();
    field.update(FADE / 2, HERO, WORLD);
    const partway = mon.col - STRUCK_AT;
    expect(partway).toBeGreaterThan(0);
    expect(partway).toBeLessThan(KNOCKBACK);
    field.update(FADE * 5, HERO, WORLD);
    expect(mon.col - STRUCK_AT).toBeCloseTo(KNOCKBACK);
  });

  it("front-loads the throw so it reads as a shove", () => {
    const { field, mon } = struck();
    field.update(FADE / 2, HERO, WORLD);
    expect(mon.col - STRUCK_AT).toBeGreaterThan(KNOCKBACK / 2);
  });

  it("covers the same ground however the frames are sliced", () => {
    const coarse = struck();
    coarse.field.update(FADE, HERO, WORLD);

    const fine = struck();
    for (let i = 0; i < 60; i++) fine.field.update(FADE / 60, HERO, WORLD);

    expect(fine.mon.col).toBeCloseTo(coarse.mon.col, 6);
  });

  it("still throws a monster struck dead-on", () => {
    const { field, mon } = fieldWith(0, 0);
    field.attackAt(0, 0);
    field.update(FADE, HERO, WORLD);
    expect(Math.hypot(mon.col, mon.row)).toBeCloseTo(KNOCKBACK);
  });

  it("leaves an untouched monster where it stands", () => {
    const { field, mon } = fieldWith(MELEE * 1.1, 0);
    field.attackAt(0, 0);
    expect(mon.dying).toBe(false);
    expect(mon.knock).toBeNull();
  });
});

describe("MonsterField recoil", () => {
  /** A two-heart monster parked at the hero's shoulder and hit there, so it survives. */
  function shoved(): { field: MonsterField; mon: Monster } {
    const field = new MonsterField(BASE, "slime");
    loadAll();
    field.setLevel(2, 0);
    field.update(0, HERO, WORLD);
    const [mon, ...rest] = field.list();
    park(mon!, HERO.col + CONTACT, HERO.row);
    rest.forEach((m, i) => park(m, OFFSTAGE + i * SEPARATION * 4, OFFSTAGE));
    field.attackAt(HERO.col, HERO.row);
    return { field, mon: mon! };
  }

  it("shoves a survivor back along the blow", () => {
    const { field, mon } = shoved();
    field.update(RECOIL_TIME, HERO, WORLD);
    expect(mon.col - (HERO.col + CONTACT)).toBeCloseTo(RECOIL);
    expect(mon.row).toBeCloseTo(HERO.row);
    expect(mon.dying).toBe(false);
  });

  it("cannot bump on the frame the blow lands, before the shove has moved it", () => {
    // The whole point: the swing and the bump resolve in the same frame, so a
    // shove that only shows up in the next one saves the hero from nothing.
    const { field } = shoved();
    expect(field.contactAt(HERO.col, HERO.row)).toBeNull();
  });

  it("takes up the chase again once it has finished reeling", () => {
    const { field, mon } = shoved();
    field.update(RECOIL_TIME, HERO, WORLD);
    const shovedTo = mon.col;
    field.update(DT, HERO, WORLD);
    expect(mon.col).toBeLessThan(shovedTo);
    expect(mon.reelT).toBe(0);
  });

  it("covers the same ground however the frames are sliced", () => {
    const coarse = shoved();
    coarse.field.update(RECOIL_TIME, HERO, WORLD);
    const fine = shoved();
    for (let i = 0; i < 30; i++) fine.field.update(RECOIL_TIME / 30, HERO, WORLD);
    expect(fine.mon.col).toBeCloseTo(coarse.mon.col, 6);
  });

  it("stops a shove at the bank rather than reeling into water", () => {
    const field = new MonsterField(BASE, "slime");
    loadAll();
    field.setLevel(2, 0);
    field.update(0, HERO, RIVER);
    const [mon, ...rest] = field.list();
    // On the dry side, with the river the shove would carry it into.
    park(mon!, 100, 100);
    rest.forEach((m, i) => park(m, OFFSTAGE + i * SEPARATION * 4, OFFSTAGE));
    field.attackAt(100 - CONTACT, 100);
    for (let i = 0; i < 30; i++) field.update(RECOIL_TIME / 30, HERO, RIVER);
    expect(RIVER.isHazard!(Math.round(mon!.col), Math.round(mon!.row))).toBe(false);
  });

  it("leaves the killing blow to throw the body the full distance", () => {
    // The shove is what a survivor gets; a corpse is still thrown clear.
    const { field, mon } = struck();
    field.update(FADE, HERO, WORLD);
    expect(mon.col - STRUCK_AT).toBeCloseTo(KNOCKBACK);
  });
});

describe("MonsterField death", () => {
  it("keeps a dying monster on screen while it plays out", () => {
    const { field, mon } = fieldWith(HERO.col + 3, HERO.row);
    field.attackAt(mon.col, mon.row);
    field.update(FADE / 2, HERO, WORLD);
    expect(field.list()).toContain(mon);
  });

  it("clears the corpse once the death finishes", () => {
    const { field, mon } = fieldWith(HERO.col + 3, HERO.row);
    field.attackAt(mon.col, mon.row);
    field.update(FADE, HERO, WORLD);
    expect(field.list()).not.toContain(mon);
  });

  it("does not replace a kill while the rest of the wave is still up", () => {
    const { field, mon } = fieldWith(HERO.col + 3, HERO.row);
    field.attackAt(mon.col, mon.row);
    field.update(FADE, HERO, WORLD);
    expect(field.list()).toHaveLength(WAVE_SIZE - 1);
  });
});

describe("MonsterField waves", () => {
  /** Kills everything standing and lets the bodies finish fading. */
  const wipe = (field: MonsterField): void => {
    for (const m of field.list()) field.attackAt(m.col, m.row);
    field.update(FADE, HERO, WORLD);
  };

  // Clearing the bodies takes FADE, and the breather runs from that same frame,
  // so this is what is left of it once `wipe` returns.
  const REMAINING = WAVE_BREAK - FADE;

  it("leaves a gap long enough to be worth having", () => {
    expect(REMAINING).toBeGreaterThan(0);
  });

  it("holds the field empty for a breather after a wipe", () => {
    const field = loaded();
    wipe(field);
    expect(field.list()).toHaveLength(0);
    field.update(REMAINING * 0.8, HERO, WORLD);
    expect(field.list()).toHaveLength(0);
  });

  it("sends in the next wave at full strength", () => {
    const field = loaded();
    wipe(field);
    field.update(REMAINING, HERO, WORLD);
    expect(field.list()).toHaveLength(WAVE_SIZE);
  });

  it("does not bank the breather while the wave is still up", () => {
    // Time spent fighting must not be credited against the next wave's gap.
    const field = loaded();
    field.update(WAVE_BREAK * 5, HERO, WORLD);
    wipe(field);
    field.update(REMAINING * 0.8, HERO, WORLD);
    expect(field.list()).toHaveLength(0);
  });

  it("starts the first wave without waiting", () => {
    expect(loaded().list()).toHaveLength(WAVE_SIZE);
  });

  it("sends a fresh wave straight in after a reset", () => {
    const field = loaded();
    field.reset();
    field.update(0, HERO, WORLD);
    expect(field.list()).toHaveLength(WAVE_SIZE);
  });
});

describe("MonsterField separation", () => {
  it("eases two stacked monsters apart", () => {
    const field = loaded();
    const [a, b] = field.list();
    a!.col = HERO.col + 4;
    a!.row = HERO.row;
    b!.col = HERO.col + 4;
    b!.row = HERO.row;
    for (let i = 0; i < 120; i++) field.update(DT, HERO, WORLD);
    expect(Math.hypot(a!.col - b!.col, a!.row - b!.row)).toBeGreaterThan(SEPARATION * 0.8);
  });

  it("leaves monsters that already have room alone", () => {
    const { field, mon } = fieldWith(HERO.col + SEPARATION * 3, HERO.row);
    const other = field.list()[1]!;
    other.col = mon.col + SEPARATION * 2;
    other.row = mon.row;
    const before = other.col;
    field.update(DT, HERO, WORLD);
    // It walks toward the hero, but nothing pushes it sideways off the row.
    expect(other.row).toBeCloseTo(mon.row, 6);
    expect(other.col).toBeLessThan(before);
  });

  it("does not shove a corpse around", () => {
    const field = loaded();
    const [a, b] = field.list();
    a!.col = HERO.col + 4;
    a!.row = HERO.row;
    b!.col = HERO.col + 4;
    b!.row = HERO.row;
    b!.dying = true;
    b!.knock = null;
    const parked = { col: b!.col, row: b!.row };
    field.update(DT, HERO, WORLD);
    expect(b!.col).toBe(parked.col);
    expect(b!.row).toBe(parked.row);
  });

  it("still lets a wave closing from all sides reach the hero", () => {
    // Why SEPARATION stays under the spacing of three monsters stood around the
    // contact circle: any wider and the ring they settle into would hold every
    // one of them outside bump range, and the hero could never be hit.
    const field = loaded();
    field.list().forEach((m, i) => {
      const bearing = (i * Math.PI * 2) / WAVE_SIZE;
      m.col = HERO.col + Math.cos(bearing) * 3;
      m.row = HERO.row + Math.sin(bearing) * 3;
    });
    for (let i = 0; i < 600; i++) field.update(DT, HERO, WORLD);
    for (const m of field.list()) {
      expect(Math.hypot(m.col - HERO.col, m.row - HERO.row)).toBeLessThanOrEqual(CONTACT + 1e-6);
    }
  });
});

interface DrawCall {
  src: string;
  args: number[];
  alpha: number;
  mirrored: boolean;
}

/** Records `drawImage` off an inert 2D context, with the alpha and flip in force. */
/** One heart pip laid over a monster's head. */
interface Pip {
  x: number;
  y: number;
  alpha: number;
}

function recordingCtx(): { ctx: CanvasRenderingContext2D; calls: DrawCall[]; pips: Pip[] } {
  const calls: DrawCall[] = [];
  const pips: Pip[] = [];
  let mirrored = false;
  const ctx = {
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    save() {},
    restore() {
      mirrored = false;
    },
    translate() {},
    scale(x: number) {
      if (x < 0) mirrored = true;
    },
    drawImage(img: FakeImage, ...args: number[]) {
      calls.push({ src: img.src, args, alpha: ctx.globalAlpha, mirrored });
    },
    // The heart row goes over the same canvas; these tests are about the sprite,
    // so the pips are recorded separately and the sprite calls stay uncluttered.
    font: "",
    textAlign: "",
    textBaseline: "",
    fillText(_text: string, x: number, y: number) {
      pips.push({ x, y, alpha: ctx.globalAlpha });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, pips };
}

/** The one draw call a monster in the given state produces. */
function drawOnce(mutate: (m: Monster) => void, feetX = 0, feetY = 0, alphaScale?: number): DrawCall {
  const { field, mon } = fieldWith(HERO.col, HERO.row);
  mutate(mon);
  const { ctx, calls } = recordingCtx();
  field.draw(ctx, mon, feetX, feetY, alphaScale);
  return calls[0]!;
}

describe("MonsterField.draw", () => {
  it("draws nothing before the sheets have loaded", () => {
    const field = new MonsterField(BASE, "slime");
    const { ctx, calls } = recordingCtx();
    const mon: Monster = {
      col: 0,
      row: 0,
      animT: 0,
      dying: false,
      dyingT: 0,
      faceLeft: false,
      kind: 0,
      hp: 1,
      hpMax: 1,
      hurtT: 0,
      reelT: 0,
      stuckT: 0,
      knock: null,
      home: { col: 0, row: 0 },
      waypoint: { col: 0, row: 0 },
      pause: 0,
    };
    field.draw(ctx, mon, 0, 0);
    expect(calls).toHaveLength(0);
  });

  it("steps one cell across the strip per walk frame", () => {
    const x0 = drawOnce((m) => (m.animT = 0)).args[0]!;
    const x1 = drawOnce((m) => (m.animT = 1 / MON_FPS)).args[0]!;
    const x2 = drawOnce((m) => (m.animT = 2 / MON_FPS)).args[0]!;
    expect(x1).toBeGreaterThan(x0);
    expect(x2 - x1).toBe(x1 - x0);
  });

  it("loops the walk back to its first frame", () => {
    const first = drawOnce((m) => (m.animT = 0)).args[0]!;
    expect(drawOnce((m) => (m.animT = FRAMES / MON_FPS)).args[0]!).toBe(first);
  });

  it("switches to the death sheet once it is dying", () => {
    expect(drawOnce((m) => (m.dying = false)).src).toContain("walk.png");
    expect(drawOnce((m) => (m.dying = true)).src).toContain("death.png");
  });

  it("plays at full opacity, then fades out over the tail", () => {
    expect(drawOnce((m) => ((m.dying = true), (m.dyingT = 0))).alpha).toBe(1);
    expect(drawOnce((m) => ((m.dying = true), (m.dyingT = FADE / 2))).alpha).toBe(1);
    const tail = drawOnce((m) => ((m.dying = true), (m.dyingT = FADE * 0.95))).alpha;
    expect(tail).toBeGreaterThan(0);
    expect(tail).toBeLessThan(1);
  });

  it("never asks for a negative alpha once the death overruns", () => {
    expect(drawOnce((m) => ((m.dying = true), (m.dyingT = FADE * 3))).alpha).toBe(0);
  });

  it("holds the death animation on its last frame rather than looping", () => {
    const last = drawOnce((m) => ((m.dying = true), (m.dyingT = FADE))).args[0]!;
    expect(drawOnce((m) => ((m.dying = true), (m.dyingT = FADE * 5))).args[0]!).toBe(last);
  });

  it("dims the whole sprite by the alpha it is handed", () => {
    // A caller cannot dim it from outside — the blit sets alpha outright — so
    // drawing a monster as a ghost behind terrain has to go through this.
    expect(drawOnce(() => {}, 0, 0, 0.4).alpha).toBeCloseTo(0.4);
    expect(drawOnce(() => {}).alpha).toBe(1);
  });

  it("dims a fading corpse on top of its own fade, not instead of it", () => {
    const fading = drawOnce((m) => ((m.dying = true), (m.dyingT = FADE * 0.95))).alpha;
    const ghosted = drawOnce((m) => ((m.dying = true), (m.dyingT = FADE * 0.95)), 0, 0, 0.5).alpha;
    expect(ghosted).toBeCloseTo(fading * 0.5);
  });

  it("mirrors the sprite only when facing left", () => {
    expect(drawOnce((m) => (m.faceLeft = true)).mirrored).toBe(true);
    expect(drawOnce((m) => (m.faceLeft = false)).mirrored).toBe(false);
  });

  it("centres the sprite on the feet and stands it on them", () => {
    const call = drawOnce(() => {}, 500, 300);
    const [, , , , dx, dy, dw, dh] = call.args;
    expect(dx! + dw! / 2).toBe(500);
    expect(dy!).toBeLessThan(300);
    expect(dy! + dh!).toBeGreaterThan(300); // anchored inside the frame, not on its bottom edge
  });
});

describe("MonsterField aggro modes", () => {
  // Waypoints are drawn about `home`, so a fixed 0.5 always picks the post the
  // monster already stands on: the only movement left in these tests is a chase.
  const noWander = (): void => void vi.spyOn(Math, "random").mockReturnValue(0.5);

  afterEach(() => vi.restoreAllMocks());

  it("hunt (the default) closes even from well outside the square", () => {
    const { field, mon } = fieldWith(HERO.col + 8, HERO.row);
    const before = mon.col;
    field.update(DT, HERO, WORLD);
    expect(mon.col).toBeLessThan(before);
  });

  it("lurk leaves the hero alone while they are beyond reach", () => {
    noWander();
    const { field, mon } = fieldWith(HERO.col + AGGRO_REACH + 1, HERO.row);
    field.setMode("lurk");
    const { col, row } = mon;
    field.update(DT, HERO, WORLD);
    expect(mon.col).toBe(col);
    expect(mon.row).toBe(row);
  });

  it("lurk wakes on touch, not full enclosure", () => {
    // Just inside reach wakes; a hair past it does not — the footprint touching
    // the square is enough, the hero need not be inside it.
    noWander();
    const inside = fieldWith(HERO.col + AGGRO_REACH - 0.1, HERO.row);
    inside.field.setMode("lurk");
    const wasInside = inside.mon.col;
    inside.field.update(DT, HERO, WORLD);
    expect(inside.mon.col).toBeLessThan(wasInside);

    const outside = fieldWith(HERO.col + AGGRO_REACH + 0.1, HERO.row);
    outside.field.setMode("lurk");
    const wasOutside = outside.mon.col;
    outside.field.update(DT, HERO, WORLD);
    expect(outside.mon.col).toBe(wasOutside);
  });

  it("measures reach from the post, not from where wandering left it", () => {
    // Ambling toward the hero must not drag the guard square along with it, or a
    // lurking monster would creep into a chase from anywhere on the map.
    noWander();
    const { field, mon } = fieldWith(HERO.col + AGGRO_REACH + 4, HERO.row);
    field.setMode("lurk");
    mon.col = HERO.col + 1; // inside reach of the hero, but its post is not
    field.update(DT, HERO, WORLD);
    expect(mon.col).toBe(HERO.col + 1);
  });

  it("the square is measured per-axis, not by straight-line distance", () => {
    // A corner cell (AGGRO_HALF, AGGRO_HALF) is ~2.8 away yet still inside a 5x5.
    noWander();
    const { field, mon } = fieldWith(HERO.col + AGGRO_HALF, HERO.row + AGGRO_HALF);
    field.setMode("lurk");
    const before = Math.hypot(mon.col - HERO.col, mon.row - HERO.row);
    field.update(DT, HERO, WORLD);
    expect(Math.hypot(mon.col - HERO.col, mon.row - HERO.row)).toBeLessThan(before);
  });
});

describe("MonsterField wandering", () => {
  /** A lurking monster posted far from the hero, left to its own devices for `secs`. */
  function amble(secs: number, at = { col: HERO.col + 30, row: HERO.row + 30 }, world = WORLD) {
    const { field, mon } = fieldWith(at.col, at.row);
    field.setMode("lurk");
    let furthest = 0;
    let onWater = false;
    for (let i = 0; i < secs / DT; i++) {
      field.update(DT, HERO, world);
      furthest = Math.max(furthest, Math.hypot(mon.col - at.col, mon.row - at.row));
      onWater ||= world.isHazard?.(Math.round(mon.col), Math.round(mon.row)) === true;
    }
    return { field, mon, furthest, onWater };
  }

  it("ambles about instead of standing sentry", () => {
    expect(amble(20).furthest).toBeGreaterThan(WANDER_ARRIVE);
  });

  it("keeps its wandering close to its post", () => {
    const { mon } = amble(60);
    expect(Math.abs(mon.col - mon.home.col)).toBeLessThanOrEqual(WANDER_HALF);
    expect(Math.abs(mon.row - mon.home.row)).toBeLessThanOrEqual(WANDER_HALF);
  });

  it("strays less far than it can see, so it stays posted where it spawned", () => {
    expect(WANDER_HALF).toBeLessThan(AGGRO_HALF);
  });

  it("ambles slower than it chases", () => {
    const { furthest } = amble(1);
    expect(furthest).toBeLessThanOrEqual(WANDER_SPEED);
    expect(furthest).toBeLessThan(SPEED);
  });

  it("wanders back to its post after being knocked clear of it", () => {
    const { field, mon } = fieldWith(HERO.col + 30, HERO.row + 30);
    field.setMode("lurk");
    mon.col = mon.home.col + 10;
    const strayed = Math.abs(mon.col - mon.home.col);
    for (let i = 0; i < (WANDER_PAUSE + 5) / DT; i++) field.update(DT, HERO, WORLD);
    expect(Math.abs(mon.col - mon.home.col)).toBeLessThan(strayed);
  });

  it("keeps its feet dry when its square laps into water", () => {
    // A river at 101-103; the post at 104 puts half the guard square in it.
    // Water is only a hazard to the hero, but monsters still will not paddle.
    expect(amble(60, { col: 104, row: HERO.row + 30 }, RIVER).onWater).toBe(false);
  });

  it("faces the way it is walking, not the way the hero lies", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // waypoint = the post
    const { field, mon } = fieldWith(HERO.col - 30, HERO.row);
    field.setMode("lurk");
    mon.home = { col: mon.col - 5, row: mon.row }; // its post is off to screen-left
    for (let i = 0; i < (WANDER_PAUSE + 0.5) / DT; i++) field.update(DT, HERO, WORLD);
    expect(mon.col).toBeLessThan(HERO.col - 30);
    expect(mon.faceLeft).toBe(true); // the hero is away to screen-right
    vi.restoreAllMocks();
  });

  it("does not amble in hunt mode", () => {
    const { field, mon } = fieldWith(HERO.col + 30, HERO.row);
    const before = mon.col;
    field.update(DT, HERO, WORLD);
    expect(before - mon.col).toBeCloseTo(SPEED * DT, 6); // straight at the hero, at chase pace
  });
});

describe("MonsterField water", () => {
  it("stops a monster at the shore rather than wading after the hero", () => {
    // A river three columns wide (101-103) between the monster (105) and hero (100).
    // The hero can cross it at a heart a second; that only buys an escape if the
    // slime will not follow.
    const { field, mon } = fieldWith(105, HERO.row);
    for (let i = 0; i < 300; i++) field.update(DT, HERO, RIVER);
    expect(mon.col).toBeLessThan(105); // it did advance
    expect(Math.round(mon.col)).toBe(104); // but parked in the dry cell beside the river
  });

  it("stops at a blocking pool the same way", () => {
    const pool = { cols: 200, rows: 200, blocks: (c: number) => c >= 101 && c <= 103 } as unknown as World;
    const { field, mon } = fieldWith(105, HERO.row);
    for (let i = 0; i < 300; i++) field.update(DT, HERO, pool);
    expect(Math.round(mon.col)).toBe(104);
  });
});
