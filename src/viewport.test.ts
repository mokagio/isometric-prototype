import { describe, expect, it } from "vitest";
import { backingSize, Viewport } from "./viewport";

describe("backingSize", () => {
  it("scales CSS pixels by the device ratio", () => {
    expect(backingSize(800, 600, 2)).toEqual({ width: 1600, height: 1200 });
    expect(backingSize(375, 667, 3)).toEqual({ width: 1125, height: 2001 });
  });

  it("rounds to whole device pixels", () => {
    expect(backingSize(801, 601, 1.5)).toEqual({ width: 1202, height: 902 });
  });
});

interface FakeCanvas {
  width: number;
  height: number;
  style: { width?: string; height?: string };
}

const fakeCanvas = (): FakeCanvas => ({ width: 0, height: 0, style: {} });

const fakeWin = (innerWidth: number, innerHeight: number, devicePixelRatio: number) => ({
  innerWidth,
  innerHeight,
  devicePixelRatio,
});

const viewportOf = (canvas: FakeCanvas, win: ReturnType<typeof fakeWin>): Viewport =>
  new Viewport(canvas as unknown as HTMLCanvasElement, win);

describe("Viewport.fit", () => {
  it("sizes the backing store and CSS box to the window", () => {
    const canvas = fakeCanvas();
    const vp = viewportOf(canvas, fakeWin(800, 600, 2));
    expect(vp.fit()).toBe(true);
    expect([vp.width, vp.height, vp.dpr]).toEqual([800, 600, 2]);
    expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
    expect([canvas.style.width, canvas.style.height]).toEqual(["800px", "600px"]);
  });

  it("is a no-op when the window size has not changed", () => {
    const canvas = fakeCanvas();
    const vp = viewportOf(canvas, fakeWin(800, 600, 2));
    expect(vp.fit()).toBe(true);
    canvas.width = 0; // a second fit must not rewrite the canvas
    expect(vp.fit()).toBe(false);
    expect(canvas.width).toBe(0);
  });

  it("defaults a missing device ratio to 1", () => {
    const canvas = fakeCanvas();
    const vp = viewportOf(canvas, fakeWin(400, 300, 0));
    vp.fit();
    expect(vp.dpr).toBe(1);
    expect(canvas.width).toBe(400);
  });
});

describe("Viewport.applyTransform", () => {
  it("maps one CSS pixel to dpr device pixels", () => {
    const canvas = fakeCanvas();
    const vp = viewportOf(canvas, fakeWin(800, 600, 2));
    vp.fit();
    const calls: number[][] = [];
    const ctx = { setTransform: (...a: number[]) => calls.push(a) } as unknown as CanvasRenderingContext2D;
    vp.applyTransform(ctx);
    expect(calls[0]).toEqual([2, 0, 0, 2, 0, 0]);
  });
});
