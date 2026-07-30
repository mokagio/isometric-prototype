import { describe, expect, it } from "vitest";
import {
  cellAt,
  countEmpty,
  decodeMap,
  encodeMap,
  fillEmpty,
  FORMAT,
  isComplete,
  MAX_SIDE,
  VERSION,
  worldFromMap,
  type MapCell,
  type MapData,
} from "./mapFormat";
import { isLiquidTile, type Tile } from "./world";

const GRASS: Tile = [1, 1];
const STONE: Tile = [0, 4];
const WATER: Tile = [0, 10];
const LAVA: Tile = [3, 10];

const ground = (surface: Tile): MapCell => ({ height: 0, surface });

/** A cols x rows map, every cell empty. */
const blank = (cols: number, rows: number): MapData => ({
  cols,
  rows,
  cells: Array.from({ length: cols * rows }, () => null),
});

/** A map with `at` applied to every cell, so tests can vary by position. */
const filled = (cols: number, rows: number, at: (col: number, row: number) => MapCell | null): MapData => ({
  cols,
  rows,
  cells: Array.from({ length: cols * rows }, (_, i) => at(i % cols, Math.floor(i / cols))),
});

/** What survives a trip through the file format. */
const roundTrip = (map: MapData): MapData => decodeMap(encodeMap(map));

const reheat = (map: MapData, edit: (raw: Record<string, unknown>) => void): string => {
  const raw = JSON.parse(encodeMap(map)) as Record<string, unknown>;
  edit(raw);
  return JSON.stringify(raw);
};

describe("map cells", () => {
  it("reads a cell by its grid position", () => {
    const map = filled(3, 2, (col, row) => ground([col, row]));
    expect(cellAt(map, 2, 1)?.surface).toEqual([2, 1]);
  });

  it("reads nothing outside the map rather than wrapping to another row", () => {
    const map = filled(3, 2, () => ground(GRASS));
    expect(cellAt(map, 3, 0)).toBeNull();
    expect(cellAt(map, -1, 1)).toBeNull();
    expect(cellAt(map, 0, 2)).toBeNull();
  });

  it("counts the gaps left in a half-built map", () => {
    const map = filled(4, 4, (col) => (col === 0 ? ground(GRASS) : null));
    expect(countEmpty(map)).toBe(12);
    expect(isComplete(map)).toBe(false);
  });

  it("calls a map with no gaps complete", () => {
    expect(isComplete(filled(3, 3, () => ground(GRASS)))).toBe(true);
    expect(countEmpty(filled(3, 3, () => ground(GRASS)))).toBe(0);
  });

  it("fills the gaps at ground level and leaves placed tiles alone", () => {
    const map = filled(2, 2, (col) => (col === 0 ? { height: 3, surface: STONE } : null));
    const done = fillEmpty(map, GRASS);
    expect(isComplete(done)).toBe(true);
    expect(cellAt(done, 0, 0)).toEqual({ height: 3, surface: STONE });
    expect(cellAt(done, 1, 0)).toEqual({ height: 0, surface: GRASS });
  });

  it("leaves the original map untouched when filling", () => {
    const map = blank(2, 2);
    fillEmpty(map, GRASS);
    expect(countEmpty(map)).toBe(4);
  });
});

describe("map encoding", () => {
  it("round-trips tiles, heights and gaps", () => {
    const map = filled(4, 3, (col, row) => {
      if (col === row) return null;
      return { height: col, surface: col > row ? STONE : GRASS };
    });
    expect(roundTrip(map)).toEqual(map);
  });

  it("round-trips a map of a single tile", () => {
    expect(roundTrip(filled(1, 1, () => ground(GRASS)))).toEqual(filled(1, 1, () => ground(GRASS)));
  });

  it("round-trips a map that is nothing but gaps", () => {
    expect(roundTrip(blank(3, 2))).toEqual(blank(3, 2));
  });

  it("keeps rows and columns the right way round on a non-square map", () => {
    const map = filled(5, 2, (col, row) => ground([col, row]));
    const back = roundTrip(map);
    expect(back.cols).toBe(5);
    expect(back.rows).toBe(2);
    expect(cellAt(back, 4, 1)?.surface).toEqual([4, 1]);
  });

  it("lists each distinct tile once, however often it is used", () => {
    const map = filled(20, 20, (col) => ground(col % 2 ? GRASS : STONE));
    const raw = JSON.parse(encodeMap(map)) as { palette: Tile[] };
    expect(raw.palette).toHaveLength(2);
  });

  it("stamps the format and version so a stray file can be told apart", () => {
    const raw = JSON.parse(encodeMap(blank(1, 1))) as Record<string, unknown>;
    expect(raw.format).toBe(FORMAT);
    expect(raw.version).toBe(VERSION);
  });
});

