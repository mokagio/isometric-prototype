/**
 * Fishing: cast, wait for a bite, and reel in while the line is tugging. Reel
 * too soon and the fish is not on yet; too late and it got away.
 */
export type FishId = "sardine" | "mackerel" | "snapper" | "golden";
export const FISH: readonly FishId[] = ["sardine", "mackerel", "snapper", "golden"];
/** How likely each catch is, out of 100. */
export const FISH_ODDS: Record<FishId, number> = { sardine: 50, mackerel: 30, snapper: 17, golden: 3 };

export const CAST_TIME = 15 / 12;
export const WAIT_MIN = 2;
export const WAIT_MAX = 6;
/** How long the line tugs before the fish gets away. */
export const BITE_TIME = 1.2;
export const REEL_TIME = 13 / 12;
export const CAUGHT_TIME = 10 / 12;

export type LineState = "idle" | "casting" | "waiting" | "bite" | "reeling" | "caught" | "missed";

export interface Line {
  state: LineState;
  t: number;
  /** When the bite comes, measured into the wait. */
  biteAt: number;
  fish: FishId | null;
}

export const idleLine = (): Line => ({ state: "idle", t: 0, biteAt: 0, fish: null });

export function pickFish(roll: number): FishId {
  let total = 0;
  for (const f of FISH) {
    total += FISH_ODDS[f];
    if (roll * 100 < total) return f;
  }
  return "sardine";
}

export function cast(line: Line, rand: () => number = Math.random): void {
  line.state = "casting";
  line.t = 0;
  line.biteAt = WAIT_MIN + rand() * (WAIT_MAX - WAIT_MIN);
  line.fish = null;
}

/** The action button while fishing: reel when it bites, and too early just pulls the line out. */
export function reel(line: Line, rand: () => number = Math.random): void {
  if (line.state === "bite") {
    line.state = "reeling";
    line.fish = pickFish(rand());
  } else if (line.state === "waiting" || line.state === "casting") {
    line.state = "missed";
  }
  line.t = 0;
}

/** Moves the line on; hands back a fish the moment one is landed. */
export function stepLine(line: Line, dt: number): FishId | null {
  line.t += dt;
  switch (line.state) {
    case "casting":
      if (line.t >= CAST_TIME) {
        line.state = "waiting";
        line.t = 0;
      }
      break;
    case "waiting":
      if (line.t >= line.biteAt) {
        line.state = "bite";
        line.t = 0;
      }
      break;
    case "bite":
      if (line.t >= BITE_TIME) {
        line.state = "missed";
        line.t = 0;
      }
      break;
    case "reeling":
      if (line.t >= REEL_TIME) {
        line.state = "caught";
        line.t = 0;
        return line.fish;
      }
      break;
    case "caught":
      if (line.t >= CAUGHT_TIME) Object.assign(line, idleLine());
      break;
    case "missed":
      if (line.t >= 0.6) Object.assign(line, idleLine());
      break;
    case "idle":
      break;
  }
  return null;
}

export const fishing = (line: Line): boolean => line.state !== "idle";
