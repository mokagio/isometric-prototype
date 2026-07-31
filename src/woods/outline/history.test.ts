import { describe, expect, it } from "vitest";
import { DEPTH, History } from "./history";

const state = (...codes: string[]): string[] => codes;

describe("History", () => {
  it("has nothing to undo when it starts", () => {
    const history = new History(state("a"));
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });

  it("steps back to where the drawing was", () => {
    const history = new History(state("a", "a"));
    history.record(state("b", "a"));
    expect(history.undo()).toEqual(["a", "a"]);
    expect(history.canUndo).toBe(false);
  });

  it("steps forward again", () => {
    const history = new History(state("a"));
    history.record(state("b"));
    history.undo();
    expect(history.canRedo).toBe(true);
    expect(history.redo()).toEqual(["b"]);
    expect(history.canRedo).toBe(false);
  });

  it("does not count a stroke that changed nothing", () => {
    const history = new History(state("a"));
    expect(history.record(state("a"))).toBe(false);
    expect(history.canUndo).toBe(false);
  });

  it("abandons what was undone once something else is drawn", () => {
    const history = new History(state("a"));
    history.record(state("b"));
    history.undo();
    history.record(state("c"));
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toEqual(["a"]);
  });

  it("hands back copies, so drawing on one does not rewrite the past", () => {
    const history = new History(state("a"));
    history.record(state("b"));
    const back = history.undo()!;
    back[0] = "z";
    expect(history.redo()).toEqual(["b"]);
    expect(history.undo()).toEqual(["a"]);
  });

  it("forgets the oldest steps rather than growing without end", () => {
    const history = new History(state("0"));
    for (let i = 1; i <= DEPTH + 10; i++) history.record(state(String(i)));
    let steps = 0;
    while (history.undo()) steps++;
    expect(steps).toBe(DEPTH - 1);
  });

  it("starts again from a drawing that arrived whole", () => {
    const history = new History(state("a"));
    history.record(state("b"));
    history.reset(state("c"));
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });
});
