import { randInt } from "./rng";

export const PARTICLE_GRAVITY = 26;
export const MAX_PARTICLES = 600;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  colour: number;
}

export function stepParticles(particles: Particle[], dt: number): void {
  for (let index = particles.length - 1; index >= 0; index--) {
    const particle = particles[index];
    if (!particle) continue;
    particle.life -= dt;
    if (particle.life <= 0) {
      particles.splice(index, 1);
      continue;
    }
    particle.vy -= PARTICLE_GRAVITY * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
}

/**
 * A puff of voxel chips, thrown out of a point in every direction. `drift`
 * biases which way the puff as a whole goes — upwards by default, since most
 * of these are things knocked off something, and downwards for exhaust.
 */
export function burst(
  particles: Particle[],
  rng: () => number,
  x: number,
  y: number,
  colour: number,
  count: number,
  speed: number,
  drift = speed * 0.3,
): void {
  const room = MAX_PARTICLES - particles.length;
  for (let index = 0; index < Math.min(count, room); index++) {
    const angle = rng() * Math.PI * 2;
    const power = speed * (0.35 + rng() * 0.65);
    const life = 0.35 + rng() * 0.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power + drift,
      life,
      maxLife: life,
      size: 0.1 + randInt(rng, 0, 2) * 0.06,
      colour,
    });
  }
}
