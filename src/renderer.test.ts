import { describe, expect, it } from "vitest";
import { render, type Entity } from "./renderer";
import type { Tileset } from "./tileset";
import type { World } from "./world";

const CELL_PX = 48;

// Each cell's surface tile is its own [col, row], so the source rect handed to
// `drawImage` identifies which cell was painted.
function worldOf(cols: number, rows: number): World {
  const cells = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({ height: 0, surface: [col, row] as const, isWater: false })),
  );
  return { cols, rows, cells, body: [0, 1] } as unknown as World;
}

const TILESET = {
  image: {} as HTMLImageElement,
  rect: (col: number, row: number) => [col * CELL_PX, row * CELL_PX, CELL_PX, CELL_PX],
} as unknown as Tileset;

/**
 * Renders a 4x4 world and returns the paint order as `tile:col,row` and
 * `entity:<name>` markers.
 */
function paintOrder(entities: Array<{ name: string; col: number; row: number }>): string[] {
  const log: string[] = [];
  const ctx = {
    imageSmoothingEnabled: false,
    clearRect() {},
    drawImage(_img: unknown, sx: number, sy: number) {
      log.push(`tile:${sx / CELL_PX},${sy / CELL_PX}`);
    },
  } as unknown as CanvasRenderingContext2D;

  const list: Entity[] = entities.map((e) => ({
    col: e.col,
    row: e.row,
    draw: () => log.push(`entity:${e.name}`),
  }));

  // Origin far enough down-screen that the whole 4x4 grid clears the cull test.
  render(ctx, TILESET, worldOf(4, 4), { x: 400, y: 100 }, 2000, 2000, list);
  return log;
}

describe("render entity interleaving", () => {
  it("draws an entity straight after its own cell", () => {
    const log = paintOrder([{ name: "hero", col: 1, row: 1 }]);
    expect(log.indexOf("entity:hero")).toBe(log.indexOf("tile:1,1") + 1);
  });

  it("draws an entity before any cell further forward", () => {
    const log = paintOrder([{ name: "hero", col: 1, row: 1 }]);
    expect(log.indexOf("entity:hero")).toBeLessThan(log.indexOf("tile:2,1"));
    expect(log.indexOf("entity:hero")).toBeLessThan(log.indexOf("tile:0,2"));
  });

  it("sorts entities by grid position, not by the order they were passed", () => {
    // Passed back-to-front on purpose: a list that painted in array order would
    // let the far monster draw over the near one.
    const log = paintOrder([
      { name: "far", col: 3, row: 3 },
      { name: "near", col: 0, row: 0 },
    ]);
    expect(log.indexOf("entity:near")).toBeLessThan(log.indexOf("entity:far"));
  });

  it("draws every entity sharing a cell", () => {
    const log = paintOrder([
      { name: "a", col: 2, row: 2 },
      { name: "b", col: 2, row: 2 },
    ]);
    expect(log.filter((l) => l.startsWith("entity:"))).toEqual(["entity:a", "entity:b"]);
  });

  it("rounds a fractional position to the cell it stands on", () => {
    const log = paintOrder([{ name: "hero", col: 1.4, row: 2.6 }]);
    expect(log.indexOf("entity:hero")).toBe(log.indexOf("tile:1,3") + 1);
  });

  it("skips an entity standing off the map", () => {
    const log = paintOrder([{ name: "ghost", col: 99, row: 99 }]);
    expect(log).not.toContain("entity:ghost");
  });

  it("paints the terrain when given no entities at all", () => {
    const log = paintOrder([]);
    expect(log).toHaveLength(16);
    expect(log.every((l) => l.startsWith("tile:"))).toBe(true);
  });
});

describe("render terrain order", () => {
  it("paints back-to-front so nearer columns land last", () => {
    const log = paintOrder([]);
    expect(log.indexOf("tile:0,0")).toBeLessThan(log.indexOf("tile:3,3"));
    expect(log.indexOf("tile:0,1")).toBeLessThan(log.indexOf("tile:0,2"));
  });

  it("stacks a raised column bottom cube first, cap last", () => {
    const log: string[] = [];
    const ctx = {
      imageSmoothingEnabled: false,
      clearRect() {},
      drawImage(_img: unknown, sx: number, sy: number) {
        log.push(`${sx / CELL_PX},${sy / CELL_PX}`);
      },
    } as unknown as CanvasRenderingContext2D;

    const world = worldOf(1, 1);
    world.cells[0]![0]!.height = 2;
    render(ctx, TILESET, world, { x: 400, y: 100 }, 2000, 2000);

    // Two body cubes from `world.body`, then the cell's own surface on top.
    expect(log).toEqual(["0,1", "0,1", "0,0"]);
  });
});
