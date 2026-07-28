import { SX, SY, SZ, type Origin } from "./iso";

// How fast the camera height eases toward the ground under its target, per
// second. A climb should pan gently rather than snap, so this stays moderate.
export const FOLLOW_RATE = 8;

interface Cell {
  col: number;
  row: number;
}

interface View {
  width: number;
  height: number;
}

// An isometric camera that centres its target on screen and eases its height
// toward the ground the target stands on — so a jump reads as the figure rising,
// and climbing terrain pans the view gently instead of jumping.
export class Camera {
  private z: number;

  constructor(z = 0) {
    this.z = z;
  }

  /** The current smoothed height. */
  get height(): number {
    return this.z;
  }

  /** Jump straight to `z` with no easing — for spawn and restart. */
  snap(z: number): void {
    this.z = z;
  }

  /** Ease the height toward `targetZ` over this frame's `dt`. */
  follow(targetZ: number, dt: number, rate = FOLLOW_RATE): void {
    this.z += (targetZ - this.z) * Math.min(1, dt * rate);
  }

  /** Screen origin that centres `target` in `view` at the current height. */
  origin(target: Cell, view: View): Origin {
    return {
      x: view.width / 2 - (target.col - target.row) * SX,
      y: view.height / 2 - ((target.col + target.row) * SY - this.z * SZ) - SY,
    };
  }
}
