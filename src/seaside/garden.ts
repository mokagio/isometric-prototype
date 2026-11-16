/**
 * The garden patch: each cell is bare until dug, then takes a seed. A planted
 * crop grows a stage at a time, but only while watered — every stage drinks the
 * water up, so it needs watering again before the next. Ripe, it is picked and
 * the soil is left dug for the next seed.
 */
export type CropId = "carrot" | "radish" | "cabbage" | "pumpkin";
export const CROPS: readonly CropId[] = ["carrot", "radish", "cabbage", "pumpkin"];

/** Seconds a watered stage takes, per crop: the dearer the seed, the longer the wait. */
export const STAGE_TIME: Record<CropId, number> = { carrot: 15, radish: 20, cabbage: 30, pumpkin: 45 };
/** Stages from seed (0) to ripe; the art's stage after that is the picked vegetable. */
export const RIPE = 4;

export interface Plot {
  dug: boolean;
  crop: CropId | null;
  stage: number;
  watered: boolean;
  /** Seconds grown into the current stage. */
  grown: number;
}

export const bare = (): Plot => ({ dug: false, crop: null, stage: 0, watered: false, grown: 0 });

export type GardenAction = "dig" | "plant" | "water" | "pick" | null;

/** What the action button does on this plot, given whether a seed is in hand. */
export function actionFor(plot: Plot, haveSeed: boolean): GardenAction {
  if (!plot.dug) return "dig";
  if (!plot.crop) return haveSeed ? "plant" : null;
  if (plot.stage >= RIPE) return "pick";
  return plot.watered ? null : "water";
}

export function dig(plot: Plot): void {
  plot.dug = true;
}

export function plant(plot: Plot, crop: CropId): void {
  plot.crop = crop;
  plot.stage = 0;
  plot.watered = false;
  plot.grown = 0;
}

export function water(plot: Plot): void {
  plot.watered = true;
}

/** Pick a ripe crop: hands it back and leaves the soil dug. */
export function pick(plot: Plot): CropId | null {
  if (!plot.crop || plot.stage < RIPE) return null;
  const crop = plot.crop;
  plot.crop = null;
  plot.stage = 0;
  plot.watered = false;
  plot.grown = 0;
  return crop;
}

/** Grow every watered crop; returns whether anything moved on a stage. */
export function grow(plot: Plot, dt: number): boolean {
  if (!plot.crop || !plot.watered || plot.stage >= RIPE) return false;
  plot.grown += dt;
  if (plot.grown < STAGE_TIME[plot.crop]) return false;
  plot.stage += 1;
  plot.grown = 0;
  plot.watered = false;
  return true;
}
