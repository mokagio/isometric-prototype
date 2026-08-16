/** The pack's own direction order: 0 up, 1 left, 2 down, 3 right. */
export type Facing = 0 | 1 | 2 | 3;

export const UP = 0;
export const LEFT = 1;
export const DOWN = 2;
export const RIGHT = 3;

/**
 * Movement direction as one of the four facings, or null when still.
 *
 * Ties go to the vertical, so a hero walked exactly diagonally faces the camera
 * rather than flickering between two sheets on rounding noise.
 */
export function facingFromAxis(dc: number, dr: number): Facing | null {
  if (dc === 0 && dr === 0) return null;
  if (Math.abs(dr) >= Math.abs(dc)) return dr > 0 ? DOWN : UP;
  return dc > 0 ? RIGHT : LEFT;
}
