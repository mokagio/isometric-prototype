import { describe, expect, it } from "vitest";
import { TILES, type TileName } from "../../tiles";
import { GROUPS, SWATCH_PX, excluded, groupOf, stillFrame, swatchFit, tilesIn } from "./groups";

const allNames = (): TileName[] => Object.keys(TILES) as TileName[];

describe("groupOf", () => {
  it("puts every tile in the sheet either under a tab or out of the palette", () => {
    const ids = new Set(GROUPS.map((g) => g.id));
    for (const name of allNames()) {
      const id = groupOf(name);
      if (id !== null) expect(ids).toContain(id);
    }
    expect(allNames().length).toBe(
      allNames().filter((n) => groupOf(n) !== null).length + excluded().length,
    );
  });

  it("offers every wall the autotiler draws with", () => {
    // If a tile `wallPieces` emits were missing, a correction could not put it back.
    for (const name of [
      "wall_mid",
      "wall_top_mid",
      "wall_top_left",
      "wall_top_right",
      "wall_edge_left",
      "wall_edge_right",
      "wall_edge_mid_left",
      "wall_edge_mid_right",
    ] as const) {
      expect(groupOf(name)).toBe("walls");
    }
  });

  it("offers the corner pieces the autotiler has never used", () => {
    for (const name of [
      "wall_edge_bottom_left",
      "wall_edge_bottom_right",
      "wall_edge_top_left",
      "wall_edge_top_right",
      "wall_outer_top_left",
      "wall_outer_mid_left",
      "wall_outer_front_left",
      "wall_edge_tshape_left",
    ] as const) {
      expect(groupOf(name)).toBe("walls");
    }
  });

  it("hangs banners and fountains in décor rather than among the geometry", () => {
    expect(groupOf("wall_banner_red")).toBe("decor");
    expect(groupOf("wall_fountain_top_1")).toBe("decor");
    expect(groupOf("wall_goo")).toBe("decor");
    expect(groupOf("wall_hole_1")).toBe("decor");
  });

  it("leaves the characters, their weapons and the heart pips out", () => {
    for (const name of ["wizzard_f_idle_anim_f0", "skelet_idle_anim_f0", "weapon_golden_sword", "ui_heart_full"]) {
      expect(groupOf(name)).toBeNull();
    }
  });

  it("keeps no character in the palette at all", () => {
    const offered = allNames().filter((n) => groupOf(n) !== null);
    expect(offered.filter((n) => n.includes("_idle_") || n.includes("_run_"))).toEqual([]);
  });
});

describe("stillFrame", () => {
  it("offers the first frame of an animation and not the rest", () => {
    expect(stillFrame("coin_anim_f0")).toBe(true);
    expect(stillFrame("coin_anim_f1")).toBe(false);
    expect(stillFrame("bomb_f0")).toBe(true);
    expect(stillFrame("bomb_f2")).toBe(false);
  });

  it("leaves a name that merely ends in a number alone", () => {
    expect(stillFrame("floor_1")).toBe(true);
    expect(stillFrame("wall_fountain_top_2")).toBe(true);
    expect(stillFrame("wall_hole_2")).toBe(true);
  });
});

describe("tilesIn", () => {
  it("gives every group something to show", () => {
    for (const group of GROUPS) expect(tilesIn(group.id).length).toBeGreaterThan(0);
  });

  it("orders a group the way the sheet is drawn", () => {
    const walls = tilesIn("walls");
    for (let i = 1; i < walls.length; i++) {
      const [ax, ay] = TILES[walls[i - 1]!];
      const [bx, by] = TILES[walls[i]!];
      expect(ay < by || (ay === by && ax <= bx)).toBe(true);
    }
  });

  it("shows a fountain once, not once per frame", () => {
    const decor = tilesIn("decor");
    expect(decor).toContain("wall_fountain_basin_blue_anim_f0");
    expect(decor).not.toContain("wall_fountain_basin_blue_anim_f1");
  });

  it("puts a tile under one tab only", () => {
    const seen = new Set<string>();
    for (const group of GROUPS) {
      for (const name of tilesIn(group.id)) {
        expect(seen.has(name)).toBe(false);
        seen.add(name);
      }
    }
  });
});

describe("swatchFit", () => {
  it("blows a small tile up by a whole number of pixels", () => {
    const fit = swatchFit(16, 16, 44);
    expect(fit.zoom).toBe(2);
    expect(fit).toEqual({ zoom: 2, x: 6, y: 6 });
  });

  it("centres a tile that is taller than it is wide", () => {
    const fit = swatchFit(16, 32, 44);
    expect(fit.zoom).toBe(1);
    expect(fit.x).toBe(14);
    expect(fit.y).toBe(6);
  });

  it("shrinks a tile too big for the box rather than cropping it", () => {
    const fit = swatchFit(32, 48, 44);
    expect(fit.zoom).toBeCloseTo(44 / 48);
    expect(fit.y).toBeCloseTo(0);
  });

  it("never shrinks a tile that fits", () => {
    for (const name of Object.keys(TILES) as TileName[]) {
      const [, , w, h] = TILES[name];
      const fit = swatchFit(w, h, SWATCH_PX);
      if (Math.max(w, h) <= SWATCH_PX) expect(Number.isInteger(fit.zoom)).toBe(true);
      expect(w * fit.zoom).toBeLessThanOrEqual(SWATCH_PX + 0.001);
      expect(h * fit.zoom).toBeLessThanOrEqual(SWATCH_PX + 0.001);
    }
  });
});
