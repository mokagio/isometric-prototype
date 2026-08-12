/**
 * What the simulation is allowed to know about the player's hands. Every
 * field is filled in before a step, so the sim never touches an event or the
 * DOM and can be driven from a test.
 */
export interface InputState {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  shoot: boolean;
  grapple: boolean;
  reelIn: boolean;
  reelOut: boolean;
  /** Where the crosshair is, in world blocks. */
  aimX: number;
  aimY: number;
}

export function emptyInput(): InputState {
  return {
    left: false,
    right: false,
    jumpHeld: false,
    jumpPressed: false,
    shoot: false,
    grapple: false,
    reelIn: false,
    reelOut: false,
    aimX: 0,
    aimY: 0,
  };
}

export interface InputSource {
  readonly state: InputState;
  /** Screen pixels, for the renderer to unproject into `aimX`/`aimY`. */
  readonly pointer: { x: number; y: number };
  /**
   * Presses the loop acts on rather than the simulation. Each reports true
   * once and forgets, so they work on a frame where no tick ran — which is
   * every frame while the game is paused.
   */
  takeRestart(): boolean;
  takePause(): boolean;
  /** True until the first press of anything, which is what starts the game. */
  takeAnyPress(): boolean;
  /**
   * Wires an on-screen pad to an action for as long as it is held. The pads
   * are what the joyride is played with on a touch screen, where there is no
   * keyboard to hold and no mouse to aim.
   */
  bindPad(element: HTMLElement, action: "fly" | "shoot"): void;
  /** Clears the one-frame edges. Called once per simulation step. */
  endFrame(): void;
  dispose(): void;
}

const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const UP_KEYS = new Set(["ArrowUp", "KeyW"]);
const DOWN_KEYS = new Set(["ArrowDown", "KeyS"]);
const JUMP_KEYS = new Set(["Space", "ArrowUp", "KeyW"]);

export function createInput(target: HTMLElement): InputSource {
  const state = emptyInput();
  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const down = new Set<string>();
  let restartPressed = false;
  let pausePressed = false;
  let anyPressed = false;
  let mouseShoot = false;
  let padFly = false;
  let padShoot = false;

  // Keys, mouse and pads all feed the same two flags, so a pad press is not
  // undone by the next keyboard sync.
  const sync = (): void => {
    state.left = [...LEFT_KEYS].some((k) => down.has(k));
    state.right = [...RIGHT_KEYS].some((k) => down.has(k));
    state.jumpHeld = padFly || [...JUMP_KEYS].some((k) => down.has(k));
    state.shoot = padShoot || mouseShoot;
    state.reelIn = [...UP_KEYS].some((k) => down.has(k));
    state.reelOut = [...DOWN_KEYS].some((k) => down.has(k));
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.code === "Escape") pausePressed = true;
    else anyPressed = true;
    if (JUMP_KEYS.has(event.code)) state.jumpPressed = true;
    if (event.code === "KeyR") restartPressed = true;
    // Shift is the keyboard-only way to grapple, for a trackpad with no
    // second button.
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") state.grapple = true;
    down.add(event.code);
    sync();
    if (event.code === "Space") event.preventDefault();
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") state.grapple = false;
    down.delete(event.code);
    sync();
  };

  const onBlur = (): void => {
    down.clear();
    mouseShoot = false;
    padFly = false;
    padShoot = false;
    state.grapple = false;
    sync();
  };

  const onPointerMove = (event: PointerEvent): void => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  };

  const onPointerDown = (event: PointerEvent): void => {
    // Keeps a drag alive when the cursor leaves the canvas. It throws when the
    // event came from something other than a live pointer, which is what a
    // synthetic event in a test harness is.
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      /* not a real pointer */
    }
    if (event.button === 0) mouseShoot = true;
    if (event.button === 2) state.grapple = true;
    anyPressed = true;
    sync();
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.button === 0) mouseShoot = false;
    if (event.button === 2) state.grapple = false;
    sync();
  };

  const onContextMenu = (event: Event): void => event.preventDefault();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  target.addEventListener("pointermove", onPointerMove);
  target.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  target.addEventListener("contextmenu", onContextMenu);

  return {
    state,
    pointer,
    takeRestart() {
      const pressed = restartPressed;
      restartPressed = false;
      return pressed;
    },
    takePause() {
      const pressed = pausePressed;
      pausePressed = false;
      return pressed;
    },
    takeAnyPress() {
      const pressed = anyPressed;
      anyPressed = false;
      return pressed;
    },
    bindPad(element, action) {
      const press = (event: PointerEvent): void => {
        event.preventDefault();
        element.setPointerCapture?.(event.pointerId);
        if (action === "fly") {
          padFly = true;
          state.jumpPressed = true;
        } else {
          padShoot = true;
        }
        anyPressed = true;
        sync();
      };
      const release = (): void => {
        if (action === "fly") padFly = false;
        else padShoot = false;
        sync();
      };
      element.addEventListener("pointerdown", press);
      element.addEventListener("pointerup", release);
      element.addEventListener("pointercancel", release);
      element.addEventListener("pointerleave", release);
    },
    endFrame() {
      state.jumpPressed = false;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      target.removeEventListener("pointermove", onPointerMove);
      target.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      target.removeEventListener("contextmenu", onContextMenu);
    },
  };
}
