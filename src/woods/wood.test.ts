import { describe, expect, it } from "vitest";
import { FIELD, MIDDLE, TILE, treeAt } from "./field";
import {
  AXE_REACH,
  BOUNCE_FPS,
  BOUNCE_FRAMES,
  CHOP_FPS,
  CHOP_FRAMES,
  Chop,
  CHOPS_TO_FELL,
  IMPACT_FRAME,
  Wood,
} from "./wood";

/** A tree well inside the field, to swing at. */
const someTree = (): { col: number; row: number } => {
  for (let row = 4; row < FIELD - 4; row++) {
    for (let col = 4; col < FIELD - 4; col++) if (treeAt(col, row)) return { col, row };
  }
  throw new Error("the field has no trees to test against");
};

const base = (t: { col: number; row: number }): { x: number; y: number } => ({
  x: t.col * TILE + TILE / 2,
  y: t.row * TILE + TILE / 2,
});

describe("Wood.inReach", () => {
  it("finds nothing out in the open", () => {
    expect(new Wood().inReach(MIDDLE)).toBeNull();
  });

  it("finds the tree you are standing beside", () => {
    const tree = someTree();
    const at = base(tree);
    expect(new Wood().inReach({ x: at.x + 10, y: at.y })).toEqual(tree);
  });

  it("comes live well out from the trunk, so you need not be against the bark", () => {
    const tree = someTree();
    const at = base(tree);
    expect(new Wood().inReach({ x: at.x + 1.5 * TILE, y: at.y })).toEqual(tree);
  });

  // Trees stand three cells apart, so stepping out of one's reach can walk into
  // the next one's: these ask whether *this* tree is still on offer.
  it("stops where the axe stops — a tree past AXE_REACH is not offered", () => {
    const tree = someTree();
    const at = base(tree);
    expect(new Wood().inReach({ x: at.x + AXE_REACH + 1, y: at.y })).not.toEqual(tree);
    expect(new Wood().inReach({ x: at.x, y: at.y - (AXE_REACH + 1) })).not.toEqual(tree);
  });

  it("measures the reach as a distance, not per axis", () => {
    // Diagonally further than the reach, though within it on either axis alone.
    const tree = someTree();
    const at = base(tree);
    const step = AXE_REACH * 0.8;
    expect(new Wood().inReach({ x: at.x + step, y: at.y + step })).not.toEqual(tree);
  });

  it("offers nothing once a tree is a stump", () => {
    const wood = new Wood();
    const tree = someTree();
    const beside = { x: base(tree).x + 10, y: base(tree).y };
    for (let i = 0; i < CHOPS_TO_FELL; i++) wood.hit(tree.col, tree.row);
    expect(wood.isStump(tree.col, tree.row)).toBe(true);
    expect(wood.inReach(beside)).toBeNull();
  });
});

describe("Wood.hit", () => {
  it("takes three blows to fell a tree", () => {
    const wood = new Wood();
    const { col, row } = someTree();
    for (let i = 1; i < CHOPS_TO_FELL; i++) {
      expect(wood.hit(col, row), `blow ${i}`).toBe(false);
      expect(wood.isStump(col, row)).toBe(false);
    }
    expect(wood.hit(col, row)).toBe(true);
    expect(wood.isStump(col, row)).toBe(true);
    expect(wood.chopsOn(col, row)).toBe(CHOPS_TO_FELL);
  });

  it("shakes the tree it was struck, and only for a moment", () => {
    const wood = new Wood();
    const { col, row } = someTree();
    expect(wood.frame(col, row)).toBe(0); // standing still: no idle sway
    wood.hit(col, row);
    const frames = new Set<number>();
    for (let t = 0; t < BOUNCE_FRAMES / BOUNCE_FPS; t += 1 / 60) {
      frames.add(wood.frame(col, row));
      wood.update(1 / 60);
    }
    expect(frames.size).toBeGreaterThan(1); // it moved through the strip
    expect(Math.max(...frames)).toBeLessThan(BOUNCE_FRAMES);
    wood.update(1); // well past the shudder
    expect(wood.frame(col, row)).toBe(0);
  });

  it("leaves a stump standing still", () => {
    const wood = new Wood();
    const { col, row } = someTree();
    for (let i = 0; i < CHOPS_TO_FELL; i++) wood.hit(col, row);
    expect(wood.frame(col, row)).toBe(0);
  });

  it("keeps its trees apart", () => {
    const wood = new Wood();
    const { col, row } = someTree();
    wood.hit(col, row);
    expect(wood.chopsOn(col + 3, row)).toBe(0);
    expect(wood.frame(col + 3, row)).toBe(0);
  });
});

describe("Chop", () => {
  const tree = { col: 5, row: 5 };
  const DT = 1 / 60;

  it("does nothing until it is started", () => {
    const chop = new Chop();
    expect(chop.active).toBe(false);
    expect(chop.update(DT)).toBe(false);
  });

  it("lands exactly one blow, at the frame with the impact on it", () => {
    const chop = new Chop();
    chop.start(tree);
    let hits = 0;
    let frameAtHit = -1;
    for (let i = 0; i < CHOP_FRAMES / CHOP_FPS / DT + 5; i++) {
      const landed = chop.update(DT);
      if (landed) {
        hits++;
        frameAtHit = chop.frame();
      }
    }
    expect(hits).toBe(1);
    expect(frameAtHit).toBe(IMPACT_FRAME);
  });

  it("runs the whole strip and then stops", () => {
    const chop = new Chop();
    chop.start(tree);
    let frames = 0;
    while (chop.active && frames < 1000) {
      chop.update(DT);
      frames++;
    }
    expect(chop.active).toBe(false);
    expect(frames * DT).toBeCloseTo(CHOP_FRAMES / CHOP_FPS, 1);
  });

  it("ignores a second swing while the first is still going", () => {
    const chop = new Chop();
    chop.start(tree);
    chop.update(DT);
    chop.start({ col: 9, row: 9 });
    expect(chop.target).toEqual(tree);
  });
});
