import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hero } from "./hero";
import { Lives } from "./lives";
import { CONTACT, MELEE, MonsterField, SPAWN_MAX, SPAWN_MIN, SPEED } from "./monsters";
import { ATTACK_DURATION, ATTACK_HIT_AT, Swing } from "./swing";
import { HP, LASH_REACH, Treant } from "./treant";
import type { World } from "./world";

// Same `new Image()` stub the monster tests use: the node environment has none.
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

const FLAT = { cols: 400, rows: 400, heightAt: () => 0 } as unknown as World;
const STILL = { axis: { dc: 0, dr: 0 }, jump: false };
const DT = 1 / 60;
const ORIGIN = 200;
const OFFSTAGE = 380; // far enough that the rest of the wave never joins in

/**
 * One monster from a freshly spawned wave, parked `startDistance` out along +col
 * with its wave-mates sent offstage. These tests are about a single approach; the
 * wave as a whole is covered in `monsters.test.ts`.
 */
function loneMonster(field: MonsterField, hero: Hero, startDistance: number) {
  field.update(0, hero, FLAT);
  const [mon, ...rest] = field.list();
  mon!.col = ORIGIN + startDistance;
  mon!.row = ORIGIN;
  rest.forEach((m, i) => {
    m.col = OFFSTAGE;
    m.row = OFFSTAGE - i * 3;
  });
  return mon!;
}

/**
 * Runs the real hero, field, swing, and lives against one monster walking in
 * from `startDistance`, with the player holding the attack button down. Returns
 * the hearts it cost to see that monster off.
 */
function encounter(startDistance: number): number {
  const field = new MonsterField("/");
  pending.forEach((i) => i.onload?.());

  const hero = new Hero(ORIGIN, ORIGIN, FLAT);
  const lives = new Lives();
  const swing = new Swing();

  const mon = loneMonster(field, hero, startDistance);

  const before = lives.lives;
  for (let t = 0; t < 20; t += DT) {
    swing.start(); // held down: re-swings the moment the last one finishes
    hero.update(DT, STILL, FLAT);
    field.update(DT, hero, FLAT);
    if (swing.update(DT)) field.attackAt(hero.col, hero.row);
    const bumping = field.contactAt(hero.col, hero.row);
    if (bumping && lives.hit()) hero.knockback(hero.col - bumping.col, hero.row - bumping.row);
    if (!field.list().includes(mon)) break; // it died and faded
  }
  return before - lives.lives;
}

describe("fighting off an incoming monster", () => {
  it("costs nothing across the whole spawn ring", () => {
    // Every spawn distance puts the swing on a different phase, so sweep the
    // ring rather than trusting one lucky starting point.
    const costs: number[] = [];
    for (let d = SPAWN_MIN; d <= SPAWN_MAX; d += 0.05) costs.push(encounter(d));
    expect(Math.max(...costs)).toBe(0);
  });

  it("costs a heart if the hero never swings", () => {
    // Guards the sweep above: it must be the swinging that saves the hero, not
    // some quirk of the harness that keeps the monster away.
    const field = new MonsterField("/");
    pending.forEach((i) => i.onload?.());
    const hero = new Hero(ORIGIN, ORIGIN, FLAT);
    const lives = new Lives();
    loneMonster(field, hero, SPAWN_MIN);

    for (let t = 0; t < 10; t += DT) {
      hero.update(DT, STILL, FLAT);
      field.update(DT, hero, FLAT);
      const bumping = field.contactAt(hero.col, hero.row);
      if (bumping && lives.hit()) hero.knockback(hero.col - bumping.col, hero.row - bumping.row);
    }
    expect(lives.lives).toBeLessThan(10);
  });

  it("keeps the blade reaching further than a monster travels between swings", () => {
    // The invariant behind the sweep, spanning two modules. A monster is
    // killable from MELEE and starts hurting at CONTACT, so it is exposed for
    // (MELEE - CONTACT) / SPEED seconds. Swings land ATTACK_DURATION apart; if
    // that gap is the longer of the two, approaches slip through it untouched
    // however well the player times the button.
    const exposed = (MELEE - CONTACT) / SPEED;
    expect(exposed).toBeGreaterThan(ATTACK_DURATION);
  });

  it("lands the blow before the swing animation ends", () => {
    // Otherwise the kill resolves a further ATTACK_DURATION - ATTACK_HIT_AT late,
    // eating most of the margin the reach above buys.
    expect(ATTACK_HIT_AT).toBeLessThan(ATTACK_DURATION);
  });
});

/**
 * The same hero, swing and lives against the boss, wired the way `main.ts` wires
 * them, with the player holding the attack button and closing back to `away` cells
 * whenever the lash shoves them off it. Returns the hearts it cost and what the
 * boss had left.
 */
function bossFight(away: number): { cost: number; hp: number } {
  const hero = new Hero(ORIGIN, ORIGIN + away, FLAT);
  const lives = new Lives();
  const swing = new Swing();
  const boss = new Treant();
  const at = { col: ORIGIN, row: ORIGIN };

  const before = lives.lives;
  for (let t = 0; t < 30 && boss.alive; t += DT) {
    swing.start();
    // Walk back in when knocked off the mark, and hold there once on it.
    const gap = Math.hypot(hero.col - at.col, hero.row - at.row) - away;
    const closing = gap > 0.05 ? { axis: { dc: 0, dr: -1 }, jump: false } : STILL;
    hero.update(DT, closing, FLAT);

    const fromBoss = Math.hypot(hero.col - at.col, hero.row - at.row);
    if (swing.update(DT) && boss.alive && fromBoss <= MELEE) boss.hit();
    if (boss.update(DT) && fromBoss <= LASH_REACH && lives.hit()) {
      hero.knockback(hero.col - at.col, hero.row - at.row);
    }
  }
  return { cost: before - lives.lives, hp: boss.hp };
}

describe("standing up to the boss", () => {
  it("falls to the hero's own sword, at the hero's own reach", () => {
    expect(bossFight(MELEE - 0.1).hp).toBe(0);
  });

  it("costs hearts to stand inside the lash while doing it", () => {
    // The trade the fight is made of: close enough to swing is close enough to
    // be caught, so the hero has to step out between roars.
    expect(bossFight(MELEE - 0.1).cost).toBeGreaterThan(0);
  });

  it("cannot be worn down from outside the blade", () => {
    expect(bossFight(MELEE + 0.5).hp).toBe(HP);
  });

  it("keeps the lash reaching past the blade, so there is no free swing", () => {
    // If the hero could hit it from outside its reach the fight would be a
    // formality — stand at MELEE and hold the button.
    expect(LASH_REACH).toBeGreaterThan(MELEE);
  });
});
