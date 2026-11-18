import type { Stats } from "./kart";
import type { TrackShape } from "./track";

/** What a track is dressed as: the ground, the trees, the sky. */
export type Theme = "meadow" | "desert" | "snow" | "autumn";
export const THEMES: readonly Theme[] = ["meadow", "desert", "snow", "autumn"];

const THEME_NAME: Record<Theme, string> = { meadow: "Meadow", desert: "Dune", snow: "Frost", autumn: "Maple" };
const KIND = ["Loop", "Ring", "Run", "Circuit", "Rally", "Grand Prix"];

/** One rung: a track, how many laps of it, and how hard the rivals drive. */
export interface Rung {
  index: number;
  name: string;
  seed: number;
  shape: TrackShape;
  theme: Theme;
  laps: number;
  rivals: number;
  /** Fraction of their karts' top speed the rivals allow themselves. */
  skill: number;
}

/**
 * A formula rather than a table, so the ladder never runs out: each rung is a
 * longer, twistier track with rivals who push a little harder.
 */
export function rung(n: number): Rung {
  const theme = THEMES[n % THEMES.length]!;
  const round = Math.floor(n / THEMES.length);
  const lap = Math.floor(n / (THEMES.length * KIND.length));
  const name = `${THEME_NAME[theme]} ${KIND[round % KIND.length]}${lap > 0 ? ` ${lap + 1}` : ""}`;
  return {
    index: n,
    name,
    seed: 1000 + n * 37,
    shape: {
      radius: Math.min(115, 60 + n * 6),
      wiggle: Math.min(0.3, 0.16 + n * 0.02),
      corners: Math.min(13, 8 + Math.floor(n / 2)),
    },
    theme,
    laps: n < 2 ? 2 : 3,
    rivals: 5,
    skill: Math.min(1.02, 0.8 + n * 0.03),
  };
}

/** A kart in the garage: who drives it, its colour, and how it handles. */
export interface Car {
  name: string;
  color: number;
  stats: Stats;
}

/** The garage, in the order winning unlocks them. */
export const CARS: readonly Car[] = [
  { name: "Pip", color: 0xd8382c, stats: { top: 1, accel: 1, turn: 1 } },
  { name: "Bolt", color: 0xf2c230, stats: { top: 1.02, accel: 1.25, turn: 1 } },
  { name: "Thistle", color: 0x4cae4f, stats: { top: 1.04, accel: 1.1, turn: 1.2 } },
  { name: "Comet", color: 0x2f7fd8, stats: { top: 1.1, accel: 1.1, turn: 1.05 } },
  { name: "Ember", color: 0xf07a22, stats: { top: 1.13, accel: 1.25, turn: 1.15 } },
  { name: "Nova", color: 0x8a4fd0, stats: { top: 1.18, accel: 1.35, turn: 1.25 } },
];

/** How every rival's kart handles; `Rung.skill` is what sets them apart from rung to rung. */
export const RIVAL_STATS: Stats = { top: 1.05, accel: 1.1, turn: 1.1 };

/** Cars on offer after `won` races have been won: one more for every win, while they last. */
export function carsUnlocked(won: number): number {
  return Math.min(CARS.length, won + 1);
}

/** The rung a run is up to is the first it has not won. */
export function rungsOpen(won: number): number {
  return won + 1;
}
