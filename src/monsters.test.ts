import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTACT,
  FADE,
  FRAMES,
  KNOCKBACK,
  MAX_MONSTERS,
  MELEE,
  MON_FPS,
  MonsterField,
  SPAWN_MAX,
  SPAWN_MIN,
  SPEED,
  type Monster,
} from "./monsters";
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
const HERO = { col: 100, row: 100 };
const DT = 1 / 60;

/** A field with both sheets loaded, topped up to the cap. */
function loaded(): MonsterField {
  const field = new MonsterField(BASE);
  loadAll();
  field.update(0, HERO, WORLD);
  return field;
}

/** A loaded field holding one monster parked at (col, row). */
function fieldWith(col: number, row: number): { field: MonsterField; mon: Monster } {
  const field = loaded();
  const mon = field.list()[0]!;
  mon.col = col;
  mon.row = row;
  return { field, mon };
}

const distanceToHero = (m: Monster): number => Math.hypot(m.col - HERO.col, m.row - HERO.row);

describe("MonsterField loading", () => {
  it("waits for every sheet before it is ready", () => {
    const field = new MonsterField(BASE);
    expect(field.ready).toBe(false);
    pending[0]!.onload?.();
    expect(field.ready).toBe(false);
    loadAll();
    expect(field.ready).toBe(true);
  });

  it("prefixes the sheet paths with the given base", () => {
    new MonsterField("/isometric-prototype/");
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
      expect(img.src.startsWith("/isometric-prototype/oboro/slime/")).toBe(true);
    }

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("holds off spawning until the sheets have loaded", () => {
    const field = new MonsterField(BASE);
    field.update(0.1, HERO, WORLD);
    expect(field.list()).toHaveLength(0);
  });
});

describe("MonsterField spawning", () => {
  it("tops the field back up to the cap", () => {
    expect(loaded().list()).toHaveLength(MAX_MONSTERS);
  });

  it("spawns into a ring around the hero, never on top of them", () => {
    const field = loaded();
    for (let i = 0; i < 200; i++) {
      const d = distanceToHero(field.list()[0]!);
      expect(d).toBeGreaterThanOrEqual(SPAWN_MIN);
      expect(d).toBeLessThanOrEqual(SPAWN_MAX);
      field.reset();
      field.update(0, HERO, WORLD);
    }
  });

  it("keeps spawns inside the map when the hero is near an edge", () => {
    // The spawn ring reaches well past this map's edge, so every spawn clamps.
    const small = worldOf(10, 10);
    const corner = { col: 1, row: 1 };
    const field = new MonsterField(BASE);
    loadAll();
    for (let i = 0; i < 200; i++) {
      field.reset();
      field.update(0, corner, small);
      const m = field.list()[0]!;
      expect(m.col).toBeGreaterThanOrEqual(1);
      expect(m.col).toBeLessThanOrEqual(small.cols - 2);
      expect(m.row).toBeGreaterThanOrEqual(1);
      expect(m.row).toBeLessThanOrEqual(small.rows - 2);
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

describe("MonsterField death", () => {
  it("keeps a dying monster on screen while it plays out", () => {
    const { field, mon } = fieldWith(HERO.col + 3, HERO.row);
    field.attackAt(mon.col, mon.row);
    field.update(FADE / 2, HERO, WORLD);
    expect(field.list()).toContain(mon);
  });

  it("clears the corpse once the death finishes and replaces it", () => {
    const { field, mon } = fieldWith(HERO.col + 3, HERO.row);
    field.attackAt(mon.col, mon.row);
    field.update(FADE, HERO, WORLD);
    expect(field.list()).not.toContain(mon);
    expect(field.list()).toHaveLength(MAX_MONSTERS);
  });
});

interface DrawCall {
  src: string;
  args: number[];
  alpha: number;
  mirrored: boolean;
}

/** Records `drawImage` off an inert 2D context, with the alpha and flip in force. */
function recordingCtx(): { ctx: CanvasRenderingContext2D; calls: DrawCall[] } {
  const calls: DrawCall[] = [];
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
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

/** The one draw call a monster in the given state produces. */
function drawOnce(mutate: (m: Monster) => void, feetX = 0, feetY = 0): DrawCall {
  const { field, mon } = fieldWith(HERO.col, HERO.row);
  mutate(mon);
  const { ctx, calls } = recordingCtx();
  field.draw(ctx, mon, feetX, feetY);
  return calls[0]!;
}

describe("MonsterField.draw", () => {
  it("draws nothing before the sheets have loaded", () => {
    const field = new MonsterField(BASE);
    const { ctx, calls } = recordingCtx();
    field.draw(ctx, { col: 0, row: 0, animT: 0, dying: false, dyingT: 0, faceLeft: false, knock: null }, 0, 0);
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

  it("fades out as the death plays", () => {
    const start = drawOnce((m) => ((m.dying = true), (m.dyingT = 0))).alpha;
    const mid = drawOnce((m) => ((m.dying = true), (m.dyingT = FADE / 2))).alpha;
    expect(start).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(0);
  });

  it("never asks for a negative alpha once the death overruns", () => {
    expect(drawOnce((m) => ((m.dying = true), (m.dyingT = FADE * 3))).alpha).toBe(0);
  });

  it("holds the death animation on its last frame rather than looping", () => {
    const last = drawOnce((m) => ((m.dying = true), (m.dyingT = FADE))).args[0]!;
    expect(drawOnce((m) => ((m.dying = true), (m.dyingT = FADE * 5))).args[0]!).toBe(last);
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
