import { describe, expect, it } from "vitest";
import { Input } from "./input";

/** Stands in for `window`, so key state can be driven without a DOM. */
class FakeTarget {
  private handlers = new Map<string, (e: never) => void>();

  addEventListener(type: string, handler: (e: never) => void): void {
    this.handlers.set(type, handler);
  }

  press(key: string): void {
    this.handlers.get("keydown")?.({ key, preventDefault: () => {} } as never);
  }

  release(key: string): void {
    this.handlers.get("keyup")?.({ key } as never);
  }
}

const make = (): { input: Input; target: FakeTarget } => {
  const target = new FakeTarget();
  return { input: new Input(target as unknown as Window), target };
};

describe("Input.axis", () => {
  it("sums held keys into a screen direction", () => {
    const { input, target } = make();
    target.press("ArrowUp");
    expect(input.axis).toEqual({ dc: -1, dr: -1 });
    target.press("ArrowRight");
    expect(input.axis).toEqual({ dc: 0, dr: -2 }); // the grid axis a pad needs two keys for
  });

  it("lets the stick override the keyboard while it is held", () => {
    const { input, target } = make();
    target.press("ArrowUp");
    input.setStick({ dc: 0.5, dr: -0.25 });
    expect(input.axis).toEqual({ dc: 0.5, dr: -0.25 });
  });

  it("hands steering back to the keys when the stick is released", () => {
    const { input, target } = make();
    target.press("ArrowUp");
    input.setStick({ dc: 0.5, dr: -0.25 });
    input.setStick(null);
    expect(input.axis).toEqual({ dc: -1, dr: -1 });
  });

  it("stands still when neither is active", () => {
    const { input } = make();
    expect(input.axis).toEqual({ dc: 0, dr: 0 });
  });
});

describe("Input.jump", () => {
  it("is idle with nothing held", () => {
    expect(make().input.jump).toBe(false);
  });

  it("reads the spacebar", () => {
    const { input, target } = make();
    target.press(" ");
    expect(input.jump).toBe(true);
    target.release(" ");
    expect(input.jump).toBe(false);
  });

  it("reads the on-screen button", () => {
    const { input } = make();
    input.setJump(true);
    expect(input.jump).toBe(true);
    input.setJump(false);
    expect(input.jump).toBe(false);
  });

  it("stays held while either source is down", () => {
    const { input, target } = make();
    target.press(" ");
    input.setJump(true);
    input.setJump(false); // thumb off the button, spacebar still down
    expect(input.jump).toBe(true);
    target.release(" ");
    expect(input.jump).toBe(false);
  });
});
