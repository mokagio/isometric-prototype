import { describe, expect, it } from "vitest";
import { drawHearts } from "./hearts";

const ROW = 5; // hearts in the row under test

interface Pip {
  x: number;
  alpha: number;
}

function lay(left: number, total = ROW, midX = 300, scale = 2): Pip[] {
  const pips: Pip[] = [];
  const ctx = {
    globalAlpha: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    save() {},
    restore() {},
    fillText(_text: string, x: number) {
      pips.push({ x, alpha: ctx.globalAlpha });
    },
  };
  drawHearts(ctx as unknown as CanvasRenderingContext2D, left, total, midX, 100, scale);
  return pips;
}

describe("drawHearts", () => {
  it("lays one heart per blow the figure can take", () => {
    expect(lay(ROW).length).toBe(ROW);
  });

  it("keeps the row's width as hearts are spent, dimming rather than dropping them", () => {
    const full = lay(ROW);
    const hurt = lay(2);
    expect(hurt.map((p) => p.x)).toEqual(full.map((p) => p.x));
    expect(hurt.map((p) => p.alpha < 1)).toEqual([false, false, true, true, true]);
  });

  it("centres the row on the sprite", () => {
    const pips = lay(ROW, ROW, 300);
    expect((pips[0]!.x + pips[pips.length - 1]!.x) / 2).toBe(300);
  });

  it("scales the row with the sprite", () => {
    const span = (scale: number): number => {
      const pips = lay(ROW, ROW, 300, scale);
      return pips[pips.length - 1]!.x - pips[0]!.x;
    };
    expect(span(4)).toBe(span(2) * 2);
  });

  it("lays a single heart on the sprite's own middle", () => {
    // What a one-heart monster shows: no row to centre, just the one pip.
    expect(lay(1, 1, 300).map((p) => p.x)).toEqual([300]);
  });

  it("dims the whole row to the caller's ghost alpha", () => {
    expect(lay(ROW, ROW, 300, 2).every((p) => p.alpha === 1)).toBe(true);
    const ctx = {
      globalAlpha: 1,
      font: "",
      textAlign: "",
      textBaseline: "",
      save() {},
      restore() {},
      alphas: [] as number[],
      fillText() {
        ctx.alphas.push(ctx.globalAlpha);
      },
    };
    drawHearts(ctx as unknown as CanvasRenderingContext2D, ROW, ROW, 300, 100, 2, 0.5);
    expect(ctx.alphas).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);
  });
});
