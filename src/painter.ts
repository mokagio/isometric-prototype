// Painting a canvas by dragging over it, which every editor here does the same
// way: press lays something down, dragging keeps laying it down, letting go ends
// the stroke, and the right button rubs out whatever is in hand.
//
// Undo hangs off `onStroke`: a whole drag is one step back, however many cells
// it crossed.

export interface Painter<C> {
  /** Which cell a canvas point is over. Out of bounds is the caller's to notice. */
  cellAt(x: number, y: number): C;
  /** Lay down or rub out at a cell. */
  apply(cell: C, rubbing: boolean): void;
  /** Whether the rubber is in hand, before the mouse button has its say. */
  rubbing(): boolean;
  /** The cell under the pointer, or null once it leaves. */
  onHover?(cell: C | null): void;
  /** A stroke finished, and something may have changed. */
  onStroke?(): void;
  /**
   * Whether dragging keeps laying down, as against only the first press. A held
   * house would otherwise stamp a row of them across the board.
   */
  dragPaints?(rubbing: boolean): boolean;
}

/** Wire a canvas up to a painter. There is nothing to undo afterwards. */
export function createPainter<C>(canvas: HTMLCanvasElement, painter: Painter<C>): void {
  let painting = false;
  let rubbing = false;

  const at = (e: PointerEvent): C => {
    const rect = canvas.getBoundingClientRect();
    return painter.cellAt(e.clientX - rect.left, e.clientY - rect.top);
  };

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.button !== 2) return; // the middle button is somebody else's
    e.preventDefault();
    const cell = at(e);
    // Right-click rubs out whatever the sidebar says is in hand.
    rubbing = e.button === 2 || painter.rubbing();
    painting = true;
    painter.onHover?.(cell);
    painter.apply(cell, rubbing);
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    const cell = at(e);
    painter.onHover?.(cell);
    if (!painting) return;
    if (painter.dragPaints && !painter.dragPaints(rubbing)) return;
    painter.apply(cell, rubbing);
  });

  const end = (): void => {
    if (!painting) return;
    painting = false;
    painter.onStroke?.();
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(type, end);
  }
  canvas.addEventListener("pointerleave", () => {
    painter.onHover?.(null);
    end();
  });
}
