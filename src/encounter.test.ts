import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hero } from "./hero";
import { Lives } from "./lives";
import { CONTACT, MELEE, MonsterField, SPAWN_MAX, SPAWN_MIN, SPEED } from "./monsters";
import { ATTACK_DURATION, ATTACK_HIT_AT, Swing } from "./swing";
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

  field.update(0, hero, FLAT); // spawns one, then park it at a known distance
  const mon = field.list()[0]!;
  mon.col = ORIGIN + startDistance;
  mon.row = ORIGIN;

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
    field.update(0, hero, FLAT);
    const mon = field.list()[0]!;
    mon.col = ORIGIN + SPAWN_MIN;
    mon.row = ORIGIN;

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
