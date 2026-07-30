import { describe, expect, it } from "vitest";
import { propById } from "../sunnyside/manifest";
import { fenceTile, isCliffFace, isLip, ringOf } from "./coast";
import { CLEARING, COAST_RINGS, FIELD, TILE } from "./field";
import {
  blockedOn,
  buildable,
  canPlace,
  DEFAULT_GROUND,
  drawOrder,
  decodeIsland,
  emptyIsland,
  encodeIsland,
  erase,
  islandFilename,
  isEmpty,
  groundAt,
  paint,
  place,
  playedGroundAt,
  propsCovering,
  VERSION,
} from "./island";

const CENTRE = Math.floor(FIELD / 2); // where the walker arrives
const MID = CENTRE + CLEARING + 2; // open ground, clear of it
const tree = propById("tree")!;
const well = propById("well")!;
const soil = propById("soil")!;
const carrot = propById("carrot")!;

describe("buildable", () => {
  it("takes the island's open ground", () => {
    expect(buildable(MID, MID)).toBe(true);
  });

  it("refuses the water's edge, which the coast owns", () => {
    expect(buildable(0, MID)).toBe(false);
    expect(buildable(MID, 0)).toBe(false);
    expect(buildable(FIELD - 1, MID)).toBe(false);
  });

  it("refuses the bank's face and the lip cut above it", () => {
    for (let row = 0; row < FIELD; row++) {
      if (isCliffFace(MID, row) || isLip(MID, row)) expect(buildable(MID, row), `row ${row}`).toBe(false);
    }
  });

  it("refuses the ring the fence stands on", () => {
    const fenceRow = Array.from({ length: FIELD }, (_, r) => r).find((r) => fenceTile(MID, r) !== null)!;
    expect(buildable(MID, fenceRow), `fence row ${fenceRow}`).toBe(false);
    expect(buildable(MID, fenceRow + 1)).toBe(true);
  });

  it("refuses the corners the coast turns on", () => {
    expect(buildable(COAST_RINGS, COAST_RINGS)).toBe(false);
    expect(buildable(FIELD - 1 - COAST_RINGS, COAST_RINGS)).toBe(false);
  });

  it("refuses the clearing the walker arrives in", () => {
    expect(buildable(CENTRE, CENTRE)).toBe(false);
    expect(buildable(CENTRE + CLEARING, CENTRE)).toBe(false);
    expect(buildable(CENTRE + CLEARING + 1, CENTRE)).toBe(true);
  });

  it("refuses anything off the field", () => {
    expect(buildable(-1, MID)).toBe(false);
    expect(buildable(MID, FIELD)).toBe(false);
  });
});

describe("painting", () => {
  it("remembers a brush on a cell", () => {
    const island = emptyIsland();
    paint(island, MID, MID, "sand");
    expect(groundAt(island, MID, MID)).toBe("sand");
  });

  it("ignores cells that cannot be built on", () => {
    const island = emptyIsland();
    paint(island, 0, 0, "sand");
    expect(groundAt(island, 0, 0)).toBeNull();
  });

  it("plays unpainted ground as grass, so a half-built island is walkable", () => {
    const island = emptyIsland();
    expect(groundAt(island, MID, MID)).toBeNull();
    expect(playedGroundAt(island, MID, MID)).toBe(DEFAULT_GROUND);
  });
});

describe("standing things up", () => {
  it("puts a thing down and finds it again by any cell it covers", () => {
    const island = emptyIsland();
    expect(place(island, tree, MID, MID)).toBe(true);
    expect(propsCovering(island, MID, MID)).toHaveLength(1);
    expect(propsCovering(island, MID, MID - 1), "the crown above its trunk").toHaveLength(1);
  });

  it("will not stand one thing inside another", () => {
    const island = emptyIsland();
    place(island, tree, MID, MID);
    expect(canPlace(island, tree, MID, MID)).toBe(false);
    expect(canPlace(island, tree, MID, MID - 1), "overlapping its crown").toBe(false);
    expect(canPlace(island, tree, MID + 1, MID)).toBe(true);
  });

  it("will not stand a thing half off the island", () => {
    const island = emptyIsland();
    expect(canPlace(island, well, FIELD - 2, MID)).toBe(false);
    expect(place(island, well, FIELD - 2, MID)).toBe(false);
  });

  it("rubs out the thing on a cell, latest first", () => {
    const island = emptyIsland();
    place(island, tree, MID, MID);
    expect(erase(island, MID, MID)).toBe(true);
    expect(island.props).toHaveLength(0);
    expect(erase(island, MID, MID)).toBe(false);
  });

  it("plants a carrot in dug soil, since one lies flat and the other stands", () => {
    const island = emptyIsland();
    expect(place(island, soil, MID, MID)).toBe(true);
    expect(place(island, carrot, MID, MID)).toBe(true);
    expect(propsCovering(island, MID, MID)).toHaveLength(2);
  });

  it("will not stack two flat things, or two standing ones", () => {
    const island = emptyIsland();
    place(island, soil, MID, MID);
    expect(canPlace(island, soil, MID, MID)).toBe(false);
    place(island, carrot, MID, MID);
    expect(canPlace(island, carrot, MID, MID)).toBe(false);
  });

  it("rubs out the carrot before the soil it is planted in", () => {
    const island = emptyIsland();
    place(island, soil, MID, MID);
    place(island, carrot, MID, MID);
    erase(island, MID, MID);
    expect(island.props.map((p) => p.id)).toEqual(["soil"]);
    erase(island, MID, MID);
    expect(island.props).toHaveLength(0);
  });

  it("draws what lies flat before what stands on it", () => {
    const island = emptyIsland();
    place(island, carrot, MID, MID);
    place(island, soil, MID, MID);
    expect(drawOrder(island).map((p) => p.id)).toEqual(["soil", "carrot"]);
  });

  it("knows an untouched island from a built one", () => {
    const island = emptyIsland();
    expect(isEmpty(island)).toBe(true);
    paint(island, MID, MID, "sand");
    expect(isEmpty(island)).toBe(false);
  });
});

