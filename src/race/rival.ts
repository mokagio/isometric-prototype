import { TOP, type Drive, type Kart } from "./kart";
import { angleDiff, bendAhead, headingAt, offset, type Track } from "./track";

/** How a computer driver races: its own line on the road, and how hard it pushes. */
export interface Rival {
  /** Metres right of the centreline it likes to drive. */
  lane: number;
  /** Fraction of the kart's top speed it allows itself on a straight. */
  skill: number;
}

/** How far up the road a driver looks for where to steer. */
export const LOOK = 9;
/** Rivals more than this far behind the player find a little more, and this far ahead a little less. */
export const BAND = 40;
export const BAND_PUSH = 0.08;

/**
 * Steers at a point a short way up its own lane, and lifts for a bend in
 * proportion to how much the road turns in the distance it takes to brake.
 * `gap` is how far ahead of the player it is, for keeping a race close.
 */
export function rivalDrive(t: Track, k: Kart, r: Rival, gap: number): Drive {
  const aim = offset(t, k.s + LOOK + Math.max(0, k.speed) * 0.25, r.lane);
  const want = Math.atan2(aim.x - k.x, aim.z - k.z);
  const steer = Math.max(-1, Math.min(1, angleDiff(k.yaw, want) * 2.5));
  const bend = bendAhead(t, k.s, 20 + Math.max(0, k.speed) * 1.2);
  const band = gap < -BAND ? 1 + BAND_PUSH : gap > BAND ? 1 - BAND_PUSH : 1;
  const straight = TOP * k.stats.top * r.skill * band;
  const corner = straight * Math.max(0.55, 1 - bend * 0.45);
  // Facing well away from the road (after a spin or a shunt) it simply turns back to it.
  const lost = Math.abs(angleDiff(k.yaw, headingAt(t, k.s))) > 1.6;
  const throttle = lost ? 0.6 : k.speed > corner + 1.5 ? -1 : k.speed < corner ? 1 : 0;
  return { throttle, steer };
}