describe("map decoding", () => {
  const complete = filled(2, 2, () => ground(GRASS));

  it("rejects a file that is not JSON at all", () => {
    expect(() => decodeMap("<html>nope</html>")).toThrow(/not a map/i);
  });

  it("rejects JSON that is not a map", () => {
    expect(() => decodeMap('{"hello":"world"}')).toThrow(/not a Whispering Woods map/i);
    expect(() => decodeMap("[1,2,3]")).toThrow(/not a Whispering Woods map/i);
    expect(() => decodeMap("null")).toThrow(/not a Whispering Woods map/i);
  });

  it("rejects a map from another version", () => {
    expect(() => decodeMap(reheat(complete, (raw) => (raw.version = VERSION + 1)))).toThrow(/different version/i);
  });

  it("rejects sizes it will not allocate", () => {
    for (const side of [0, -4, 1.5, MAX_SIDE + 1, "40", null]) {
      expect(() => decodeMap(reheat(complete, (raw) => (raw.cols = side)))).toThrow(/1 and 256/);
    }
  });

  it("rejects a map whose cell count disagrees with its size", () => {
    expect(() => decodeMap(reheat(complete, (raw) => (raw.tiles = [0, 0, 0])))).toThrow(/half-saved/i);
    expect(() => decodeMap(reheat(complete, (raw) => (raw.heights = [])))).toThrow(/half-saved/i);
  });

  it("rejects a map with no tile list, or a malformed one", () => {
    expect(() => decodeMap(reheat(complete, (raw) => delete raw.palette))).toThrow(/tile list is missing/i);
    expect(() => decodeMap(reheat(complete, (raw) => (raw.palette = [[1]])))).toThrow(/cannot describe/i);
    expect(() => decodeMap(reheat(complete, (raw) => (raw.palette = [["a", "b"]])))).toThrow(/cannot describe/i);
  });

  it("rejects a tile index that is not in the map's own list", () => {
    expect(() => decodeMap(reheat(complete, (raw) => (raw.tiles = [0, 0, 0, 9])))).toThrow(/isn't in its own/i);
  });

  it("rejects an impossible height", () => {
    expect(() => decodeMap(reheat(complete, (raw) => (raw.heights = [0, 0, 0, -1])))).toThrow(/impossible height/i);
    expect(() => decodeMap(reheat(complete, (raw) => (raw.heights = [0, 0, 0, 1.5])))).toThrow(/impossible height/i);
  });

  it("keeps a gap's height out of the way of validation", () => {
    // An empty cell carries no height, so whatever sits in the slot is ignored.
    expect(() => decodeMap(reheat(blank(2, 2), (raw) => (raw.heights = [0, -3, 0, 0])))).not.toThrow();
  });
});

describe("worldFromMap", () => {
  it("keeps the map's shape", () => {
    const world = worldFromMap(filled(5, 3, () => ground(GRASS)));
    expect(world.cols).toBe(5);
    expect(world.rows).toBe(3);
  });

  it("stands each column at the height it was built to", () => {
    const world = worldFromMap(filled(3, 3, (col) => ({ height: col, surface: STONE })));
    expect(world.heightAt(0, 0)).toBe(0);
    expect(world.heightAt(2, 1)).toBe(2);
  });

  it("keeps the surface each column was capped with", () => {
    const world = worldFromMap(filled(2, 2, (col) => ground(col === 0 ? GRASS : STONE)));
    expect(world.cell(0, 0).surface).toEqual(GRASS);
    expect(world.cell(1, 0).surface).toEqual(STONE);
  });

  it("makes hand-placed liquid block movement, whatever its hue", () => {
    const world = worldFromMap(filled(4, 1, (col) => ground([col, 10])));
    for (let col = 0; col < 4; col++) expect(world.isWater(col, 0)).toBe(true);
  });

  it("leaves solid ground walkable", () => {
    const world = worldFromMap(filled(2, 1, (col) => ground(col === 0 ? GRASS : STONE)));
    expect(world.isWater(0, 0)).toBe(false);
    expect(world.isWater(1, 0)).toBe(false);
  });

  it("reads past the edge as the nearest edge cell, like a generated world", () => {
    const world = worldFromMap(filled(2, 2, (col) => ground(col === 0 ? GRASS : WATER)));
    expect(world.isWater(99, 0)).toBe(true);
    expect(world.isWater(-99, 0)).toBe(false);
  });

  it("refuses a map that still has gaps in it", () => {
    expect(() => worldFromMap(blank(2, 2))).toThrow(/empty tiles/i);
  });

  it("plays a gappy map once the gaps are filled", () => {
    const world = worldFromMap(fillEmpty(blank(2, 2), GRASS));
    expect(world.isWater(0, 0)).toBe(false);
  });
});

describe("isLiquidTile", () => {
  it("treats the whole pool row as liquid", () => {
    expect(isLiquidTile(WATER)).toBe(true);
    expect(isLiquidTile(LAVA)).toBe(true);
    expect(isLiquidTile([1, 10])).toBe(true);
    expect(isLiquidTile([2, 10])).toBe(true);
  });

  it("leaves ground tiles solid", () => {
    expect(isLiquidTile(GRASS)).toBe(false);
    expect(isLiquidTile(STONE)).toBe(false);
    expect(isLiquidTile([7, 1])).toBe(false); // blue foliage, not a pool
  });
});
