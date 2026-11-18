import { progress, type Kart } from "./kart";
import { headingAt, offset, type Track } from "./track";

/** Metres between grid rows, and from the line to the front row. */
export const ROW_GAP = 6;
export const COLUMN = 3;

/**
 * Grid slots behind the start line, two abreast, pole first. Each starts with
 * `lap` -1, since crossing the line is what makes lap 0 begin.
 */
export function gridSlots(t: Track, count: number): Array<{ x: number; z: number; yaw: number; s: number }> {
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = t.length - ROW_GAP * (Math.floor(i / 2) + 1);
    const p = offset(t, s, i % 2 === 0 ? -COLUMN : COLUMN);
    out.push({ x: p.x, z: p.z, yaw: headingAt(t, s), s });
  }
  return out;
}

/** Kart indices from first to last: finishers by time, then everyone else by distance raced. */
export function standings(t: Track, karts: readonly Kart[]): number[] {
  return karts
    .map((_, i) => i)
    .sort((a, b) => {
      const fa = karts[a]!.finished;
      const fb = karts[b]!.finished;
      if (fa !== null && fb !== null) return fa - fb;
      if (fa !== null) return -1;
      if (fb !== null) return 1;
      return progress(t, karts[b]!) - progress(t, karts[a]!);
    });
}

/** "1st", "2nd", "3rd", "4th"… */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** The lap a kart is on, counted from 1 for showing, and never past the last. */
export function lapShown(k: Kart, laps: number): number {
  return Math.min(laps, Math.max(1, k.lap + 1));
}

/** "1:05.3" */
export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}
