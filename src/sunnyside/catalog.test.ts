import { describe, expect, it } from "vitest";
import { catalogGroups, footprintLabel, matches } from "./catalog";
import { BRUSHES, CATEGORIES, PROPS, propById } from "./manifest";

const groups = catalogGroups();
const find = (id: string) => {
  const group = groups.find((g) => g.assets.some((a) => a.id === id))!;
  return { group, asset: group.assets.find((a) => a.id === id)! };
};

describe("catalogGroups", () => {
  it("shows every asset exactly once", () => {
    const shown = groups.flatMap((g) => g.assets.map((a) => a.id));
    expect(shown).toHaveLength(BRUSHES.length + PROPS.length);
    expect(new Set(shown).size).toBe(shown.length);
  });

  it("keeps the palette's order, so the two read the same", () => {
    expect(groups.map((g) => g.category.id)).toEqual(CATEGORIES.map((c) => c.id));
  });

  it("puts every asset under its own category", () => {
    for (const group of groups) {
      for (const asset of group.assets) expect(asset.category, asset.id).toBe(group.category.id);
    }
  });
});

describe("matches", () => {
  const { asset, group } = find("cottage-red");

  it("matches everything on an empty search", () => {
    expect(matches(asset, group.category, "   ")).toBe(true);
  });

  it("finds a thing by what it is called", () => {
    expect(matches(asset, group.category, "cottage")).toBe(true);
    expect(matches(asset, group.category, "COTTAGE")).toBe(true);
  });

  it("finds a thing by what it is called in code", () => {
    expect(matches(asset, group.category, "cottage-red")).toBe(true);
  });

  it("finds a thing by the group it is in", () => {
    expect(matches(asset, group.category, "houses")).toBe(true);
  });

  it("says no to what it does not have", () => {
    expect(matches(asset, group.category, "helicopter")).toBe(false);
  });
});

describe("footprintLabel", () => {
  it("says how big a thing is on the ground", () => {
    expect(footprintLabel(propById("well")!)).toBe("2×2");
  });

  it("leaves the one-cell things unlabelled", () => {
    expect(footprintLabel(propById("rock")!)).toBeNull();
  });

  it("leaves ground unlabelled, since it is always one cell", () => {
    expect(footprintLabel(BRUSHES[0]!)).toBeNull();
  });
});