describe("walking a built island", () => {
  const feetIn = (col: number, row: number): { x: number; y: number } => ({
    x: col * TILE + TILE / 2,
    y: row * TILE + TILE / 2,
  });

  it("lets the walker through open ground", () => {
    expect(blockedOn(emptyIsland())(feetIn(MID, MID))).toBe(false);
  });

  it("stops the walker at a tree's trunk but not under its crown", () => {
    const island = emptyIsland();
    place(island, tree, MID, MID);
    const blocked = blockedOn(island);
    expect(blocked(feetIn(MID, MID))).toBe(true);
    expect(blocked(feetIn(MID, MID - 1)), "walking behind the crown").toBe(false);
  });

  it("stops the walker at every cell of something solid throughout", () => {
    const island = emptyIsland();
    place(island, well, MID, MID);
    const blocked = blockedOn(island);
    expect(blocked(feetIn(MID, MID))).toBe(true);
    expect(blocked(feetIn(MID, MID - 1))).toBe(true);
  });

  it("stops the walker at painted water", () => {
    const island = emptyIsland();
    paint(island, MID, MID, "river");
    expect(blockedOn(island)(feetIn(MID, MID))).toBe(true);
  });
});

describe("files", () => {
  const built = (): ReturnType<typeof emptyIsland> => {
    const island = emptyIsland();
    paint(island, MID, MID, "sand");
    paint(island, MID + 1, MID, "path");
    place(island, tree, MID + 3, MID);
    place(island, well, MID - 3, MID);
    return island;
  };

  it("comes back the same island it went out as", () => {
    const island = built();
    const back = decodeIsland(encodeIsland(island));
    expect(back.ground).toEqual(island.ground);
    expect(back.props).toEqual(island.props);
  });

  it("records the commit that wrote it", () => {
    expect(JSON.parse(encodeIsland(emptyIsland())).writtenBy).toBe(__BUILD_COMMIT__);
  });

  it("refuses a file that is not an island", () => {
    expect(() => decodeIsland("not json")).toThrow();
    expect(() => decodeIsland(JSON.stringify({ name: "something-else", version: VERSION }))).toThrow(/editor/);
  });

  it("refuses an island from another version, by name rather than half-reading it", () => {
    const file = JSON.parse(encodeIsland(built()));
    file.version = VERSION + 1;
    expect(() => decodeIsland(JSON.stringify(file))).toThrow(/version/);
  });

  it("refuses an island of another size", () => {
    const file = JSON.parse(encodeIsland(built()));
    file.size = FIELD + 1;
    expect(() => decodeIsland(JSON.stringify(file))).toThrow(/across/);
  });

  it("refuses a damaged ground array rather than reading half of it", () => {
    const file = JSON.parse(encodeIsland(built()));
    file.ground = file.ground.slice(0, 10);
    expect(() => decodeIsland(JSON.stringify(file))).toThrow(/damaged/);
  });

  it("drops brushes and things it no longer knows, so a map outlives a rename", () => {
    const file = JSON.parse(encodeIsland(built()));
    file.ground[MID * FIELD + MID] = "brush-that-was-renamed";
    file.props.push({ id: "thing-that-was-renamed", col: MID, row: MID + 5 });
    const back = decodeIsland(JSON.stringify(file));
    expect(groundAt(back, MID, MID)).toBeNull();
    expect(back.props.map((p) => p.id)).not.toContain("thing-that-was-renamed");
    expect(back.props).toHaveLength(2);
  });

  it("ignores anything painted where it could not have been painted", () => {
    const file = JSON.parse(encodeIsland(emptyIsland()));
    file.ground[0] = "sand"; // the water's edge
    expect(groundAt(decodeIsland(JSON.stringify(file)), 0, 0)).toBeNull();
  });

  it("names the file for the local day, not tomorrow's UTC one", () => {
    expect(islandFilename(new Date(2026, 6, 31, 23, 30))).toBe("island-2026-07-31.json");
  });
});

describe("the field the island sits in", () => {
  it("has a coast ring the editor never paints", () => {
    expect(ringOf(0, 0)).toBe(0);
    expect(buildable(0, 0)).toBe(false);
  });
});
