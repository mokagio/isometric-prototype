import { isBreakableBlock } from "./blocks";
import { AIR } from "./blocks";
import type { Body } from "./physics";
import type { World } from "./world";

export const BULLET_LIFE = 0.7;
export const BULLET_DAMAGE = 1;
/** Longest hop a bullet takes before it looks again, in blocks. */
export const BULLET_SUBSTEP = 0.25;

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export type BulletOutcome =
  | { kind: "flying" }
  | { kind: "expired" }
  | { kind: "wall"; x: number; y: number; block: number; broke: boolean }
  | { kind: "hit"; index: number; x: number; y: number };

export interface Target {
  body: Body;
}

/**
 * Walks a bullet forward in short hops so it cannot skip a block or a zombie
 * at forty blocks a second, and reports the first thing it met.
 */
export function stepBullet(
  world: World,
  bullet: Bullet,
  targets: readonly Target[],
  dt: number,
): BulletOutcome {
  bullet.life -= dt;
  if (bullet.life <= 0) return { kind: "expired" };

  const distance = Math.hypot(bullet.vx, bullet.vy) * dt;
  const hops = Math.max(1, Math.ceil(distance / BULLET_SUBSTEP));
  for (let hop = 0; hop < hops; hop++) {
    bullet.x += (bullet.vx * dt) / hops;
    bullet.y += (bullet.vy * dt) / hops;

    for (let index = 0; index < targets.length; index++) {
      const body = targets[index]?.body;
      if (!body) continue;
      if (
        Math.abs(bullet.x - body.x) < body.w / 2 &&
        bullet.y > body.y &&
        bullet.y < body.y + body.h
      ) {
        return { kind: "hit", index, x: bullet.x, y: bullet.y };
      }
    }

    const bx = Math.floor(bullet.x);
    const by = Math.floor(bullet.y);
    if (world.isSolid(bx, by)) {
      const block = world.get(bx, by);
      const broke = isBreakableBlock(block);
      if (broke) world.set(bx, by, AIR);
      return { kind: "wall", x: bullet.x, y: bullet.y, block, broke };
    }
  }
  return { kind: "flying" };
}
