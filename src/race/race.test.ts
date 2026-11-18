import { describe, expect, it } from "vitest";
import { bump, GRASS, lapsCrossed, makeKart, spinOut, stepKart, TOP, track, turbo, BOOST, type Kart } from "./kart";
import { CARS, carsUnlocked, rung, RIVAL_STATS } from "./ladder";
import { clock, gridSlots, ordinal, standings } from "./race";
import { rivalDrive } from "./rival";
import { at, BARRIER, clearance, headingAt, locate, makeTrack, MIN_TURN_RADIUS, offset, tightestTurn, type Track } from "./track";
import { crystalAt, drawItem, placeCrystals, ROCKET_REACH, stepRocket, type Rocket } from "./items";
import { decodeSave, freshSave, recordWin } from "./save";
import { steerFromSlide, STEER_TRAVEL } from "./controls";

const track0 = makeTrack(rung(0).seed, rung(0).shape);

function kartOn(t: Track, s: number, lateral = 0): Kart {
  const p = offset(t, s, lateral);
  const k = makeKart(p.x, p.z, headingAt(t, s), CARS[0]!.stats);
  track(t, k);
  k.lap = 0;
  return k;
}

describe("tracks", () => {
  it("never bring two stretches of road within reach of each other's barrier, on any rung", () => {
    for (let n = 0; n < 30; n++) {
      const r = rung(n);
      expect(clearance(makeTrack(r.seed, r.shape)), r.name).toBeGreaterThan(2 * BARRIER);
    }
  });

  it("have no corner too tight to take, on any rung", () => {
    for (let n = 0; n < 30; n++) {
      const r = rung(n);
      expect(tightestTurn(makeTrack(r.seed, r.shape)), r.name).toBeGreaterThanOrEqual(MIN_TURN_RADIUS);
    }
  });

  it("are the same track every time for the same seed", () => {
    const again = makeTrack(rung(0).seed, rung(0).shape);
    expect(Array.from(again.xs)).toEqual(Array.from(track0.xs));
  });

  it("locate a point back to where it was put", () => {
    for (const s of [0, 37.5, track0.length / 2, track0.length - 3]) {
      const p = offset(track0, s, 4);
      const found = locate(track0, p.x, p.z);
      const apart = Math.abs(found.s - s);
      expect(Math.min(apart, track0.length - apart)).toBeLessThan(0.5);
      expect(found.lateral).toBeCloseTo(4, 0);
    }
  });

  it("call the right of the road positive lateral, facing the way the race runs", () => {
    const p = at(track0, 50);
    const yaw = headingAt(track0, 50);
    // Right of a heading in three.js is (-cos yaw, sin yaw).
    const right = { x: p.x - Math.cos(yaw) * 3, z: p.z + Math.sin(yaw) * 3 };
    expect(locate(track0, right.x, right.z).lateral).toBeCloseTo(3, 0);
  });

  it("grow longer up the ladder", () => {
    const a = makeTrack(rung(0).seed, rung(0).shape);
    const b = makeTrack(rung(8).seed, rung(8).shape);
    expect(b.length).toBeGreaterThan(a.length);
  });
});

describe("karts", () => {
  it("reach top speed on the road and only a fraction of it on the grass", () => {
    const road = kartOn(track0, 20);
    const grass = kartOn(track0, 20, BARRIER - 1);
    for (let i = 0; i < 60 * 4; i++) {
      stepKart(track0, road, { throttle: 1, steer: 0 }, 1 / 60);
      stepKart(track0, grass, { throttle: 1, steer: 0 }, 1 / 60);
      grass.yaw = headingAt(track0, grass.s);
      road.yaw = headingAt(track0, road.s);
    }
    expect(road.speed).toBeCloseTo(TOP, 0);
    expect(grass.speed).toBeLessThanOrEqual(TOP * GRASS + 0.01);
  });

  it("do not turn standing still", () => {
    const k = kartOn(track0, 20);
    const yaw = k.yaw;
    stepKart(track0, k, { throttle: 0, steer: 1 }, 0.5);
    expect(k.yaw).toBe(yaw);
  });

  it("go past top speed on a turbo", () => {
    const k = kartOn(track0, 20);
    k.speed = TOP;
    turbo(k);
    for (let i = 0; i < 30; i++) stepKart(track0, k, { throttle: 1, steer: 0 }, 1 / 60);
    expect(k.speed).toBeGreaterThan(TOP);
    expect(k.speed).toBeLessThanOrEqual(TOP * BOOST);
  });

  it("ignore the driver while spinning out, and lose speed", () => {
    const k = kartOn(track0, 20);
    k.speed = 20;
    spinOut(k);
    const yaw = k.yaw;
    stepKart(track0, k, { throttle: 1, steer: 1 }, 0.2);
    expect(k.yaw).toBe(yaw);
    expect(k.speed).toBeLessThan(20);
  });

  it("are stopped by the barrier", () => {
    const k = kartOn(track0, 20, BARRIER + 5);
    expect(Math.abs(k.lateral)).toBeLessThanOrEqual(BARRIER + 1e-6);
  });

  it("count a lap crossing the line forwards and take it back reversing over it", () => {
    expect(lapsCrossed(track0, track0.length - 1, 1)).toBe(1);
    expect(lapsCrossed(track0, 1, track0.length - 1)).toBe(-1);
    expect(lapsCrossed(track0, 50, 52)).toBe(0);
  });

  it("push apart when they touch", () => {
    const a = kartOn(track0, 20);
    const b = kartOn(track0, 20.5);
    a.speed = 20;
    b.speed = 10;
    expect(bump(a, b)).toBe(true);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(2);
    expect(b.speed).toBeGreaterThan(10);
  });
});

