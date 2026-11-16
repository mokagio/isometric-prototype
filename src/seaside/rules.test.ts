import { describe, expect, it } from "vitest";
import { actionFor, bare, dig, grow, pick, plant, RIPE, STAGE_TIME, water } from "./garden";
import { BITE_TIME, cast, idleLine, pickFish, reel, stepLine, WAIT_MAX } from "./fishing";
import { LAY_MAX, makeChicken, MAX_EGGS, stepChicken } from "./coop";
import { add, buySeed, nextSeed, SEED_PRICE, SELL, sellAll, startingPack, takeSeed } from "./market";
import { decodeSave, encodeSave, freshSave } from "./save";

const run = (seconds: number, step: (dt: number) => void): void => {
  for (let t = 0; t < seconds; t += 1 / 30) step(1 / 30);
};

describe("the garden", () => {
  it("goes dig, plant, water, and is picked when ripe", () => {
    const p = bare();
    expect(actionFor(p, true)).toBe("dig");
    dig(p);
    expect(actionFor(p, false)).toBeNull();
    expect(actionFor(p, true)).toBe("plant");
    plant(p, "carrot");
    expect(actionFor(p, true)).toBe("water");
    for (let s = 0; s < RIPE; s++) {
      water(p);
      run(STAGE_TIME.carrot + 0.1, (dt) => grow(p, dt));
    }
    expect(actionFor(p, true)).toBe("pick");
    expect(pick(p)).toBe("carrot");
    expect(p.dug).toBe(true);
    expect(p.crop).toBeNull();
  });

  it("does not grow a stage without water", () => {
    const p = bare();
    dig(p);
    plant(p, "radish");
    run(STAGE_TIME.radish * 3, (dt) => grow(p, dt));
    expect(p.stage).toBe(0);
    water(p);
    run(STAGE_TIME.radish + 0.1, (dt) => grow(p, dt));
    // One stage per watering: it is thirsty again.
    expect(p.stage).toBe(1);
    expect(actionFor(p, false)).toBe("water");
  });
});

describe("fishing", () => {
  it("lands a fish when reeled while it bites", () => {
    const line = idleLine();
    cast(line, () => 0);
    let landed: string | null = null;
    run(WAIT_MAX + 2, (dt) => {
      if (line.state === "bite") reel(line, () => 0);
      landed = stepLine(line, dt) ?? landed;
    });
    expect(landed).toBe("sardine");
  });

  it("loses the fish if reeled too soon or too late", () => {
    const early = idleLine();
    cast(early, () => 0.5);
    run(0.3, (dt) => stepLine(early, dt));
    reel(early);
    expect(early.state).toBe("missed");

    const late = idleLine();
    cast(late, () => 0);
    let landed: string | null = null;
    run(WAIT_MAX + BITE_TIME + 2, (dt) => (landed = stepLine(late, dt) ?? landed));
    expect(landed).toBeNull();
  });

  it("is mostly sardines, and only now and then the golden fish", () => {
    expect(pickFish(0)).toBe("sardine");
    expect(pickFish(0.6)).toBe("mackerel");
    expect(pickFish(0.99)).toBe("golden");
  });
});

describe("the chickens", () => {
  const pen = { x0: 0, y0: 0, x1: 50, y1: 50 };
  it("lay an egg every so often, inside the pen", () => {
    const c = makeChicken(pen, () => 0.5);
    let egg: { x: number; y: number } | null = null;
    run(LAY_MAX + 1, (dt) => (egg = stepChicken(c, dt, pen, 0, () => 0.5) ?? egg));
    expect(egg).not.toBeNull();
    expect(c.x >= pen.x0 && c.x <= pen.x1 && c.y >= pen.y0 && c.y <= pen.y1).toBe(true);
  });

  it("stop laying when the pen is full of eggs", () => {
    const c = makeChicken(pen, () => 0.5);
    let egg: { x: number; y: number } | null = null;
    run(LAY_MAX + 1, (dt) => (egg = stepChicken(c, dt, pen, MAX_EGGS, () => 0.5) ?? egg));
    expect(egg).toBeNull();
  });
});

describe("the market", () => {
  it("buys everything carried and sells seeds for coins", () => {
    const pack = startingPack();
    add(pack, "carrot", 2);
    add(pack, "egg");
    expect(sellAll(pack)).toBe(SELL.carrot * 2 + SELL.egg);
    expect(pack.items).toEqual({});
    const coins = pack.coins;
    expect(buySeed(pack, "radish")).toBe(true);
    expect(pack.coins).toBe(coins - SEED_PRICE.radish);
    pack.coins = 0;
    expect(buySeed(pack, "pumpkin")).toBe(false);
  });

  it("cycles through the seeds in hand", () => {
    const pack = startingPack();
    pack.seeds.cabbage = 1;
    expect(nextSeed(pack, null)).toBe("carrot");
    expect(nextSeed(pack, "carrot")).toBe("cabbage");
    expect(nextSeed(pack, "cabbage")).toBe("carrot");
    expect(takeSeed(pack, "cabbage")).toBe(true);
    expect(takeSeed(pack, "cabbage")).toBe(false);
  });
});

describe("the save", () => {
  it("round-trips the pack and the garden", () => {
    const save = freshSave(3);
    save.pack.coins = 42;
    save.pack.items.golden = 1;
    dig(save.plots[1]!);
    plant(save.plots[1]!, "pumpkin");
    water(save.plots[1]!);
    expect(decodeSave(encodeSave(save), 3)).toEqual(save);
  });

  it("starts over on anything it cannot read", () => {
    expect(decodeSave("{nope", 2)).toEqual(freshSave(2));
    expect(decodeSave(JSON.stringify({ pack: { coins: -5, items: { carrot: "lots" } }, plots: [{ crop: "banana", dug: true }] }), 1)).toEqual({
      pack: { coins: 0, items: {}, seeds: {} },
      plots: [{ dug: true, crop: null, stage: 0, watered: false, grown: 0 }],
    });
  });
});
