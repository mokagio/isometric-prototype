import { describe, expect, it } from "vitest";
import { wallPieces, type FloorAt } from "../../dungeonTiles";
import {
  MAX_STACK,
  NUDGE_PX,
  add,
  agrees,
  cellKey,
  confirm,
  correctionAt,
  counts,
  drawnAt,
  floorWith,
  isStale,
  nudge,
  parseKey,
  removeAt,
  reread,
  revert,
  setFace,
  stackAt,
  stamp,
  type Corrections,
} from "./corrections";

/** A map from rows of "." (floor) and "#" (rock), as the tile tests write them. */
const mapOf =
  (rows: string[]): FloorAt =>
  (col, row) =>
    rows[row]?.[col] === ".";

// A head-on wall: floor below (1,1), rock above. `wallPieces` gives it a face
// and a lip.
const headOn = mapOf(["###", "###", "..."]);
const none: Corrections = {};

describe("cellKey", () => {
  it("round-trips through a key", () => {
    expect(parseKey(cellKey(12, 7))).toEqual({ col: 12, row: 7 });
  });

  it("refuses a key that is not two whole numbers", () => {
    expect(parseKey("nonsense")).toBeNull();
    expect(parseKey("1.5,2")).toBeNull();
    expect(parseKey("3")).toBeNull();
  });
});

describe("an untouched cell", () => {
  it("is still the autotiler's, so the game draws it unchanged", () => {
    expect(drawnAt(none, 1, 1)).toBeNull();
    expect(stackAt(headOn, none, 1, 1)).toEqual(wallPieces(headOn, 1, 1));
  });
});

