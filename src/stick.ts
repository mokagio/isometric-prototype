import { SX, SY } from "./iso";
import type { Axis } from "./input";

// Half the well minus half the knob, so the knob stays inside its square.
const RADIUS = 44;
const DEADZONE = 0.18; // fraction of RADIUS that still reads as centred

/**
 * Screen drag vector to grid direction — the direction-only inverse of
 * `project`. Magnitude is discarded downstream: `Hero.update` normalises, so
 * the stick steers but does not throttle.
 */
export function axisFromDrag(dx: number, dy: number): Axis {
  const u = dx / SX; // dc - dr
  const v = dy / SY; // dc + dr
  return { dc: (u + v) / 2, dr: (v - u) / 2 };
}

export interface StickInput {
  setStick(axis: Axis | null): void;
}

/** Bottom-left analog stick: any heading, unlike the four a button pad affords. */
export function createStick(input: StickInput): void {
  const base = document.createElement("div");
  base.className = "ww-stick";
  const knob = document.createElement("div");
  knob.className = "ww-stick-knob";
  base.appendChild(knob);

  let held: number | null = null;

  const steer = (e: PointerEvent): void => {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy);
    if (dist > RADIUS) {
      dx = (dx / dist) * RADIUS;
      dy = (dy / dist) * RADIUS;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.setStick(dist < RADIUS * DEADZONE ? null : axisFromDrag(dx, dy));
  };

  const release = (e: PointerEvent): void => {
    if (held !== e.pointerId) return;
    held = null;
    knob.style.transform = "";
    input.setStick(null);
  };

  base.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    held = e.pointerId;
    // Capture so a thumb that slides past the base keeps steering rather than
    // dropping the input mid-move.
    base.setPointerCapture(e.pointerId);
    steer(e);
  });
  base.addEventListener("pointermove", (e) => {
    if (held === e.pointerId) steer(e);
  });
  base.addEventListener("pointerup", release);
  base.addEventListener("pointercancel", release);
  base.addEventListener("contextmenu", (e) => e.preventDefault());

  document.body.appendChild(base);
}
