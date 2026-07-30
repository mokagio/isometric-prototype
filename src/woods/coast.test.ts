import { describe, expect, it } from "vitest";
import {
  facesSouth,
  frameOf,
  isCliffFace,
  isLip,
  isWater,
  ringOf,
  SEA_BLOCK,
  seaTile,
  shoreTile,
  SPARKLE_FRAMES,
  sparkleAt,
} from "./coast";
import { CLIFF_RINGS, COAST_RINGS, FIELD } from "./field";

const MID = Math.floor(FIELD / 2);
const LAST = FIELD - 1;

describe("ringOf", () => {
  it("is zero along the coast and grows inland", () => {
    expect(ringOf(0, MID)).toBe(0);
    expect(ringOf(LAST, MID)).toBe(0);
    expect(ringOf(MID, 0)).toBe(0);
    expect(ringOf(1, MID)).toBe(1);
    expect(ringOf(MID, MID)).toBe(MID - 1); // the middle of an even field is a cell off centre
  });

  it("is negative out at sea", () => {
    expect(ringOf(-1, MID)).toBe(-1);
    expect(ringOf(FIELD, MID)).toBe(-1);
    expect(ringOf(MID, -3)).toBe(-1);
  });
});

describe("shoreTile", () => {
  it("draws the water's edge only on the outermost cells", () => {
    expect(shoreTile(MID, 0)).not.toBeNull();
    expect(shoreTile(MID, 1)).toBeNull();
    expect(shoreTile(MID, MID)).toBeNull();
    expect(shoreTile(-1, MID)).toBeNull();
  });

  it("puts the brown bank on the south shore and the grass bank on the north", () => {
    // The ring is cut for a lake, so its land-above edge (row 0, the brown bank)
    // is our south shore, and its land-below edge (row 2, grass) is our north.
    expect(shoreTile(MID, LAST)).toEqual({ col: 1, row: 0 });
    expect(shoreTile(MID, 0)).toEqual({ col: 1, row: 2 });
  });

  it("takes the side edges from the middle row", () => {
    expect(shoreTile(0, MID)).toEqual({ col: 2, row: 1 });
    expect(shoreTile(LAST, MID)).toEqual({ col: 0, row: 1 });
  });

  it("tapers the bank round the two south corners, with a tile each", () => {
    const sw = shoreTile(0, LAST);
    const se = shoreTile(LAST, LAST);
    expect(sw).not.toBeNull();
    expect(se).not.toBeNull();
    expect(sw).not.toEqual(se);
  });

  it("leaves the north corners bare, since there is no bank to taper", () => {
    // Those cells touch the island only at a point: a corner tile there is a lone
    // wedge of land out in the water.
    expect(shoreTile(0, 0)).toBeNull();
    expect(shoreTile(LAST, 0)).toBeNull();
  });
});

describe("facesSouth", () => {
  it("is true only where the nearest edge is the southern one", () => {
    expect(facesSouth(MID, LAST)).toBe(true);
    expect(facesSouth(MID, LAST - 1)).toBe(true);
    expect(facesSouth(MID, 0)).toBe(false);
    expect(facesSouth(MID, 5)).toBe(false); // nearest edge is the north one
    expect(facesSouth(0, MID)).toBe(false); // nearest edge is the west one
  });
});

describe("isCliffFace", () => {
  it("draws the wall above the south shore, but never on the shore cell itself", () => {
    // The shore tile is transparent below its foam, so a face behind it would
    // show through as brown water.
    expect(isCliffFace(MID, LAST)).toBe(false);
    for (let ring = COAST_RINGS; ring < COAST_RINGS + CLIFF_RINGS; ring++) {
      expect(isCliffFace(MID, LAST - ring), `ring ${ring}`).toBe(true);
    }
    expect(isCliffFace(MID, LAST - COAST_RINGS - CLIFF_RINGS)).toBe(false);
  });

  it("draws no wall on the other three shores, where its face would not be seen", () => {
    expect(isCliffFace(MID, 0)).toBe(false);
    expect(isCliffFace(0, MID)).toBe(false);
    expect(isCliffFace(LAST, MID)).toBe(false);
  });
});

describe("isLip", () => {
  it("cuts the dark edge into the grass directly above the wall", () => {
    expect(isLip(MID, LAST - COAST_RINGS - CLIFF_RINGS)).toBe(true);
    expect(isLip(MID, LAST - COAST_RINGS - CLIFF_RINGS - 1)).toBe(false);
    expect(isLip(MID, LAST)).toBe(false); // that cell is the water's edge
  });

  it("leaves the other shores unmarked", () => {
    expect(isLip(MID, COAST_RINGS + CLIFF_RINGS)).toBe(false);
    expect(isLip(COAST_RINGS + CLIFF_RINGS, MID)).toBe(false);
  });
});

describe("seaTile", () => {
  it("walks the block in step with the world, so the mottle has no seams", () => {
    expect(seaTile(0, 0)).toEqual({ col: 0, row: 0 });
    expect(seaTile(5, 6)).toEqual({ col: 1, row: 2 });
    expect(seaTile(SEA_BLOCK, SEA_BLOCK)).toEqual({ col: 0, row: 0 });
  });

  it("keeps going the same way out past the field, where the coordinates go negative", () => {
    expect(seaTile(-1, -1)).toEqual({ col: SEA_BLOCK - 1, row: SEA_BLOCK - 1 });
    expect(seaTile(-SEA_BLOCK, -SEA_BLOCK)).toEqual({ col: 0, row: 0 });
    expect(seaTile(-5, -6)).toEqual({ col: 3, row: 2 });
  });
});

describe("sparkleAt", () => {
  it("never glints on land", () => {
    for (let row = 0; row < FIELD; row++) {
      for (let col = 0; col < FIELD; col++) expect(sparkleAt(col, row), `${col},${row}`).toBeNull();
    }
  });

  it("glints on some open water, and always the same water", () => {
    let glints = 0;
    let cells = 0;
    for (let row = -20; row < 0; row++) {
      for (let col = -20; col < 20; col++) {
        cells++;
        const sparkle = sparkleAt(col, row);
        if (!sparkle) continue;
        glints++;
        expect(sparkle.phase).toBeGreaterThanOrEqual(0);
        expect(sparkle.phase).toBeLessThan(1);
        expect(sparkleAt(col, row)).toEqual(sparkle);
      }
    }
    expect(glints).toBeGreaterThan(0);
    expect(glints / cells).toBeLessThan(0.15); // a glint, not a disco
  });
});

describe("frameOf", () => {
  it("holds each frame for its whole turn, then loops", () => {
    expect(frameOf(0, 0.8, SPARKLE_FRAMES)).toBe(0);
    expect(frameOf(0.79, 0.8, SPARKLE_FRAMES)).toBe(0);
    expect(frameOf(0.8, 0.8, SPARKLE_FRAMES)).toBe(1);
    expect(frameOf(0.8 * SPARKLE_FRAMES, 0.8, SPARKLE_FRAMES)).toBe(0);
  });
});

describe("isWater", () => {
  it("makes the field's outermost ring water, so the shore tiles lie on the sea", () => {
    expect(isWater(MID, 0)).toBe(true);
    expect(isWater(MID, LAST)).toBe(true);
    expect(isWater(0, MID)).toBe(true);
    expect(isWater(LAST, MID)).toBe(true);
    expect(isWater(0, 0)).toBe(true);
  });

  it("leaves everything inland dry", () => {
    expect(isWater(1, MID)).toBe(false);
    expect(isWater(MID, MID)).toBe(false);
  });
});
