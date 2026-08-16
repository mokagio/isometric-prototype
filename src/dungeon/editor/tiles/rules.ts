import type { Piece } from "../../dungeonTiles";
import { agrees, type Corrections } from "./corrections";

// The corrections collected by the shape they were made against rather than by
// where they happened to be. Since the window settles what the autotiler draws,
// two cells with the same window must draw the same — so this is the
// specification a rewritten `wallPieces` has to satisfy, and two cells with the
// same window drawn differently is somebody having changed their mind.

export interface Variant {
  /** How many cells were drawn this way. */
  cells: number;
  fixed: Piece[];
  /** Whether this is what the autotiler already does. */
  agrees: boolean;
}

export interface Rule {
  around: string;
  cells: number;
  /** The same window drawn more than one way, which cannot all be right. */
  conflict: boolean;
  drawnAs: Variant[];
}

export function rulesFrom(corrections: Corrections): Rule[] {
  const byWindow = new Map<string, Map<string, Variant>>();

  for (const correction of Object.values(corrections)) {
    const variants = byWindow.get(correction.around) ?? new Map<string, Variant>();
    const key = JSON.stringify(correction.fixed);
    const held = variants.get(key);
    if (held) held.cells++;
    else variants.set(key, { cells: 1, fixed: correction.fixed, agrees: agrees(correction) });
    byWindow.set(correction.around, variants);
  }

  return [...byWindow.entries()]
    .map(([around, variants]) => {
      // Commonest first, then by what was drawn, so the same work always comes
      // out in the same order.
      const drawnAs = [...variants.entries()]
        .sort((a, b) => b[1].cells - a[1].cells || a[0].localeCompare(b[0]))
        .map(([, variant]) => variant);
      return {
        around,
        cells: drawnAs.reduce((sum, v) => sum + v.cells, 0),
        conflict: drawnAs.length > 1,
        drawnAs,
      };
    })
    .sort((a, b) => a.around.localeCompare(b.around));
}

/** The windows drawn more than one way, which want settling before the file is used. */
export const conflicts = (rules: Rule[]): Rule[] => rules.filter((rule) => rule.conflict);
