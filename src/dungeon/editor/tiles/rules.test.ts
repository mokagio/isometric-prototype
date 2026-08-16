import { describe, expect, it } from "vitest";
import type { FloorAt } from "../../dungeonTiles";
import { confirm, stamp, type Corrections } from "./corrections";
import { conflicts, rulesFrom } from "./rules";

const mapOf =
  (rows: string[]): FloorAt =>
  (col, row) =>
    rows[row]?.[col] === ".";

// Two cells with the same surroundings, and one with different ones.
const isFloor = mapOf(["#####", "#####", "....."]);

describe("rulesFrom", () => {
  it("gives nothing back when nothing has been ruled on", () => {
    expect(rulesFrom({})).toEqual([]);
  });

  it("collects cells by the shape they were decided against, not where they are", () => {
    let corrections = stamp(isFloor, {}, 1, 1, "wall_edge_left");
    corrections = stamp(isFloor, corrections, 2, 1, "wall_edge_left");
    corrections = stamp(isFloor, corrections, 3, 1, "wall_edge_left");
    const rules = rulesFrom(corrections);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ around: "###/###/...", cells: 3, conflict: false });
    expect(rules[0]!.drawnAs).toHaveLength(1);
    expect(rules[0]!.drawnAs[0]!.cells).toBe(3);
  });

  it("keeps a window drawn two ways as one rule with two answers", () => {
    let corrections = stamp(isFloor, {}, 1, 1, "wall_edge_left");
    corrections = stamp(isFloor, corrections, 2, 1, "wall_edge_left");
    corrections = stamp(isFloor, corrections, 3, 1, "wall_edge_right");
    const rules = rulesFrom(corrections);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.conflict).toBe(true);
    // Commonest first, so the one drawn twice leads.
    expect(rules[0]!.drawnAs.map((v) => v.cells)).toEqual([2, 1]);
  });

  it("keeps a confirmation, marked as what the autotiler already does", () => {
    const rules = rulesFrom(confirm(isFloor, {}, 1, 1));
    expect(rules).toHaveLength(1);
    expect(rules[0]!.drawnAs[0]!.agrees).toBe(true);
  });

  it("counts a correction as disagreeing with the autotiler", () => {
    const rules = rulesFrom(stamp(isFloor, {}, 1, 1, "wall_edge_left"));
    expect(rules[0]!.drawnAs[0]!.agrees).toBe(false);
  });

  it("comes out in the same order however the corrections were made", () => {
    const forwards = stamp(isFloor, stamp(isFloor, {}, 1, 1, "wall_mid"), 1, 2, "floor_1");
    const backwards = stamp(isFloor, stamp(isFloor, {}, 1, 2, "floor_1"), 1, 1, "wall_mid");
    expect(JSON.stringify(rulesFrom(forwards))).toBe(JSON.stringify(rulesFrom(backwards)));
  });
});

describe("conflicts", () => {
  it("picks out only the windows drawn more than one way", () => {
    let corrections: Corrections = stamp(isFloor, {}, 1, 1, "wall_edge_left");
    corrections = stamp(isFloor, corrections, 2, 1, "wall_edge_right");
    corrections = stamp(isFloor, corrections, 1, 2, "floor_1");
    const rules = rulesFrom(corrections);
    expect(rules.length).toBeGreaterThan(1);
    expect(conflicts(rules)).toHaveLength(1);
    expect(conflicts(rules)[0]!.around).toBe("###/###/...");
  });
});
