import type { Tile } from "../world";

export interface PaletteEntry {
  label: string;
  tile: Tile;
}

// Curated brushes drawn from the sheet — the tiles kids will reach for most.
export const PALETTE: PaletteEntry[] = [
  { label: "Grass", tile: [1, 1] },
  { label: "Flowers", tile: [1, 8] },
  { label: "Path", tile: [2, 1] },
  { label: "Dry Grass", tile: [4, 1] },
  { label: "Dirt", tile: [0, 1] },
  { label: "Stone", tile: [0, 4] },
  { label: "Sand", tile: [0, 6] },
  { label: "Water", tile: [7, 1] },
  { label: "Brick", tile: [0, 11] },
  { label: "Wood", tile: [0, 14] },
  { label: "Blue Crystal", tile: [0, 10] },
  { label: "Teal Crystal", tile: [1, 10] },
  { label: "Purple Crystal", tile: [2, 10] },
  { label: "Lava", tile: [3, 10] },
];
