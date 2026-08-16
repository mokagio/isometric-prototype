import { describe, expect, it } from "vitest";
import { bannerTile, floorTile, wallPieces, type FloorAt } from "./dungeonTiles";

/** A tiny map from rows of "." (floor) and "#" (rock). */
const mapOf = (rows: string[]): FloorAt => {
  return (col, row) => rows[row]?.[col] === ".";
};

const names = (pieces: ReturnType<typeof wallPieces>): string[] => pieces.map((p) => p.tile);

describe("wallPieces", () => {
  it("gives a floor cell nothing to draw", () => {
    const isFloor = mapOf(["...", "...", "..."]);
    expect(wallPieces(isFloor, 1, 1)).toEqual([]);
  });

  it("draws a head-on wall as a brick face plus the lip one cell up", () => {
    const isFloor = mapOf(["###", "###", "..."]);
    expect(wallPieces(isFloor, 1, 1)).toEqual([
      { tile: "wall_mid", dx: 0, dy: 0, face: true },
      { tile: "wall_top_mid", dx: 0, dy: -16 },
    ]);
  });

  it("marks only the head-on face, so banners hang on nothing else", () => {
    const headOn = mapOf(["###", "###", "..."]);
    expect(wallPieces(headOn, 1, 1).filter((p) => p.face)).toHaveLength(1);
    const behind = mapOf(["...", "###", "###"]);
    expect(wallPieces(behind, 1, 1).some((p) => p.face)).toBe(false);
    const side = mapOf(["###", "#.#", "###"]);
    expect(wallPieces(side, 0, 1).some((p) => p.face)).toBe(false);
  });

  it("lights the face's edge where the wall run ends against floor", () => {
    const isFloor = mapOf(["####", ".##.", "...."]);
    expect(names(wallPieces(isFloor, 1, 1))).toContain("wall_edge_left");
    expect(names(wallPieces(isFloor, 2, 1))).toContain("wall_edge_right");
  });

  it("does not draw a side strip over a face that already carries one", () => {
    const isFloor = mapOf(["####", ".##.", "...."]);
    expect(names(wallPieces(isFloor, 1, 1))).not.toContain("wall_edge_mid_left");
    expect(names(wallPieces(isFloor, 2, 1))).not.toContain("wall_edge_mid_right");
  });

  it("caps the lip on whichever side the floor below stops", () => {
    const isFloor = mapOf(["####", "####", "#..#"]);
    expect(names(wallPieces(isFloor, 1, 1))).toContain("wall_top_left");
    expect(names(wallPieces(isFloor, 2, 1))).toContain("wall_top_right");
  });

  it("turns the lit edge of a side wall toward the room", () => {
    const isFloor = mapOf(["###", "#.#", "###"]);
    expect(wallPieces(isFloor, 0, 1)).toEqual([{ tile: "wall_edge_mid_right", dx: 0, dy: 0 }]);
    expect(wallPieces(isFloor, 2, 1)).toEqual([{ tile: "wall_edge_mid_left", dx: 0, dy: 0 }]);
  });

  it("gives a side wall its edge alone, with no face to look at head-on", () => {
    // A wall running north-south is seen along its length, so the brick face
    // that `wall_edge_*` carries would be a face turned away from the camera.
    const isFloor = mapOf(["#.#", "#.#", "#.#"]);
    for (const row of [0, 1, 2]) {
      expect(names(wallPieces(isFloor, 0, row))).toEqual(["wall_edge_mid_right"]);
      expect(names(wallPieces(isFloor, 2, row))).toEqual(["wall_edge_mid_left"]);
    }
  });

  it("lights both sides of a pillar with floor either side", () => {
    const isFloor = mapOf(["###", ".#.", "###"]);
    expect(names(wallPieces(isFloor, 1, 1))).toEqual(["wall_edge_mid_left", "wall_edge_mid_right"]);
  });

  it("caps a wall seen from behind that also has floor beside it", () => {
    // The lip and the strip are separate sides of the same cell; drawing only
    // the one the first matching rule picked left the other open to the void.
    const isFloor = mapOf(["...", "##.", "###"]);
    expect(names(wallPieces(isFloor, 1, 1))).toEqual(["wall_mid", "wall_top_mid", "wall_edge_mid_right"]);
    const mirrored = mapOf(["...", ".##", "###"]);
    expect(names(wallPieces(mirrored, 1, 1))).toEqual(["wall_mid", "wall_top_mid", "wall_edge_mid_left"]);
  });

  it("borders the tip of a rock finger on all three open sides", () => {
    const isFloor = mapOf([".....", "..#..", "..#.."]);
    expect(names(wallPieces(isFloor, 2, 1))).toEqual([
      "wall_mid",
      "wall_top_mid",
      "wall_edge_mid_left",
      "wall_edge_mid_right",
    ]);
  });

  it("builds a wall seen from behind as a full cell, capped by its lip", () => {
    // The far side of a room is as thick as the near side; drawing the lip on
    // its own left the floor trailing off into a hairline.
    const isFloor = mapOf(["...", "###", "###"]);
    expect(wallPieces(isFloor, 1, 1)).toEqual([
      { tile: "wall_mid", dx: 0, dy: 0 },
      { tile: "wall_top_mid", dx: 0, dy: -12 },
    ]);
  });

  it("leaves rock with no floor beside it blank", () => {
    const isFloor = mapOf(["###", "###", "###"]);
    expect(wallPieces(isFloor, 1, 1)).toEqual([]);
  });

  describe("the cell off a room's corner", () => {
    // It faces no floor at all, so every rule above passes it over — and it is
    // where the run down the side and the run along the top would meet, so
    // leaving it blank was a notch at every corner of every room.

    it("caps the top of the run at a top corner", () => {
      expect(wallPieces(mapOf(["###", "###", "##."]), 1, 1)).toEqual([
        { tile: "wall_outer_top_left", dx: 0, dy: 0 },
      ]);
      expect(wallPieces(mapOf(["###", "###", ".##"]), 1, 1)).toEqual([
        { tile: "wall_outer_top_right", dx: 0, dy: 0 },
      ]);
    });

    it("caps a top corner in the column its side run comes down", () => {
      // The cap and the strip under it are the same piece of wall, so a corner
      // whose nub sat in the other column would leave the run hanging.
      const corner = wallPieces(mapOf(["###", "###", "##."]), 1, 1);
      const sideBelow = wallPieces(mapOf(["###", "##.", "##."]), 1, 1);
      expect(corner[0]?.tile).toBe("wall_outer_top_left");
      expect(sideBelow[0]?.tile).toBe("wall_edge_mid_right");
    });

    it("caps a bottom corner the way the far wall is capped", () => {
      // Same shape as the `north` branch — a body filling the cell, a cap at the
      // top of it — in the corner's own pieces.
      expect(wallPieces(mapOf(["##.", "###", "###"]), 1, 1)).toEqual([
        { tile: "wall_outer_front_left", dx: 0, dy: 0 },
        { tile: "wall_outer_top_left", dx: 0, dy: -12 },
      ]);
      expect(wallPieces(mapOf([".##", "###", "###"]), 1, 1)).toEqual([
        { tile: "wall_outer_front_right", dx: 0, dy: 0 },
        { tile: "wall_outer_top_right", dx: 0, dy: -12 },
      ]);
    });

    it("sits a bottom corner's cap at the same height as the far wall's lip", () => {
      const farWall = wallPieces(mapOf(["...", "###", "###"]), 1, 1);
      const corner = wallPieces(mapOf(["##.", "###", "###"]), 1, 1);
      expect(corner[1]?.dy).toBe(farWall[1]?.dy);
    });

    it("stays out of it where floor lies off both corners at once", () => {
      // Nothing to turn: the cell is a pinch between two rooms, not a corner.
      expect(wallPieces(mapOf(["###", "###", ".#."]), 1, 1)).toEqual([]);
      expect(wallPieces(mapOf([".#.", "###", "###"]), 1, 1)).toEqual([]);
    });

    it("leaves a corner alone once a side of it faces floor", () => {
      // Floor to the east makes it an ordinary side wall, corner or not.
      expect(names(wallPieces(mapOf(["###", "##.", "##."]), 1, 1))).toEqual(["wall_edge_mid_right"]);
    });
  });
});

describe("floorTile", () => {
  it("is stable for a cell and varies across the map", () => {
    expect(floorTile(3, 4, 99)).toBe(floorTile(3, 4, 99));
    const seen = new Set<string>();
    for (let row = 0; row < 30; row++) {
      for (let col = 0; col < 30; col++) seen.add(floorTile(col, row, 99));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("re-rolls with the seed, so a new dungeon does not repeat the last one's floor", () => {
    const a = Array.from({ length: 40 }, (_, i) => floorTile(i, 0, 1));
    const b = Array.from({ length: 40 }, (_, i) => floorTile(i, 0, 2));
    expect(a).not.toEqual(b);
  });
});

describe("bannerTile", () => {
  it("hangs on a small share of walls, and always the same ones", () => {
    let hung = 0;
    for (let col = 0; col < 1000; col++) if (bannerTile(col, 0, 5)) hung++;
    expect(hung).toBeGreaterThan(30);
    expect(hung).toBeLessThan(120);
    expect(bannerTile(7, 3, 5)).toBe(bannerTile(7, 3, 5));
  });
});
