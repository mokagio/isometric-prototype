/**
 * Every block the city is made of. The ids are stored in the world's
 * `Uint8Array`, so they are fixed once a saved level exists — append, never
 * renumber.
 */
export const AIR = 0;
export const ASPHALT = 1;
export const SIDEWALK = 2;
export const CONCRETE = 3;
export const BRICK = 4;
export const PLANK = 5;
export const STEEL = 6;
export const GLASS = 7;
export const RUBBLE = 8;
export const DIRT = 9;
export const BEACON = 10;
export const HELIPAD = 11;
export const BLOOD_BRICK = 12;
export const LAMP_POST = 13;
export const LAMP_HEAD = 14;
export const WINDOW_LIT = 15;
export const VENT = 16;
export const CRATE = 17;
export const CAR_BODY = 18;
export const CAR_GLASS = 19;
export const TYRE = 20;
export const PIPE = 21;
export const SIGN = 22;
export const COIN = 23;
export const LASER = 24;
export const EMITTER = 25;
export const LASER_UP = 26;

export interface BlockSpec {
  /** Picks the tile painter in `textures.ts`. */
  name: string;
  colour: number;
  /** Stops a body. Decoration is drawn but walked through. */
  solid: boolean;
  /** A bullet punches straight through and leaves a hole. */
  breakable: boolean;
  /** Drawn unlit at full brightness, so it reads as its own light source. */
  glows: boolean;
  /** Costs a heart to touch. Never solid — you fly through it and regret it. */
  hazard: boolean;
  /** Picked up on contact and gone. */
  prize: boolean;
  /**
   * Inset from each side, in blocks. A post or a pipe is a slim box rather
   * than a full cube, and is never culled against its neighbours.
   */
  slim: number;
}

function spec(
  name: string,
  colour: number,
  options: Partial<Omit<BlockSpec, "name" | "colour">> = {},
): BlockSpec {
  return {
    name,
    colour,
    solid: options.solid ?? true,
    breakable: options.breakable ?? false,
    glows: options.glows ?? false,
    hazard: options.hazard ?? false,
    prize: options.prize ?? false,
    slim: options.slim ?? 0,
  };
}

export const SPECS: readonly BlockSpec[] = [
  spec("air", 0x000000, { solid: false }),
  spec("asphalt", 0x33363d),
  spec("sidewalk", 0x5f636b),
  spec("concrete", 0x8b909a),
  spec("brick", 0x8c4a3a),
  spec("plank", 0x9a6b3f, { breakable: true }),
  spec("steel", 0x717f8e),
  spec("glass", 0x7fbccc, { breakable: true }),
  spec("rubble", 0x6d6155),
  spec("dirt", 0x4c3c2c),
  spec("beacon", 0x38e0a0, { glows: true }),
  spec("helipad", 0xe8d24a),
  spec("bloodBrick", 0x6d2f2f),
  spec("lampPost", 0x3a4048, { solid: false, slim: 0.36 }),
  spec("lampHead", 0xffd98a, { solid: false, slim: 0.24, glows: true }),
  spec("windowLit", 0xffcc7a, { breakable: true, glows: true }),
  spec("vent", 0x6b7079),
  spec("crate", 0xa87a45, { breakable: true }),
  spec("carBody", 0x9c4b46),
  spec("carGlass", 0x4a5a68),
  spec("tyre", 0x22242a),
  spec("pipe", 0x7d6a52, { solid: false, slim: 0.3 }),
  spec("sign", 0xd8563f, { solid: false }),
  spec("coin", 0xffd23f, { solid: false, glows: true, prize: true, slim: 0.22 }),
  spec("laser", 0xff4d4d, { solid: false, glows: true, hazard: true, slim: 0.16 }),
  spec("emitter", 0x565f6b, { solid: false }),
  // The same beam standing up. One tile cannot read as a beam both ways: the
  // core has to run along it, and along is a different axis each time.
  spec("laserUp", 0xff4d4d, { solid: false, glows: true, hazard: true, slim: 0.16 }),
];

export const BLOCK_COUNT = SPECS.length;

const FALLBACK = SPECS[0] as BlockSpec;

export function specOf(block: number): BlockSpec {
  return SPECS[block] ?? FALLBACK;
}

export function isSolidBlock(block: number): boolean {
  return specOf(block).solid;
}

export function isBreakableBlock(block: number): boolean {
  return specOf(block).breakable;
}

/** Hides the faces behind it, and is what corner shading counts as a neighbour. */
export function isOpaqueBlock(block: number): boolean {
  const found = specOf(block);
  return block !== AIR && found.slim === 0;
}

export function isHazardBlock(block: number): boolean {
  return specOf(block).hazard;
}

export function isPrizeBlock(block: number): boolean {
  return specOf(block).prize;
}

export function colourOf(block: number): number {
  return specOf(block).colour;
}
