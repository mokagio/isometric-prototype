import { describe, expect, it } from "vitest";
import { FENCE_RING, FIELD } from "./field";
import {
  decodeOutline,
  draw,
  encodeOutline,
  floodable,
  fromRows,
  grownOutline,
  landAt,
  outlineFilename,
  SEA,
  toRows,
} from "./outline";

const MID = Math.floor(FIELD / 2);

describe("grownOutline", () => {
  it("hands the editor the island it would have grown", () => {
    const outline = grownOutline();
    expect(outline.length).toBe(FIELD * FIELD);
    expect(outline.some((land) => land)).toBe(true);
    expect(outline.some((land) => !land)).toBe(true); // there is sea out there too
  });

  it("opens on something legal: the fenced square is dry", () => {
    const outline = grownOutline();
    for (let row = FENCE_RING; row <= FIELD - 1 - FENCE_RING; row++) {
      for (let col = FENCE_RING; col <= FIELD - 1 - FENCE_RING; col++) {
        expect(landAt(outline, col, row), `${col},${row}`).toBe(true);
      }
    }
  });
});

describe("floodable", () => {
  it("lets the sea in outside the fence", () => {
    expect(floodable(0, MID)).toBe(true);
    expect(floodable(FENCE_RING - 1, MID)).toBe(true);
  });

  it("keeps it out of the fenced square, which is where people stand", () => {
    expect(floodable(FENCE_RING, MID)).toBe(false);
    expect(floodable(MID, MID)).toBe(false);
  });

  it("says nothing of cells that are not there", () => {
    expect(floodable(-1, MID)).toBe(false);
    expect(floodable(FIELD, MID)).toBe(false);
  });
});

describe("draw", () => {
  it("paints land and sea outside the fence", () => {
    const outline = grownOutline();
    draw(outline, 0, MID, false);
    expect(landAt(outline, 0, MID)).toBe(false);
    draw(outline, 0, MID, true);
    expect(landAt(outline, 0, MID)).toBe(true);
  });

  it("refuses to flood the fenced square, however hard it is asked", () => {
    const outline = grownOutline();
    draw(outline, MID, MID, false);
    expect(landAt(outline, MID, MID)).toBe(true);
  });

  it("still lets land be painted anywhere, including out at sea", () => {
    const outline = grownOutline();
    draw(outline, 0, 0, true);
    expect(landAt(outline, 0, 0)).toBe(true);
  });

  it("ignores a cell off the field rather than growing the array", () => {
    const outline = grownOutline();
    draw(outline, -1, -1, true);
    expect(outline.length).toBe(FIELD * FIELD);
  });
});

describe("rows", () => {
  it("writes a row of characters per row of the field", () => {
    const rows = toRows(grownOutline());
    expect(rows.length).toBe(FIELD);
    for (const line of rows) expect(line.length).toBe(FIELD);
  });

  it("reads back exactly what it wrote", () => {
    const outline = grownOutline();
    draw(outline, 0, 0, false);
    draw(outline, 1, 0, true);
    expect(toRows(fromRows(toRows(outline)))).toEqual(toRows(outline));
  });

  it("fills the fenced square in whatever a file claims", () => {
    // A file drawn against an older, smaller fence would otherwise strand the
    // walker in the sea.
    const flooded = new Array<string>(FIELD).fill(SEA.repeat(FIELD));
    const outline = fromRows(flooded);
    expect(landAt(outline, MID, MID)).toBe(true);
    expect(landAt(outline, 0, 0)).toBe(false); // and the rest stays as drawn
  });
});

describe("encodeOutline and decodeOutline", () => {
  it("brings an outline back unchanged through a file", () => {
    const outline = grownOutline();
    draw(outline, 0, MID, false);
    draw(outline, 1, MID, false);
    expect(toRows(decodeOutline(encodeOutline(outline)))).toEqual(toRows(outline));
  });

  it("writes the rows so they can be read in the file", () => {
    const text = encodeOutline(grownOutline());
    expect(text).toContain(SEA);
    expect(text.split("\n").length).toBeGreaterThan(FIELD); // a line per row, not one blob
  });

  it("refuses what it cannot be sure of", () => {
    expect(() => decodeOutline("not json")).toThrow(/not even JSON/i);
    expect(() => decodeOutline(JSON.stringify({ name: "something-else" }))).toThrow(/not made by/i);
    const outline = JSON.parse(encodeOutline(grownOutline())) as Record<string, unknown>;
    expect(() => decodeOutline(JSON.stringify({ ...outline, version: 99 }))).toThrow(/version/i);
    expect(() => decodeOutline(JSON.stringify({ ...outline, size: 8 }))).toThrow(/across/i);
    expect(() => decodeOutline(JSON.stringify({ ...outline, rows: ["short"] }))).toThrow(/damaged/i);
  });
});

describe("outlineFilename", () => {
  it("files an outline under the local day it was saved", () => {
    expect(outlineFilename(new Date(2026, 6, 31, 23, 30))).toBe("outline-2026-07-31.json");
  });
});
