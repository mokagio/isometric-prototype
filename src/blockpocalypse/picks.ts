import type { Ability, Mode } from "./player";

/** What the three buttons on the card offer. */
export type PickId = "jetpack" | "hook" | "joyride";

export interface Pick {
  mode: Mode;
  ability: Ability;
}

/**
 * A pick is a whole game, not a gadget: two of them are the city run with
 * different kit, and the third is a different game entirely. Keeping the
 * mapping here is what lets the card, the loop and the HUD all speak in the
 * same three words.
 */
export const PICKS: Record<PickId, Pick> = {
  jetpack: { mode: "city", ability: "jetpack" },
  hook: { mode: "city", ability: "hook" },
  joyride: { mode: "joyride", ability: "jetpack" },
};

export const PICK_IDS = Object.keys(PICKS) as PickId[];

export function isPick(value: string): value is PickId {
  return value in PICKS;
}
