import { describe, expect, it } from "vitest";
import {
  COAST_GROUPS,
  COAST_SHEET_SIZE,
  COAST_TILES,
  coastTile,
  coastTilesIn,
  GRASS_CODE,
  isCoastCode,
  SEA_CODE,
} from "./coastTiles";
import { FENCE_RING, FIELD } from "./field";
import {
  codeAt,
  decodeOutline,
  draw,
  drawnOutline,
  editable,
  encodeOutline,
  fromRows,
  grownOutline,
  MAP_NAME,
  outlineFilename,
  setDrawnOutline,
  toRows,
  VERSION,
} from "./outline";

const everyCell = (fn: (col: number, row: number) => void): void => {
  for (let row = 0; row < FIELD; row++) for (let col = 0; col < FIELD; col++) fn(col, row);
};

describe("the coast tiles", () => {
  it("gives every tile a character of its own", () => {
    const codes = COAST_TILES.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("keeps every code a single character, so a row is one per cell", () => {
    for (const tile of COAST_TILES) expect(tile.code, tile.label).toHaveLength(1);
  });

  it("survives a round trip through JSON, which is what a file is", () => {
    for (const tile of COAST_TILES) {
      expect(JSON.parse(JSON.stringify(tile.code)) as string, tile.label).toBe(tile.code);
    }
  });

  it("puts every tile in a declared group, and fills every one", () => {
    const known = new Set(COAST_GROUPS.map((g) => g.id));
    for (const tile of COAST_TILES) expect(known.has(tile.group), tile.label).toBe(true);
    for (const group of COAST_GROUPS) expect(coastTilesIn(group.id), group.label).not.toHaveLength(0);
  });

  it("keeps every tile inside the strip it is cut from", () => {
    for (const tile of COAST_TILES) {
      if (!tile.sheet) continue;
      const size = COAST_SHEET_SIZE[tile.sheet];
      expect(tile.col, tile.label).toBeLessThan(size.cols);
      expect(tile.row, tile.label).toBeLessThan(size.rows);
      expect(tile.col, tile.label).toBeGreaterThanOrEqual(0);
      expect(tile.row, tile.label).toBeGreaterThanOrEqual(0);
    }
  });

  it("reads an unknown character as open water rather than throwing", () => {
    expect(isCoastCode("§")).toBe(false);
    expect(coastTile("§").code).toBe(SEA_CODE);
  });
});

describe("editable", () => {
  it("is the band outside the fence, and nothing within it", () => {
    everyCell((col, row) => {
      const ring = Math.min(col, row, FIELD - 1 - col, FIELD - 1 - row);
      expect(editable(col, row), `${col},${row}`).toBe(ring < FENCE_RING);
    });
  });

  it("is nowhere off the field", () => {
    expect(editable(-1, 0)).toBe(false);
    expect(editable(0, FIELD)).toBe(false);
  });
});

describe("grownOutline", () => {
  it("writes down a tile the palette knows for every cell", () => {
    const outline = grownOutline();
    expect(outline).toHaveLength(FIELD * FIELD);
    everyCell((col, row) => {
      expect(isCoastCode(codeAt(outline, col, row)), `${col},${row}`).toBe(true);
    });
  });

  it("leaves the game's own square as plain grass", () => {
    const outline = grownOutline();
    everyCell((col, row) => {
      if (!editable(col, row)) expect(codeAt(outline, col, row), `${col},${row}`).toBe(GRASS_CODE);
    });
  });

  it("puts a coastline down, so the page does not open on an empty sea", () => {
    const codes = new Set(grownOutline());
    expect(codes.has("w")).toBe(true); // the south shore, which every island has
    expect(codes.has(SEA_CODE)).toBe(true);
    expect(codes.size).toBeGreaterThan(3);
  });
});

describe("draw", () => {
  it("lays a tile in a cell of the band", () => {
    const outline = grownOutline();
    draw(outline, 0, 20, "W");
    expect(codeAt(outline, 0, 20)).toBe("W");
  });

  it("refuses to touch the game's square", () => {
    const outline = grownOutline();
    const mid = Math.floor(FIELD / 2);
    draw(outline, mid, mid, SEA_CODE);
    expect(codeAt(outline, mid, mid)).toBe(GRASS_CODE);
  });

  it("refuses a character no tile answers to", () => {
    const outline = grownOutline();
    draw(outline, 0, 20, "§");
    expect(codeAt(outline, 0, 20)).not.toBe("§");
  });
});

describe("a file", () => {
  it("comes back the way it went in", () => {
    const outline = grownOutline();
    draw(outline, 0, 20, "W");
    draw(outline, 1, 20, "Q");
    const back = decodeOutline(encodeOutline(outline));
    expect(toRows(back)).toEqual(toRows(outline));
  });

  it("is rows of characters, one line per row, so it reads in a diff", () => {
    const file = JSON.parse(encodeOutline(grownOutline())) as { rows: string[]; name: string; version: number };
    expect(file.name).toBe(MAP_NAME);
    expect(file.version).toBe(VERSION);
    expect(file.rows).toHaveLength(FIELD);
    for (const line of file.rows) expect(line).toHaveLength(FIELD);
  });

  it("is refused by name, by version and by size", () => {
    const ok = JSON.parse(encodeOutline(grownOutline())) as Record<string, unknown>;
    expect(() => decodeOutline("not json")).toThrow();
    expect(() => decodeOutline(JSON.stringify({ ...ok, name: "something-else" }))).toThrow();
    expect(() => decodeOutline(JSON.stringify({ ...ok, version: VERSION + 1 }))).toThrow();
    expect(() => decodeOutline(JSON.stringify({ ...ok, size: FIELD + 2 }))).toThrow();
    expect(() => decodeOutline(JSON.stringify({ ...ok, rows: ["short"] }))).toThrow();
  });

  it("drops whatever a file says about the game's square", () => {
    const flooded = Array.from({ length: FIELD }, () => SEA_CODE.repeat(FIELD));
    const outline = fromRows(flooded);
    everyCell((col, row) => {
      if (!editable(col, row)) expect(codeAt(outline, col, row), `${col},${row}`).toBe(GRASS_CODE);
    });
  });

  it("reads a character it does not know as open water", () => {
    const rows = Array.from({ length: FIELD }, () => "§".repeat(FIELD));
    expect(codeAt(fromRows(rows), 0, 0)).toBe(SEA_CODE);
  });

  it("is filed under the local day, not tomorrow's UTC one", () => {
    expect(outlineFilename(new Date(2026, 6, 31, 22, 30))).toBe("outline-2026-07-31.json");
  });
});

describe("the outline in play", () => {
  it("is nothing until one is handed over", () => {
    setDrawnOutline(null);
    expect(drawnOutline()).toBeNull();
  });

  it("refuses one of the wrong size rather than drawing half an island", () => {
    setDrawnOutline([SEA_CODE, GRASS_CODE]);
    expect(drawnOutline()).toBeNull();
  });

  it("stands until it is cleared", () => {
    const outline = grownOutline();
    setDrawnOutline(outline);
    try {
      expect(drawnOutline()).toBe(outline);
    } finally {
      setDrawnOutline(null);
    }
  });
});
