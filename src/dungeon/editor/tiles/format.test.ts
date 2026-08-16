import { describe, expect, it } from "vitest";
import type { FloorAt } from "../../dungeonTiles";
import { confirm, stamp, type Corrections } from "./corrections";
import {
  FORMAT,
  MAX_SIDE,
  VERSION,
  buildFile,
  decodePiece,
  decodeTiles,
  encodePiece,
  encodeTiles,
  tilesFilename,
} from "./format";

const mapOf =
  (rows: string[]): FloorAt =>
  (col, row) =>
    rows[row]?.[col] === ".";

const board = ["####", "####", "....", "...."];
const isFloor = mapOf(board);
const size = { cols: 4, rows: 4 };
const SAVED = "2026-08-05T09:00:00.000Z";

const fileFrom = (corrections: Corrections, floor: FloorAt = isFloor) =>
  buildFile(floor, size, corrections, SAVED);

describe("encodePiece and decodePiece", () => {
  it("round-trips a piece, offsets and all", () => {
    const piece = { tile: "wall_top_mid" as const, dx: 0, dy: -16 };
    expect(decodePiece(encodePiece(piece))).toEqual(piece);
  });

  it("round-trips the mark that lets a banner hang", () => {
    const piece = { tile: "wall_mid" as const, dx: 0, dy: 0, face: true };
    expect(encodePiece(piece)).toBe("wall_mid@0,0 face");
    expect(decodePiece("wall_mid@0,0 face")).toEqual(piece);
  });

  it("leaves the mark off rather than writing it as false", () => {
    expect(encodePiece({ tile: "wall_mid", dx: 0, dy: 0 })).toBe("wall_mid@0,0");
    expect(decodePiece("wall_mid@0,0")).not.toHaveProperty("face");
  });

  it("refuses a tile the sheet does not have", () => {
    expect(() => decodePiece("wall_invented@0,0")).toThrow(/no tile called/);
  });

  it("refuses something that is not a tile and an offset", () => {
    expect(() => decodePiece("wall_mid")).toThrow(/not a tile and an offset/);
    expect(() => decodePiece("")).toThrow();
  });
});

describe("buildFile", () => {
  it("writes the floor one string per row, in the tile tests' alphabet", () => {
    expect(fileFrom({}).floor).toEqual(board);
  });

  it("carries what a corrected cell was decided against, and both answers", () => {
    const file = fileFrom(stamp(isFloor, {}, 1, 1, "wall_edge_left"));
    expect(file.cells).toHaveLength(1);
    const cell = file.cells[0]!;
    expect(cell).toMatchObject({ col: 1, row: 1, agrees: false });
    expect(cell.around).toBe("###/###/...");
    expect(cell.fixed).toEqual(["wall_edge_left@0,0"]);
    expect(cell.auto.length).toBeGreaterThan(0);
  });

  it("keeps a cell that was looked at and left alone", () => {
    const file = fileFrom(confirm(isFloor, {}, 1, 1));
    expect(file.cells[0]!.agrees).toBe(true);
    expect(file.counts).toMatchObject({ corrected: 0, confirmed: 1 });
  });

  it("flags a cell the floor moved under rather than dropping it", () => {
    const corrections = stamp(isFloor, {}, 1, 1, "wall_edge_left");
    const dugOut = mapOf(["####", "#...", "....", "...."]);
    const file = buildFile(dugOut, size, corrections, SAVED);
    expect(file.cells).toHaveLength(1);
    expect(file.cells[0]!.stale).toBe(true);
    expect(file.counts.stale).toBe(1);
  });

  it("collapses cells drawn the same way into one rule", () => {
    let corrections = stamp(isFloor, {}, 1, 1, "wall_edge_left");
    corrections = stamp(isFloor, corrections, 2, 1, "wall_edge_left");
    const file = fileFrom(corrections);
    expect(file.rules).toHaveLength(1);
    expect(file.rules[0]).toMatchObject({ cells: 2, conflict: false });
  });

  it("writes a rule's pieces the same compact way a cell's are", () => {
    const file = fileFrom(stamp(isFloor, {}, 1, 1, "wall_edge_left"));
    expect(file.rules[0]!.drawnAs[0]!.fixed).toEqual(["wall_edge_left@0,0"]);
  });

  it("says so when the same window was drawn two ways", () => {
    let corrections = stamp(isFloor, {}, 1, 1, "wall_edge_left");
    corrections = stamp(isFloor, corrections, 2, 1, "wall_edge_right");
    const file = fileFrom(corrections);
    expect(file.rules).toHaveLength(1);
    expect(file.rules[0]!.conflict).toBe(true);
    expect(file.rules[0]!.drawnAs).toHaveLength(2);
    expect(file.counts.conflicts).toBe(1);
  });

  it("comes out row-major, so the same work is always the same bytes", () => {
    let a: Corrections = {};
    a = stamp(isFloor, a, 2, 1, "wall_mid");
    a = stamp(isFloor, a, 1, 1, "wall_mid");
    let b: Corrections = {};
    b = stamp(isFloor, b, 1, 1, "wall_mid");
    b = stamp(isFloor, b, 2, 1, "wall_mid");
    expect(encodeTiles(fileFrom(a))).toBe(encodeTiles(fileFrom(b)));
  });

  it("stamps the format, the version and when it was written", () => {
    const file = fileFrom({});
    expect(file).toMatchObject({ format: FORMAT, version: VERSION, savedAt: SAVED });
  });
});

