import { describe, expect, it } from "vitest";
import { footprint, solidCells, variantAt, type Prop } from "./library";
import { BRUSHES, CATEGORIES, PROPS, assetById, groundById, propById } from "./manifest";
import { SHEETS, sheetUrl, type SheetId } from "./sheets";

const inSheet = (sheet: SheetId, col: number, row: number): boolean => {
  const s = SHEETS[sheet];
  return col >= 0 && row >= 0 && col < s.cols && row < s.rows;
};

describe("sheets", () => {
  it("loads through the base URL, so the project page does not 404", () => {
    expect(sheetUrl("tileset")).toBe("/sunnyside/tileset.png");
  });
});

describe("manifest", () => {
  const all = [...BRUSHES, ...PROPS];

  it("gives every asset a unique id", () => {
    const ids = all.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("puts every asset in a declared category", () => {
    const known = new Set(CATEGORIES.map((c) => c.id));
    for (const a of all) expect(known.has(a.category), `${a.id} is in ${a.category}`).toBe(true);
  });

  it("fills every category", () => {
    for (const c of CATEGORIES) {
      expect(all.some((a) => a.category === c.id), `${c.id} has no assets`).toBe(true);
    }
  });

  it("keeps every ground tile inside its sheet", () => {
    for (const g of BRUSHES) {
      expect(g.variants.length, `${g.id} has no tiles`).toBeGreaterThan(0);
      for (const t of g.variants) expect(inSheet(g.sheet, t.col, t.row), `${g.id} at ${t.col},${t.row}`).toBe(true);
    }
  });

  it("keeps water off the walker, and only water", () => {
    const solid = BRUSHES.filter((g) => g.solid).map((g) => g.id);
    expect(solid).toEqual(["river", "sea"]);
  });

  it("lets flat things be built on, and keeps them out from underfoot", () => {
    const flats = PROPS.filter((p) => p.layer === "flat");
    expect(flats.map((p) => p.id)).toContain("soil");
    for (const p of flats) expect(p.solid, p.id).toBe("none");
  });

  it("keeps every prop tile inside its sheet", () => {
    for (const p of PROPS) {
      if (p.art.kind === "tiles") {
        for (const t of p.art.tiles) {
          expect(inSheet(p.art.sheet, t.col, t.row), `${p.id} at ${t.col},${t.row}`).toBe(true);
        }
      }
      if (p.art.kind === "tileStrip") {
        const last = p.art.col + p.art.frames - 1;
        expect(inSheet(p.art.sheet, last, p.art.row), `${p.id} last frame`).toBe(true);
      }
      if (p.art.kind === "sprite") {
        expect(p.art.frames, p.id).toBe(SHEETS[p.art.sheet].cols);
      }
    }
  });

  it("keeps every prop's tiles within its own footprint", () => {
    for (const p of PROPS) {
      if (p.art.kind !== "tiles") continue;
      const cells = SHEETS[p.art.sheet].cellW / 16; // a 32px forest tile covers two cells
      for (const t of p.art.tiles) {
        expect(t.dx * cells, `${p.id} tile dx`).toBeLessThan(p.w);
        expect(t.dy * cells, `${p.id} tile dy`).toBeLessThan(p.h);
      }
    }
  });

  it("anchors every prop on a cell it covers", () => {
    for (const p of PROPS) {
      expect(p.base.dx, p.id).toBeGreaterThanOrEqual(0);
      expect(p.base.dy, p.id).toBeGreaterThanOrEqual(0);
      expect(p.base.dx, p.id).toBeLessThan(p.w);
      expect(p.base.dy, p.id).toBeLessThan(p.h);
    }
  });

  it("finds assets by id, and tells ground from props", () => {
    expect(groundById("grass")?.label).toBe("Grass");
    expect(propById("tree")?.label).toBe("Tree");
    expect(groundById("tree")).toBeUndefined();
    expect(propById("grass")).toBeUndefined();
    expect(assetById("nothing-here")).toBeUndefined();
  });

  it("offers every house in all five of the pack's colours", () => {
    const houses = PROPS.filter((p) => p.category === "houses");
    for (const colour of ["blue", "green", "orange", "red", "purple"]) {
      expect(houses.filter((p) => p.id.endsWith(`-${colour}`)).length, colour).toBe(houses.length / 5);
    }
  });
});

describe("footprint", () => {
  const prop = (w: number, h: number, dx: number, dy: number, solid: Prop["solid"]): Prop => ({
    id: "x",
    label: "x",
    category: "props",
    w,
    h,
    base: { dx, dy },
    art: { kind: "tiles", sheet: "tileset", tiles: [] },
    solid,
  });

  it("hangs the footprint off the cell the thing stands on", () => {
    expect(footprint(prop(2, 3, 0, 2, "base"), 10, 10)).toEqual([
      { col: 10, row: 8 },
      { col: 11, row: 8 },
      { col: 10, row: 9 },
      { col: 11, row: 9 },
      { col: 10, row: 10 },
      { col: 11, row: 10 },
    ]);
  });

  it("blocks only the base row by default", () => {
    expect(solidCells(prop(2, 3, 0, 2, "base"), 10, 10)).toEqual([
      { col: 10, row: 10 },
      { col: 11, row: 10 },
    ]);
  });

  it("blocks the whole footprint where a thing is solid throughout", () => {
    expect(solidCells(prop(2, 2, 0, 1, "all"), 4, 4)).toHaveLength(4);
  });

  it("blocks nothing where a thing is walked over", () => {
    expect(solidCells(prop(2, 2, 0, 1, "none"), 4, 4)).toEqual([]);
  });
});

describe("variantAt", () => {
  it("is stable for a cell", () => {
    expect(variantAt(4, 3, 7)).toBe(variantAt(4, 3, 7));
  });

  it("stays inside the variants it is given", () => {
    for (let col = 0; col < 40; col++) {
      for (let row = 0; row < 40; row++) {
        const v = variantAt(4, col, row);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(4);
      }
    }
  });

  it("keeps the plain tile in the majority", () => {
    let plain = 0;
    for (let col = 0; col < 60; col++) for (let row = 0; row < 60; row++) if (variantAt(4, col, row) === 0) plain++;
    expect(plain / 3600).toBeGreaterThan(0.6);
  });

  it("has one variant for a brush with one tile", () => {
    expect(variantAt(1, 5, 9)).toBe(0);
  });
});
