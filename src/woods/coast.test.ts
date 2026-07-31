import { describe, expect, it } from "vitest";
import {
  chamferTile,
  facesSouth,
  fenceTile,
  frameOf,
  isCliffFace,
  isLip,
  isWater,
  lipCornerTile,
  ringOf,
  SEA_BLOCK,
  seaTile,
  shoreTile,
  SPARKLE_FRAMES,
  sparkleAt,
} from "./coast";
import { FENCE_RING, FIELD } from "./field";
import { isLand, neighbours } from "./shape";

const MID = Math.floor(FIELD / 2);

/** Every cell of the field, for the rules that have to hold everywhere. */
function everyCell(visit: (col: number, row: number) => void): void {
  for (let row = 0; row < FIELD; row++) {
    for (let col = 0; col < FIELD; col++) visit(col, row);
  }
}

describe("isWater", () => {
  it("is the sea wherever the island is not", () => {
    everyCell((col, row) => expect(isWater(col, row)).toBe(!isLand(col, row)));
  });

  it("never floods the fenced rectangle", () => {
    for (let row = FENCE_RING; row <= FIELD - 1 - FENCE_RING; row++) {
      for (let col = FENCE_RING; col <= FIELD - 1 - FENCE_RING; col++) {
        expect(isWater(col, row), `${col},${row}`).toBe(false);
      }
    }
  });
});

describe("shoreTile", () => {
  it("draws nothing on the island itself", () => {
    everyCell((col, row) => {
      if (isLand(col, row)) expect(shoreTile(col, row), `${col},${row}`).toBeNull();
    });
  });

  it("draws the water's edge wherever the sea meets the island", () => {
    everyCell((col, row) => {
      if (isLand(col, row)) return;
      const { north, east, south, west } = neighbours(col, row);
      expect(shoreTile(col, row) !== null, `${col},${row}`).toBe(north || east || south || west);
    });
  });

  it("leaves open sea alone, including water touching the island only on a diagonal", () => {
    let diagonals = 0;
    everyCell((col, row) => {
      if (isLand(col, row)) return;
      const { north, east, south, west } = neighbours(col, row);
      if (north || east || south || west) return;
      if (isLand(col - 1, row - 1) || isLand(col + 1, row - 1) || isLand(col - 1, row + 1) || isLand(col + 1, row + 1)) {
        diagonals++;
      }
      expect(shoreTile(col, row), `${col},${row}`).toBeNull();
    });
    expect(diagonals).toBeGreaterThan(0); // a wandering coast makes these
  });

  it("picks the tile whose land lies where the island actually is", () => {
    // The ring's tiles are named for the side their land is on, so the rule is
    // simply that the name matches the neighbourhood.
    const LAND_ABOVE = { col: 1, row: 0 };
    const LAND_BELOW = { col: 1, row: 2 };
    const LAND_LEFT = { col: 0, row: 1 };
    const LAND_RIGHT = { col: 2, row: 1 };
    everyCell((col, row) => {
      if (isLand(col, row)) return;
      const { north, east, south, west } = neighbours(col, row);
      if ([north, east, south, west].filter(Boolean).length !== 1) return;
      const tile = shoreTile(col, row);
      if (north) expect(tile, `${col},${row}`).toEqual(LAND_ABOVE);
      if (south) expect(tile, `${col},${row}`).toEqual(LAND_BELOW);
      if (west) expect(tile, `${col},${row}`).toEqual(LAND_LEFT);
      if (east) expect(tile, `${col},${row}`).toEqual(LAND_RIGHT);
    });
  });
});

describe("chamferTile", () => {
  it("turns a headland — land with the sea on two sides at once", () => {
    everyCell((col, row) => {
      if (!chamferTile(col, row)) return;
      const { north, east, south, west } = neighbours(col, row);
      expect(isLand(col, row), `${col},${row}`).toBe(true);
      const twoSides = (!north || !south) && (!east || !west);
      expect(twoSides, `${col},${row}`).toBe(true);
    });
  });

  it("never puts a wedge of land out on the water", () => {
    everyCell((col, row) => {
      if (!isLand(col, row)) expect(chamferTile(col, row), `${col},${row}`).toBeNull();
    });
  });

  it("finds the headlands a wandering coast makes", () => {
    let wedges = 0;
    everyCell((col, row) => {
      if (chamferTile(col, row)) wedges++;
    });
    expect(wedges).toBeGreaterThan(3); // more than just the four extreme corners
  });
});

describe("isCliffFace", () => {
  it("is drawn on land whose southern neighbour is water, and nowhere else", () => {
    everyCell((col, row) => {
      if (!isCliffFace(col, row)) return;
      expect(isLand(col, row), `${col},${row}`).toBe(true);
      expect(isLand(col, row + 1), `${col},${row}`).toBe(false);
    });
  });

  it("leaves the headlands to their wedges", () => {
    everyCell((col, row) => {
      if (chamferTile(col, row)) expect(isCliffFace(col, row), `${col},${row}`).toBe(false);
    });
  });

  it("runs the length of the south shore", () => {
    let faces = 0;
    everyCell((col, row) => {
      if (isCliffFace(col, row)) faces++;
    });
    expect(faces).toBeGreaterThan(FIELD / 2);
  });
});

describe("facesSouth", () => {
  it("marks land with the sea below it", () => {
    everyCell((col, row) => {
      expect(facesSouth(col, row), `${col},${row}`).toBe(isLand(col, row) && !isLand(col, row + 1));
    });
  });
});

describe("isLip", () => {
  it("cuts the dark edge into the grass directly above a drop", () => {
    everyCell((col, row) => {
      expect(isLip(col, row), `${col},${row}`).toBe(isLand(col, row) && isCliffFace(col, row + 1));
    });
  });

  it("curves where the drop below runs out, and runs straight elsewhere", () => {
    let curved = 0;
    let straight = 0;
    everyCell((col, row) => {
      if (!isLip(col, row)) return;
      if (lipCornerTile(col, row)) curved++;
      else straight++;
    });
    expect(curved).toBeGreaterThan(0);
    expect(straight).toBeGreaterThan(0);
  });
});

describe("fenceTile", () => {
  it("rings the island as a plain rectangle, whatever the shore does", () => {
    everyCell((col, row) => {
      expect(fenceTile(col, row) !== null, `${col},${row}`).toBe(ringOf(col, row) === FENCE_RING);
    });
  });

  it("stands every post on dry land", () => {
    everyCell((col, row) => {
      if (fenceTile(col, row)) expect(isLand(col, row), `${col},${row}`).toBe(true);
    });
  });

  it("lays rails across the top and bottom, down the sides, and turns each corner", () => {
    const first = FENCE_RING;
    const last = FIELD - 1 - FENCE_RING;
    const north = fenceTile(MID, first)!;
    const west = fenceTile(first, MID)!;
    expect(north.tile).toEqual(fenceTile(MID, last)!.tile);
    expect(west.tile).toEqual(fenceTile(last, MID)!.tile);
    expect(west.tile).not.toEqual(north.tile);
    const nw = fenceTile(first, first)!;
    const sw = fenceTile(first, last)!;
    expect(nw.tile).toEqual(sw.tile); // the same corner post, upended below
    expect([nw.flipV, sw.flipV]).toEqual([false, true]);
    expect(nw.tile).not.toEqual(north.tile);
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
    expect(seaTile(-5, -6)).toEqual({ col: 3, row: 2 });
  });
});

describe("sparkleAt", () => {
  it("never glints on the island", () => {
    everyCell((col, row) => {
      if (isLand(col, row)) expect(sparkleAt(col, row), `${col},${row}`).toBeNull();
    });
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