describe("decodeTiles", () => {
  const corrections = stamp(isFloor, confirm(isFloor, {}, 0, 1), 1, 1, "wall_edge_left");

  it("brings the corrections back", () => {
    const opened = decodeTiles(encodeTiles(fileFrom(corrections)));
    expect(opened).toMatchObject({ cols: 4, rows: 4 });
    expect(opened.corrections).toEqual(corrections);
  });

  it("survives a second trip out and back unchanged", () => {
    const once = encodeTiles(fileFrom(corrections));
    const twice = encodeTiles(fileFrom(decodeTiles(once).corrections));
    expect(twice).toBe(once);
  });

  it("refuses a stranger's file by name", () => {
    expect(() => decodeTiles(JSON.stringify({ format: "something-else" }))).toThrow(
      /not made by the tile editor/,
    );
  });

  it("refuses a file from a later version by number", () => {
    expect(() => decodeTiles(JSON.stringify({ format: FORMAT, version: VERSION + 1 }))).toThrow(
      new RegExp(`version ${VERSION + 1}`),
    );
  });

  it("refuses a size that would ask for a million cells", () => {
    const huge = JSON.stringify({ format: FORMAT, version: VERSION, cols: MAX_SIDE + 1, rows: 4, cells: [] });
    expect(() => decodeTiles(huge)).toThrow(new RegExp(String(MAX_SIDE)));
  });

  it("refuses something that is not JSON at all", () => {
    expect(() => decodeTiles("not json")).toThrow(/not JSON/);
  });

  it("refuses a file naming a tile the sheet does not have", () => {
    const file = fileFrom(corrections) as unknown as { cells: { fixed: string[] }[] };
    file.cells[0]!.fixed = ["wall_invented@0,0"];
    expect(() => decodeTiles(JSON.stringify(file))).toThrow(/no tile called/);
  });

  it("refuses a cell that lost what it was decided against", () => {
    const file = fileFrom(corrections) as unknown as { cells: Record<string, unknown>[] };
    delete file.cells[0]!["around"];
    expect(() => decodeTiles(JSON.stringify(file))).toThrow(/decided against/);
  });
});

describe("tilesFilename", () => {
  it("names the file for the local day, zero-padded", () => {
    expect(tilesFilename(new Date(2026, 7, 5))).toBe("amelias-dungeon-tiles-2026-08-05.json");
    expect(tilesFilename(new Date(2026, 10, 21))).toBe("amelias-dungeon-tiles-2026-11-21.json");
  });
});