describe("correcting a cell", () => {
  it("starts from what the autotiler had, so an edit is a correction not a blank slate", () => {
    const after = confirm(headOn, none, 1, 1);
    expect(correctionAt(after, 1, 1)?.auto).toEqual(wallPieces(headOn, 1, 1));
    expect(correctionAt(after, 1, 1)?.fixed).toEqual(wallPieces(headOn, 1, 1));
  });

  it("records the window it was decided against", () => {
    const after = confirm(headOn, none, 1, 1);
    expect(correctionAt(after, 1, 1)?.around).toBe("###/###/...");
  });

  it("leaves the corrections it was given alone, so an undo snapshot survives it", () => {
    const before = stamp(headOn, none, 1, 1, "wall_mid");
    const snapshot = JSON.stringify(before);
    stamp(headOn, before, 1, 1, "wall_edge_left");
    add(headOn, before, 1, 1, "wall_top_mid");
    nudge(headOn, before, 1, 1, 0, -1);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("stamp and add", () => {
  it("makes the cell the one tile stamped on it", () => {
    const after = stamp(headOn, none, 1, 1, "wall_edge_bottom_left");
    expect(drawnAt(after, 1, 1)).toEqual([{ tile: "wall_edge_bottom_left", dx: 0, dy: 0 }]);
  });

  it("lays another tile over the ones already there", () => {
    let after = stamp(headOn, none, 1, 1, "wall_mid");
    after = add(headOn, after, 1, 1, "wall_top_mid");
    expect(drawnAt(after, 1, 1)).toHaveLength(2);
    expect(drawnAt(after, 1, 1)?.[1]?.tile).toBe("wall_top_mid");
  });

  it("refuses to stack deeper than the autotiler ever does", () => {
    let after = stamp(headOn, none, 1, 1, "wall_mid");
    for (let i = 0; i < MAX_STACK + 3; i++) after = add(headOn, after, 1, 1, "wall_top_mid");
    expect(drawnAt(after, 1, 1)).toHaveLength(MAX_STACK);
  });

  it("takes the topmost tile back off", () => {
    let after = stamp(headOn, none, 1, 1, "wall_mid");
    after = add(headOn, after, 1, 1, "wall_top_mid");
    after = removeAt(headOn, after, 1, 1, 1);
    expect(drawnAt(after, 1, 1)).toEqual([{ tile: "wall_mid", dx: 0, dy: 0 }]);
  });
});

describe("nudge", () => {
  it("moves the topmost tile by whole lips", () => {
    let after = stamp(headOn, none, 1, 1, "wall_top_mid");
    after = nudge(headOn, after, 1, 1, 0, -3);
    expect(drawnAt(after, 1, 1)?.[0]).toEqual({
      tile: "wall_top_mid",
      dx: 0,
      dy: -3 * NUDGE_PX,
    });
  });

  it("leaves the tiles under it where they are", () => {
    let after = stamp(headOn, none, 1, 1, "wall_mid");
    after = add(headOn, after, 1, 1, "wall_top_mid");
    after = nudge(headOn, after, 1, 1, 0, -4);
    expect(drawnAt(after, 1, 1)?.[0]).toEqual({ tile: "wall_mid", dx: 0, dy: 0 });
  });
});

describe("setFace", () => {
  it("marks the topmost tile as the brick a banner may hang on", () => {
    let after = stamp(headOn, none, 1, 1, "wall_mid");
    after = setFace(headOn, after, 1, 1, true);
    expect(drawnAt(after, 1, 1)?.[0]?.face).toBe(true);
  });

  it("takes the mark off again without leaving it behind as false", () => {
    let after = stamp(headOn, none, 1, 1, "wall_mid");
    after = setFace(headOn, after, 1, 1, true);
    after = setFace(headOn, after, 1, 1, false);
    expect(drawnAt(after, 1, 1)?.[0]).toEqual({ tile: "wall_mid", dx: 0, dy: 0 });
  });
});

describe("confirm and revert", () => {
  it("keeps a cell that was looked at and left alone", () => {
    const after = confirm(headOn, none, 1, 1);
    expect(agrees(correctionAt(after, 1, 1)!)).toBe(true);
    expect(counts(headOn, after)).toEqual({ corrected: 0, confirmed: 1, stale: 0 });
  });

  it("counts a changed cell as a correction rather than a confirmation", () => {
    const after = stamp(headOn, none, 1, 1, "wall_edge_left");
    expect(agrees(correctionAt(after, 1, 1)!)).toBe(false);
    expect(counts(headOn, after)).toEqual({ corrected: 1, confirmed: 0, stale: 0 });
  });

  it("hands a cell back to the autotiler", () => {
    const after = revert(stamp(headOn, none, 1, 1, "wall_mid"), 1, 1);
    expect(drawnAt(after, 1, 1)).toBeNull();
    expect(stackAt(headOn, after, 1, 1)).toEqual(wallPieces(headOn, 1, 1));
  });
});

describe("floorWith", () => {
  const allRock = mapOf(["###", "###", "###"]);

  it("counts a cell somebody floored by hand as floor", () => {
    const drawn = stamp(allRock, none, 1, 1, "floor_2");
    expect(floorWith(allRock, drawn)(1, 1)).toBe(true);
  });

  it("leaves a floor floor when something is laid over it", () => {
    let drawn = stamp(allRock, none, 1, 1, "floor_2");
    drawn = add(allRock, drawn, 1, 1, "wall_top_mid");
    expect(floorWith(allRock, drawn)(1, 1)).toBe(true);
  });

  it("counts a cell somebody walled as rock", () => {
    const drawn = stamp(allRock, none, 1, 1, "wall_mid");
    expect(floorWith(allRock, drawn)(1, 1)).toBe(false);
  });

  it("leaves a cell nobody has touched to the dig map", () => {
    const dug = mapOf(["###", "#.#", "###"]);
    expect(floorWith(dug, none)(1, 1)).toBe(true);
    expect(floorWith(dug, none)(0, 0)).toBe(false);
  });

  it("gives a room drawn in tiles the same window as one that was dug", () => {
    // Fill a 3x3 with floor down the middle column, then read the window the
    // same way a dug board would give it.
    let drawn: Corrections = none;
    for (const row of [0, 1, 2]) drawn = stamp(allRock, drawn, 1, row, "floor_2");
    const asDrawn = floorWith(allRock, drawn);
    const asDug = mapOf(["#.#", "#.#", "#.#"]);
    for (const row of [0, 1, 2]) {
      for (const col of [0, 1, 2]) expect(asDrawn(col, row)).toBe(asDug(col, row));
    }
  });
});

describe("reread", () => {
  it("takes the window and the autotiler's answer from the floor as it stands", () => {
    const allRock = mapOf(["###", "###", "###"]);
    // Ruled on while everything around was rock...
    let drawn = stamp(allRock, none, 1, 1, "wall_mid");
    expect(correctionAt(drawn, 1, 1)?.around).toBe("###/###/###");
    // ...then the floor below it was laid in.
    const later = mapOf(["###", "###", "..."]);
    drawn = reread(later, drawn);
    expect(correctionAt(drawn, 1, 1)?.around).toBe("###/###/...");
    expect(correctionAt(drawn, 1, 1)?.auto).toEqual(wallPieces(later, 1, 1));
  });

  it("keeps what was drawn", () => {
    const allRock = mapOf(["###", "###", "###"]);
    const drawn = reread(mapOf(["###", "###", "..."]), stamp(allRock, none, 1, 1, "wall_edge_left"));
    expect(drawnAt(drawn, 1, 1)).toEqual([{ tile: "wall_edge_left", dx: 0, dy: 0 }]);
  });

  it("settles the staleness it was called about", () => {
    const allRock = mapOf(["###", "###", "###"]);
    const later = mapOf(["###", "###", "..."]);
    const drawn = stamp(allRock, none, 1, 1, "wall_mid");
    expect(isStale(later, correctionAt(drawn, 1, 1)!, 1, 1)).toBe(true);
    const fresh = reread(later, drawn);
    expect(isStale(later, correctionAt(fresh, 1, 1)!, 1, 1)).toBe(false);
  });
});

describe("removeAt", () => {
  it("takes one tile out of the middle and leaves the rest in order", () => {
    let after = stamp(headOn, none, 1, 1, "wall_mid");
    after = add(headOn, after, 1, 1, "wall_top_mid");
    after = add(headOn, after, 1, 1, "wall_banner_red");
    after = removeAt(headOn, after, 1, 1, 1);
    expect(drawnAt(after, 1, 1)?.map((p) => p.tile)).toEqual(["wall_mid", "wall_banner_red"]);
  });
});

describe("staleness", () => {
  it("spots a correction whose floor has been dug out from under it", () => {
    const after = stamp(headOn, none, 1, 1, "wall_edge_left");
    const dugOut = mapOf(["###", "#..", "..."]);
    expect(isStale(headOn, correctionAt(after, 1, 1)!, 1, 1)).toBe(false);
    expect(isStale(dugOut, correctionAt(after, 1, 1)!, 1, 1)).toBe(true);
    expect(counts(dugOut, after).stale).toBe(1);
  });
});
