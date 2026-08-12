import { describe, expect, it } from "vitest";
import { STEEL } from "./blocks";
import { applyRope, raycast, type Rope } from "./grapple";
import { World } from "./world";

function beamWorld(): World {
  const world = new World(30, 30);
  world.fill(0, 20, 29, 20, STEEL);
  return world;
}

describe("raycast", () => {
  it("stops at the underside of the beam it is shot at", () => {
    const hit = raycast(beamWorld(), 5.5, 10, 0, 1, 30);
    expect(hit).not.toBeNull();
    expect(hit?.by).toBe(20);
    expect(hit?.y).toBeCloseTo(20, 6);
  });

  it("reports nothing when the beam is out of range", () => {
    expect(raycast(beamWorld(), 5.5, 10, 0, 1, 6)).toBeNull();
  });

  it("reports nothing when the ray never meets a block", () => {
    expect(raycast(beamWorld(), 5.5, 10, 1, 0, 20)).toBeNull();
  });

  it("crosses columns without skipping a block on a shallow diagonal", () => {
    const world = new World(30, 30);
    world.set(9, 11, STEEL);
    const hit = raycast(world, 5.5, 10.5, 4, 1, 20);
    expect(hit?.bx).toBe(9);
    expect(hit?.by).toBe(11);
  });

  it("finds the block it is started inside at zero distance", () => {
    const hit = raycast(beamWorld(), 5.5, 20.5, 0, 1, 10);
    expect(hit?.distance).toBe(0);
  });
});

describe("applyRope", () => {
  const rope: Rope = { anchorX: 10, anchorY: 20, bx: 10, by: 20, length: 5 };

  it("leaves a point inside the rope's reach alone", () => {
    const held = applyRope(rope, 10, 17, 3, -4);
    expect(held.taut).toBe(false);
    expect(held.vx).toBe(3);
    expect(held.vy).toBe(-4);
  });

  it("pulls a point back to exactly the rope's length", () => {
    const held = applyRope(rope, 10, 8, 0, -20);
    expect(held.taut).toBe(true);
    expect(Math.hypot(held.x - rope.anchorX, held.y - rope.anchorY)).toBeCloseTo(5, 6);
  });

  it("spends the falling speed and keeps the sideways speed", () => {
    // Hanging straight down, so the rope runs along y and only vy is radial.
    const held = applyRope(rope, 10, 8, 6, -20);
    expect(held.vy).toBeCloseTo(0, 6);
    expect(held.vx).toBeCloseTo(6, 6);
  });

  it("does not brake a point already swinging back inwards", () => {
    const held = applyRope(rope, 10, 8, 0, 12);
    expect(held.vy).toBeCloseTo(12, 6);
  });
});
