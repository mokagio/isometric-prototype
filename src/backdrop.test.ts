import { describe, expect, it } from "vitest";
import { backdropGrid } from "./backdrop";
import { unproject } from "./iso";

// Phones held either way, a laptop, a wide desktop, and a silly-thin window.
const SCREENS: Array<[width: number, height: number]> = [
  [320, 480],
  [390, 844],
  [844, 390],
  [1440, 900],
  [2560, 1440],
  [200, 1200],
  [1200, 200],
];

describe("backdropGrid", () => {
  it("covers every corner of the screen", () => {
    // A cell short of the edge shows as a bare triangle of page background in
    // the corner, which is exactly what nobody notices until it ships.
    for (const [width, height] of SCREENS) {
      const { size, origin } = backdropGrid(width, height);
      const corners = [
        [0, 0],
        [width, 0],
        [0, height],
        [width, height],
      ];
      for (const [x, y] of corners) {
        const { col, row } = unproject(x!, y!, origin);
        expect(col, `${width}x${height} at ${x},${y}`).toBeGreaterThanOrEqual(0);
        expect(row, `${width}x${height} at ${x},${y}`).toBeGreaterThanOrEqual(0);
        expect(col, `${width}x${height} at ${x},${y}`).toBeLessThan(size);
        expect(row, `${width}x${height} at ${x},${y}`).toBeLessThan(size);
      }
    }
  });

  it("covers the middle of the screen too, not just the corners", () => {
    for (const [width, height] of SCREENS) {
      const { size, origin } = backdropGrid(width, height);
      for (let x = 0; x <= width; x += 24) {
        for (let y = 0; y <= height; y += 24) {
          const { col, row } = unproject(x, y, origin);
          expect(Math.min(col, row), `${width}x${height} at ${x},${y}`).toBeGreaterThanOrEqual(0);
          expect(Math.max(col, row), `${width}x${height} at ${x},${y}`).toBeLessThan(size);
        }
      }
    }
  });

  it("asks for no more field than the screen needs", () => {
    // Every cell is a `drawImage`, and this runs on a phone.
    expect(backdropGrid(1440, 900).size).toBeLessThan(40);
    expect(backdropGrid(320, 480).size).toBeLessThan(20);
  });
});
