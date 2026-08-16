import { describe, expect, it } from "vitest";
import { Input } from "./input";

type Handler = (e: { key: string; preventDefault: () => void }) => void;

/** Stands in for `window`, so the listeners can be driven without a DOM. */
class FakeWindow {
  private handlers = new Map<string, Handler[]>();
  prevented: string[] = [];

  addEventListener(type: string, handler: Handler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  private fire(type: string, key: string): void {
    for (const handler of this.handlers.get(type) ?? []) {
      handler({ key, preventDefault: () => this.prevented.push(key) });
    }
  }

  down(key: string): void {
    this.fire("keydown", key);
  }
  up(key: string): void {
    this.fire("keyup", key);
  }
  blur(): void {
    this.fire("blur", "");
  }
}

const inputOn = (win: FakeWindow): Input => new Input(win as unknown as Window);

describe("Input keys", () => {
  it("maps the four keys to the four screen directions", () => {
    const win = new FakeWindow();
    const input = inputOn(win);
    win.down("w");
    expect(input.axis).toEqual({ dc: 0, dr: -1 });
    win.up("w");
    win.down("d");
    expect(input.axis).toEqual({ dc: 1, dr: 0 });
    win.up("d");
    win.down("ArrowDown");
    expect(input.axis).toEqual({ dc: 0, dr: 1 });
  });

  it("adds held keys into a diagonal", () => {
    const win = new FakeWindow();
    const input = inputOn(win);
    win.down("w");
    win.down("a");
    expect(input.axis).toEqual({ dc: -1, dr: -1 });
  });

  it("cancels opposing keys out", () => {
    const win = new FakeWindow();
    const input = inputOn(win);
    win.down("a");
    win.down("d");
    expect(input.axis).toEqual({ dc: 0, dr: 0 });
  });

  it("swallows the scroll keys so the page stays put", () => {
    const win = new FakeWindow();
    inputOn(win);
    win.down("ArrowUp");
    win.down(" ");
    win.down("q");
    expect(win.prevented).toEqual(["ArrowUp", " "]);
  });

  it("drops every key on blur, so nothing stays held", () => {
    const win = new FakeWindow();
    const input = inputOn(win);
    win.down("w");
    win.blur();
    expect(input.axis).toEqual({ dc: 0, dr: 0 });
  });
});

describe("Input attack", () => {
  const swingsFrom = (win: FakeWindow): string[] => {
    const swings: string[] = [];
    inputOn(win).onAttack(() => swings.push("swing"));
    return swings;
  };

  it("swings once however long the key is held", () => {
    const win = new FakeWindow();
    const swings = swingsFrom(win);
    win.down(" ");
    win.down(" "); // auto-repeat, still the one press
    win.down(" ");
    expect(swings).toHaveLength(1);
  });

  it("swings again only after the key comes up", () => {
    const win = new FakeWindow();
    const swings = swingsFrom(win);
    win.down("j");
    win.up("j");
    win.down("j");
    expect(swings).toHaveLength(2);
  });

  it("takes j and space alike", () => {
    const win = new FakeWindow();
    const swings = swingsFrom(win);
    win.down("J");
    win.down(" ");
    expect(swings).toHaveLength(2);
  });

  it("leaves the movement keys out of it", () => {
    const win = new FakeWindow();
    const swings = swingsFrom(win);
    win.down("w");
    win.down("ArrowUp");
    expect(swings).toHaveLength(0);
  });

  it("swings on the press after a blur ate the keyup", () => {
    const win = new FakeWindow();
    const swings = swingsFrom(win);
    win.down("j");
    win.blur();
    win.down("j");
    expect(swings).toHaveLength(2);
  });
});

describe("Input stick", () => {
  it("outranks the keys while it is being held", () => {
    const win = new FakeWindow();
    const input = inputOn(win);
    win.down("w");
    input.setStick({ dc: 3, dr: 4 });
    expect(input.axis).toEqual({ dc: 3, dr: 4 });
    input.setStick(null);
    expect(input.axis).toEqual({ dc: 0, dr: -1 });
  });
});
