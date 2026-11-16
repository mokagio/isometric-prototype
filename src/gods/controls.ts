import { stickFrom } from "./follow";

/**
 * Phone first: the left half of the screen is a stick wherever the thumb lands,
 * the right half turns the camera, and the sword and shield sit under the
 * right thumb. A keyboard and mouse do the same jobs on a computer.
 */
export interface Controls {
  /** Screen-space stick: x right, y down, inside the unit circle. */
  stick(): { x: number; y: number };
  blocking(): boolean;
  /** True once per press. */
  takeAttack(): boolean;
  takeJump(): boolean;
  takeInteract(): boolean;
  /** Pixels the camera was dragged right since last asked. */
  takeTurn(): number;
  /** Show the context button with this label, or hide it. */
  offer(label: string | null): void;
  /** Whether the stick is pushed by a person rather than a key, for the camera's auto-turn. */
  touching(): boolean;
}

const STICK_RADIUS = 56;

export function createControls(): Controls {
  let attack = false;
  let interact = false;
  let turn = 0;
  let touchStick = { x: 0, y: 0 };
  let shieldTouch = false;
  let shieldMouse = false;
  const keys = new Set<string>();

  const layer = el("div", "gd-touch");
  const left = el("div", "gd-zone gd-zone-left");
  const right = el("div", "gd-zone gd-zone-right");
  const base = el("div", "gd-stick");
  const knob = el("div", "gd-stick-knob");
  base.appendChild(knob);
  base.hidden = true;
  layer.append(left, right, base);

  const pads = el("div", "gd-pads");
  const attackBtn = button("gd-btn gd-attack", "Attack", swordIcon());
  const shieldBtn = button("gd-btn gd-shield", "Shield", shieldIcon());
  const jumpBtn = button("gd-btn gd-jump", "Jump", null);
  jumpBtn.textContent = "⤒";
  pads.append(shieldBtn, jumpBtn, attackBtn);
  const interactBtn = button("gd-interact", "", null);
  interactBtn.hidden = true;
  document.body.append(layer, pads, interactBtn);

  // The stick appears under the thumb, wherever on the left half it lands.
  let stickId: number | null = null;
  let origin = { x: 0, y: 0 };
  left.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    stickId = e.pointerId;
    left.setPointerCapture(e.pointerId);
    origin = { x: e.clientX, y: e.clientY };
    base.hidden = false;
    base.style.left = `${origin.x}px`;
    base.style.top = `${origin.y}px`;
    knob.style.transform = "";
  });
  left.addEventListener("pointermove", (e) => {
    if (e.pointerId !== stickId) return;
    let dx = e.clientX - origin.x;
    let dy = e.clientY - origin.y;
    const len = Math.hypot(dx, dy);
    // Drag past the rim and the stick follows the thumb, so it never runs out of travel.
    if (len > STICK_RADIUS) {
      origin.x += (dx / len) * (len - STICK_RADIUS);
      origin.y += (dy / len) * (len - STICK_RADIUS);
      base.style.left = `${origin.x}px`;
      base.style.top = `${origin.y}px`;
      dx = e.clientX - origin.x;
      dy = e.clientY - origin.y;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touchStick = stickFrom(dx, dy, STICK_RADIUS);
  });
  const dropStick = (e: PointerEvent): void => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    touchStick = { x: 0, y: 0 };
    base.hidden = true;
  };
  left.addEventListener("pointerup", dropStick);
  left.addEventListener("pointercancel", dropStick);

  // Dragging anywhere else turns the camera; a mouse can use either half.
  const drags = new Map<number, { x: number; moved: number; button: number }>();
  const startDrag = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && e.button === 2) {
      shieldMouse = true;
      return;
    }
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drags.set(e.pointerId, { x: e.clientX, moved: 0, button: e.button });
  };
  const moveDrag = (e: PointerEvent): void => {
    const d = drags.get(e.pointerId);
    if (!d) return;
    const dx = e.clientX - d.x;
    d.x = e.clientX;
    d.moved += Math.abs(dx);
    turn += dx;
  };
  const endDrag = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && e.button === 2) shieldMouse = false;
    const d = drags.get(e.pointerId);
    if (!d) return;
    drags.delete(e.pointerId);
    // A mouse click that never dragged is a sword swing.
    if (e.pointerType === "mouse" && d.moved < 6 && d.button === 0) attack = true;
  };
  for (const zone of [right, left]) {
    zone.addEventListener("pointerdown", (e) => {
      if (zone === left && e.pointerType !== "mouse") return;
      startDrag(e);
    });
    zone.addEventListener("pointermove", moveDrag);
    zone.addEventListener("pointerup", endDrag);
    zone.addEventListener("pointercancel", endDrag);
    zone.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  attackBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    attack = true;
  });
  let jumpPressed = false;
  jumpBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    jumpPressed = true;
  });
  shieldBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    shieldBtn.setPointerCapture(e.pointerId);
    shieldTouch = true;
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    shieldBtn.addEventListener(type, () => (shieldTouch = false));
  }
  interactBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    interact = true;
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === " " || k === "j") attack = true;
    if (k === "e" || k === "enter") interact = true;
    if (k === "c") jumpPressed = true;
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => {
    keys.clear();
    shieldMouse = false;
  });

  const held = (...names: string[]): boolean => names.some((n) => keys.has(n));

  return {
    stick() {
      const kx = (held("d") ? 1 : 0) - (held("a") ? 1 : 0);
      const ky = (held("s", "arrowdown") ? 1 : 0) - (held("w", "arrowup") ? 1 : 0);
      if (kx || ky) {
        const len = Math.hypot(kx, ky);
        return { x: kx / len, y: ky / len };
      }
      return touchStick;
    },
    blocking: () => shieldTouch || shieldMouse || held("shift", "k"),
    takeAttack() {
      const a = attack;
      attack = false;
      return a;
    },
    takeJump() {
      const j = jumpPressed;
      jumpPressed = false;
      return j;
    },
    takeInteract() {
      const i = interact;
      interact = false;
      return i;
    },
    takeTurn() {
      let t = turn;
      turn = 0;
      if (held("arrowleft")) t -= 9;
      if (held("arrowright")) t += 9;
      return t;
    },
    offer(label) {
      interactBtn.hidden = label === null;
      if (label !== null && interactBtn.textContent !== label) interactBtn.textContent = label;
    },
    touching: () => stickId !== null,
  };
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}

function button(className: string, label: string, icon: SVGElement | null): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = className;
  b.type = "button";
  if (label) b.setAttribute("aria-label", label);
  if (icon) b.appendChild(icon);
  return b;
}

function svg(markup: string): SVGElement {
  const wrap = document.createElement("div");
  wrap.innerHTML = markup.trim();
  return wrap.firstElementChild as SVGElement;
}

function swordIcon(): SVGElement {
  return svg(`<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
    <path d="M37 6 L42 6 L42 11 L20 33 L15 28 Z" fill="#eef3f7" stroke="#2a1d14" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M10 26 L22 38" stroke="#e8b83e" stroke-width="5" stroke-linecap="round"/>
    <path d="M14 34 L7 41" stroke="#6b4429" stroke-width="5" stroke-linecap="round"/>
  </svg>`);
}

function shieldIcon(): SVGElement {
  return svg(`<svg viewBox="0 0 48 48" width="38" height="38" aria-hidden="true">
    <circle cx="24" cy="24" r="18" fill="#cfd8e3" stroke="#9c6b2f" stroke-width="5"/>
    <circle cx="24" cy="24" r="5" fill="#2f6fb5"/>
  </svg>`);
}
