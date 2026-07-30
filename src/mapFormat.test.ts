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
  mapFromWorld,
  readyToPlay,
  unfinishedMapMessage,
  worldFromMap,
  type MapCell,
  type MapData,
} from "./mapFormat";
import { generateWorld, isLiquidTile, type Tile } from "./world";

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

describe("readyToPlay", () => {
  const never = (): boolean => {
    throw new Error("should not have been asked");
  };

  it("plays a finished map without asking anything", () => {
    const map = filled(3, 3, () => ground(GRASS));
    expect(readyToPlay(map, never, GRASS)).toEqual(map);
  });

  it("fills the gaps once and plays, when that is what you want", () => {
    const map = filled(2, 2, (col) => (col === 0 ? ground(STONE) : null));
    const ready = readyToPlay(map, () => true, GRASS)!;
    expect(isComplete(ready)).toBe(true);
    expect(cellAt(ready, 0, 0)?.surface).toEqual(STONE); // what you built stands
    expect(cellAt(ready, 1, 0)?.surface).toEqual(GRASS);
  });

  it("hands back nothing when you would rather keep building", () => {
    const map = filled(2, 2, (col) => (col === 0 ? ground(STONE) : null));
    expect(readyToPlay(map, () => false, GRASS)).toBeNull();
  });

  it("says how much is left to do", () => {
    let asked = "";
    readyToPlay(
      filled(4, 4, (col) => (col === 0 ? ground(GRASS) : null)),
      (message) => ((asked = message), false),
      GRASS,
    );
    expect(asked).toContain("12 tiles");
  });

  it("counts one leftover tile as a tile, not tiles", () => {
    expect(unfinishedMapMessage(1)).toContain("1 tile with");
    expect(unfinishedMapMessage(2)).toContain("2 tiles with");
  });

  it("says what saying yes will do", () => {
    // The offer is grass and nothing else, so the message has to name it.
    expect(unfinishedMapMessage(3)).toMatch(/grass/i);
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

  it("records which build wrote the file", () => {
    // The version says which syntax; this says which code, so a later converter
    // can be written from `git show <commit>:src/mapFormat.ts`.
    const raw = JSON.parse(encodeMap(blank(1, 1))) as { writtenBy: unknown };
    expect(typeof raw.writtenBy).toBe("string");
    expect(raw.writtenBy).not.toBe("");
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

  it("rejects a map from another version, naming both", () => {
    // Both numbers, because the pair is what tells you which converter to write.
    const newer = () => decodeMap(reheat(complete, (raw) => (raw.version = VERSION + 1)));
    expect(newer).toThrow(new RegExp(`version ${VERSION + 1}`));
    expect(newer).toThrow(new RegExp(`version ${VERSION}`));
  });

  it("ignores anything in the file it does not know about", () => {
    // Stamps like `writtenBy` are for whoever reads the file, not for the game,
    // so an unknown field is not a reason to refuse a map.
    expect(() => decodeMap(reheat(complete, (raw) => (raw.writtenBy = 42)))).not.toThrow();
    expect(() => decodeMap(reheat(complete, (raw) => (raw.somethingLater = { a: 1 })))).not.toThrow();
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

  it("makes hand-placed liquid cost something, whatever its hue", () => {
    // Which of the two it costs — a heart or the crossing — is `world.ts`'s call.
    const world = worldFromMap(filled(4, 1, (col) => ground([col, 10])));
    for (let col = 0; col < 4; col++) {
      expect(world.isHazard(col, 0) || world.blocks(col, 0), `hue ${col}`).toBe(true);
    }
  });

  it("leaves solid ground walkable", () => {
    const world = worldFromMap(filled(2, 1, (col) => ground(col === 0 ? GRASS : STONE)));
    for (const col of [0, 1]) {
      expect(world.isHazard(col, 0)).toBe(false);
      expect(world.blocks(col, 0)).toBe(false);
    }
  });

  it("reads past the edge as the nearest edge cell, like a generated world", () => {
    const world = worldFromMap(filled(2, 2, (col) => ground(col === 0 ? GRASS : WATER)));
    expect(world.isHazard(99, 0)).toBe(true);
    expect(world.isHazard(-99, 0)).toBe(false);
  });

  it("refuses a map that still has gaps in it", () => {
    expect(() => worldFromMap(blank(2, 2))).toThrow(/empty tiles/i);
  });

  it("plays a gappy map once the gaps are filled", () => {
    const world = worldFromMap(fillEmpty(blank(2, 2), GRASS));
    expect(world.isHazard(0, 0)).toBe(false);
  });
});

describe("mapFromWorld", () => {
  const world = generateWorld(24, 24, 4242);

  it("hands over a finished map, with nothing left to fill", () => {
    const map = mapFromWorld(world);
    expect(map.cols).toBe(24);
    expect(map.rows).toBe(24);
    expect(isComplete(map)).toBe(true);
  });

  it("brings a generated world back unchanged through the format", () => {
    // This is the editor opening the world you are playing, then handing it
    // straight back: every cell has to survive both trips.
    const back = worldFromMap(decodeMap(encodeMap(mapFromWorld(world))));
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        expect(back.cell(col, row)).toEqual(world.cell(col, row));
      }
    }
  });

  it("keeps the generated world's water wet", () => {
    // A map carries tiles, not verdicts, so the round trip has to rediscover
    // what hurts from the tile alone — a mismatch dries up a lake or floods a field.
    const back = worldFromMap(mapFromWorld(world));
    let water = 0;
    for (let row = 0; row < world.rows; row++) {
      for (let col = 0; col < world.cols; col++) {
        expect(back.isHazard(col, row)).toBe(world.isHazard(col, row));
        expect(back.blocks(col, row)).toBe(world.blocks(col, row));
        if (world.isHazard(col, row)) water++;
      }
    }
    expect(water).toBeGreaterThan(0); // or the check above proves nothing
  });

  it("does not transpose the world on the way out", () => {
    const oblong = generateWorld(9, 5, 7);
    const map = mapFromWorld(oblong);
    expect(map.cols).toBe(9);
    expect(map.rows).toBe(5);
    expect(cellAt(map, 8, 4)).toEqual({
      height: oblong.cell(8, 4).height,
      surface: oblong.cell(8, 4).surface,
    });
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
