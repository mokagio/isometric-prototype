import type { Drive } from "./kart";

/**
 * Phone first: a thumb anywhere on the left half steers by sliding sideways,
 * and once a screen has been touched the kart drives itself forward, so the
 * right thumb is free for the brake and the item. A keyboard does the lot.
 */
export interface Controls {
  drive(): Drive;
  /** True once per press. */
  takeItem(): boolean;
  /** Show or hide the touch pads. */
  show(on: boolean): void;
}

/** Pixels of sideways slide for full lock. */
export const STEER_TRAVEL = 70;

/** Steering from a thumb `dx` pixels from where it landed: a small dead zone, then linear to full lock. */
export function steerFromSlide(dx: number): number {
  const dead = 6;
  if (Math.abs(dx) < dead) return 0;
  return Math.max(-1, Math.min(1, (dx - Math.sign(dx) * dead) / (STEER_TRAVEL - dead)));
}

export function createControls(): Controls {
  const keys = new Set<string>();
  let item = false;
  let touched = false;
  let slide = 0;
  let braking = false;

  const zone = el("div", "rc-steer-zone");
  const knob = el("div", "rc-steer");
  knob.hidden = true;
  const pads = el("div", "rc-pads");
  const brake = el("button", "rc-btn rc-brake");
  brake.setAttribute("aria-label", "Brake");
  brake.textContent = "◼";
  const use = el("button", "rc-btn rc-use");
  use.setAttribute("aria-label", "Use item");
  use.textContent = "★";
  pads.append(brake, use);
  document.body.append(zone, knob, pads);

  let finger: number | null = null;
  let originX = 0;
  zone.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    touched = true;
    finger = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    originX = e.clientX;
    knob.hidden = false;
    knob.style.left = `${e.clientX}px`;
    knob.style.top = `${e.clientY}px`;
  });
  zone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== finger) return;
    let dx = e.clientX - originX;
    // Slide past full lock and the origin follows, so turning back is never a long way.
    if (Math.abs(dx) > STEER_TRAVEL) {
      originX += dx - Math.sign(dx) * STEER_TRAVEL;
      dx = Math.sign(dx) * STEER_TRAVEL;
    }
    slide = steerFromSlide(dx);
    knob.style.transform = `translateX(${dx}px)`;
  });
  const lift = (e: PointerEvent): void => {
    if (e.pointerId !== finger) return;
    finger = null;
    slide = 0;
    knob.hidden = true;
    knob.style.transform = "";
  };
  zone.addEventListener("pointerup", lift);
  zone.addEventListener("pointercancel", lift);

  brake.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    touched = true;
    brake.setPointerCapture(e.pointerId);
    braking = true;
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) brake.addEventListener(type, () => (braking = false));
  use.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    touched = true;
    item = true;
  });

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
    if (e.repeat) return;
    keys.add(k);
    if (k === " " || k === "x") item = true;
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());
  const held = (...names: string[]): boolean => names.some((n) => keys.has(n));

  return {
    drive() {
      const steer = (held("d", "arrowright") ? 1 : 0) - (held("a", "arrowleft") ? 1 : 0);
      const pedal = (held("w", "arrowup") ? 1 : 0) - (held("s", "arrowdown") ? 1 : 0);
      if (steer || pedal) return { throttle: pedal, steer };
      return { throttle: braking ? -1 : touched ? 1 : 0, steer: slide };
    },
    takeItem() {
      const i = item;
      item = false;
      return i;
    },
    show(on) {
      zone.hidden = !on;
      pads.hidden = !on;
      if (!on) {
        knob.hidden = true;
        slide = 0;
        braking = false;
      }
    },
  };
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  if (e instanceof HTMLButtonElement) e.type = "button";
  return e;
}
