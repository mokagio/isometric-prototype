import type { Lives } from "./lives";
import type { World } from "./world";

// Lava is crossable, at a price. Standing in it spends a heart, and the immunity
// window that stops a slime emptying the bar in ten frames paces this to a heart
// a second — the same mercy applies however you are being hurt.

interface Pos {
  col: number;
  row: number;
}

/** Whether the hero is standing in something that hurts. */
export const inHazard = (world: Pick<World, "isHazard">, at: Pos): boolean =>
  world.isHazard(Math.round(at.col), Math.round(at.row));

/** Charge the hero for standing in water or lava. True when a heart was spent. */
export function hazardToll(world: Pick<World, "isHazard">, at: Pos, lives: Lives): boolean {
  return inHazard(world, at) && lives.hit();
}