describe("rivals", () => {
  it("lap every track on the first dozen rungs without help", () => {
    for (let n = 0; n < 12; n++) {
      const r = rung(n);
      const t = makeTrack(r.seed, r.shape);
      const slot = gridSlots(t, 1)[0]!;
      const k = makeKart(slot.x, slot.z, slot.yaw, RIVAL_STATS);
      track(t, k);
      k.lap = -1;
      let time = 0;
      // A lap at a third of top speed is a driver stuck somewhere.
      const limit = (t.length / (TOP * 0.33)) * 2;
      while (k.lap < 2 && time < limit) {
        stepKart(t, k, rivalDrive(t, k, { lane: 0, skill: r.skill }, 0), 1 / 60);
        time += 1 / 60;
      }
      expect(k.lap, r.name).toBe(2);
    }
  });

  it("stay on the road most of the way round", () => {
    const r = rung(5);
    const t = makeTrack(r.seed, r.shape);
    const k = kartOn(t, 0);
    let off = 0;
    let frames = 0;
    while (k.lap < 1 && frames < 60 * 120) {
      stepKart(t, k, rivalDrive(t, k, { lane: 2, skill: r.skill }, 0), 1 / 60);
      if (Math.abs(k.lateral) > t.width / 2) off++;
      frames++;
    }
    expect(off / frames).toBeLessThan(0.05);
  });
});

describe("the race", () => {
  it("puts the grid behind the line, pole first", () => {
    const slots = gridSlots(track0, 6);
    for (const s of slots) expect(s.s).toBeGreaterThan(track0.length / 2);
    expect(slots[0]!.s).toBeGreaterThan(slots[5]!.s);
  });

  it("orders finishers by time ahead of anyone still racing", () => {
    const a = kartOn(track0, 100);
    const b = kartOn(track0, 50);
    const c = kartOn(track0, 10);
    c.finished = 80;
    expect(standings(track0, [a, b, c])).toEqual([2, 0, 1]);
  });

  it("orders by laps before distance into the lap", () => {
    const a = kartOn(track0, 100);
    const b = kartOn(track0, 20);
    b.lap = 1;
    expect(standings(track0, [a, b])).toEqual([1, 0]);
  });

  it("names places", () => {
    expect([1, 2, 3, 4, 11, 12, 21].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "21st"]);
    expect(clock(65.34)).toBe("1:05.3");
  });
});

describe("items", () => {
  it("give the leader no rockets and the back of the pack no oil", () => {
    for (let roll = 0; roll < 1; roll += 0.01) {
      expect(drawItem(0, 6, roll)).not.toBe("rocket");
      expect(drawItem(5, 6, roll)).not.toBe("oil");
    }
  });

  it("stand the crystals on the road", () => {
    for (const c of placeCrystals(track0)) expect(Math.abs(locate(track0, c.x, c.z).lateral)).toBeLessThan(track0.width / 2);
  });

  it("only hand out a crystal that has grown back", () => {
    const crystals = placeCrystals(track0);
    const c = crystals[0]!;
    expect(crystalAt(crystals, c.x, c.z)).toBe(c);
    c.wait = 1;
    expect(crystalAt(crystals, c.x, c.z)).toBeNull();
  });

  it("send a rocket round to a target off to one side", () => {
    const r: Rocket = { x: 0, z: 0, yaw: 0, target: 1, owner: 0, life: 5 };
    const target = { x: 30, z: 20 };
    let hit = false;
    for (let i = 0; i < 300 && r.life > 0; i++) {
      stepRocket(r, target.x, target.z, 1 / 60);
      if (Math.hypot(r.x - target.x, r.z - target.z) < ROCKET_REACH) hit = true;
    }
    expect(hit).toBe(true);
  });
});

describe("the ladder", () => {
  it("asks more of the rivals as it climbs, but never more than their kart", () => {
    for (let n = 1; n < 40; n++) expect(rung(n).skill).toBeGreaterThanOrEqual(rung(n - 1).skill);
    expect(rung(100).skill).toBeLessThanOrEqual(1.02);
  });

  it("names every rung differently for a long way up", () => {
    const names = new Set(Array.from({ length: 48 }, (_, n) => rung(n).name));
    expect(names.size).toBe(48);
  });

  it("unlocks a kart per win until the garage is full", () => {
    expect(carsUnlocked(0)).toBe(1);
    expect(carsUnlocked(2)).toBe(3);
    expect(carsUnlocked(99)).toBe(CARS.length);
  });

  it("is climbed only by winning the highest open rung", () => {
    const save = freshSave();
    expect(recordWin(save, 0, 90).climbed).toBe(true);
    expect(save.won).toBe(1);
    expect(recordWin(save, 0, 80)).toEqual({ climbed: false, best: true });
    expect(save.won).toBe(1);
    expect(recordWin(save, 0, 85).best).toBe(false);
    expect(save.best[0]).toBe(80);
  });

  it("refuses a saved kart that has not been unlocked", () => {
    expect(decodeSave(JSON.stringify({ won: 1, car: 5 })).car).toBe(1);
    expect(decodeSave("nonsense")).toEqual(freshSave());
  });
});

describe("touch steering", () => {
  it("ignores a thumb that has barely moved, and reaches full lock at the end of its travel", () => {
    expect(steerFromSlide(3)).toBe(0);
    expect(steerFromSlide(STEER_TRAVEL)).toBe(1);
    expect(steerFromSlide(-STEER_TRAVEL)).toBe(-1);
    expect(steerFromSlide(STEER_TRAVEL / 2)).toBeGreaterThan(0.3);
  });
});
