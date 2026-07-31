import { describe, expect, it } from "vitest";
import { DEPTH, History, jsonSteps, type Steps } from "./history";

// The outline's own: a flat array of characters, where a slice is the cheapest
// snapshot there is.
const codeSteps: Steps<string[]> = {
  clone: (state) => state.slice(),
  same: (a, b) => a.length === b.length && a.every((code, i) => code === b[i]),
};

const codes = (...of: string[]): string[] => of;

describe("History", () => {
  it("has nothing to undo when it starts", () => {
    const history = new History(codes("a"), codeSteps);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });

  it("steps back to where the work was", () => {
    const history = new History(codes("a", "a"), codeSteps);
    history.record(codes("b", "a"));
    expect(history.undo()).toEqual(["a", "a"]);
    expect(history.canUndo).toBe(false);
  });

  it("steps forward again", () => {
    const history = new History(codes("a"), codeSteps);
    history.record(codes("b"));
    history.undo();
    expect(history.canRedo).toBe(true);
    expect(history.redo()).toEqual(["b"]);
    expect(history.canRedo).toBe(false);
  });

  it("does not count a stroke that changed nothing", () => {
    const history = new History(codes("a"), codeSteps);
    expect(history.record(codes("a"))).toBe(false);
    expect(history.canUndo).toBe(false);
  });

  it("abandons what was undone once something else is done", () => {
    const history = new History(codes("a"), codeSteps);
    history.record(codes("b"));
    history.undo();
    history.record(codes("c"));
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toEqual(["a"]);
  });

  it("hands back copies, so working on one does not rewrite the past", () => {
    const history = new History(codes("a"), codeSteps);
    history.record(codes("b"));
    const back = history.undo()!;
    back[0] = "z";
    expect(history.redo()).toEqual(["b"]);
    expect(history.undo()).toEqual(["a"]);
  });

  it("forgets the oldest steps rather than growing without end", () => {
    const history = new History(codes("0"), codeSteps);
    for (let i = 1; i <= DEPTH + 10; i++) history.record(codes(String(i)));
    let steps = 0;
    while (history.undo()) steps++;
    expect(steps).toBe(DEPTH - 1);
  });

  it("starts again from a state that arrived whole", () => {
    const history = new History(codes("a"), codeSteps);
    history.record(codes("b"));
    history.reset(codes("c"));
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });
});

describe("jsonSteps", () => {
  // What the map and the island keep: a nested thing, not a flat array.
  interface Island {
    ground: (string | null)[];
    props: { id: string; col: number }[];
  }
  const island = (): Island => ({ ground: [null, "grass"], props: [{ id: "tree", col: 2 }] });

  it("steps back through a nested state", () => {
    const history = new History(island(), jsonSteps<Island>());
    const next = island();
    next.props.push({ id: "rock", col: 5 });
    history.record(next);
    expect(history.undo()).toEqual(island());
  });

  it("sees no step where nothing changed, however deep", () => {
    const history = new History(island(), jsonSteps<Island>());
    expect(history.record(island())).toBe(false);
  });

  it("copies deeply, so the past cannot be edited through what it hands back", () => {
    const history = new History(island(), jsonSteps<Island>());
    const next = island();
    next.props[0]!.id = "rock";
    history.record(next);
    const back = history.undo()!;
    back.props[0]!.id = "meddled";
    expect(history.undo()).toBeNull();
    expect(history.redo()!.props[0]!.id).toBe("rock");
  });
});
