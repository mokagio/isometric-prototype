import * as THREE from "three";
import { GROUND_TOP, type Level } from "./level";
import { mulberry32 } from "./rng";

/**
 * How much of the camera's own movement each layer is carried along by. An
 * orthographic camera gives no parallax of its own — distance does not shrink
 * anything — so depth has to be moved by hand: a layer travelling at `drift`
 * appears to scroll at `1 - drift`, and the moon, at 1, never moves at all.
 */
const DRIFT = { near: 0.35, far: 0.6, stars: 0.94, moon: 1 };

export interface Backdrop {
  group: THREE.Group;
  follow(x: number, y: number): void;
}

/**
 * Everything behind the city that is scenery rather than world: the
 * silhouettes on the horizon, a sky full of square stars, and a moon.
 */
export function buildBackdrop(level: Level): Backdrop {
  const group = new THREE.Group();
  const near = new THREE.Group();
  near.add(buildSkyline(level, -18, 0x232c46, 1), buildSkyWindows(level, -17.4, 1, 0x9c4d24));
  const far = new THREE.Group();
  far.add(buildSkyline(level, -34, 0x39456b, 1.45), buildSkyWindows(level, -33.4, 1.45, 0x6e4a3c));
  const stars = buildStars(level);
  const moon = buildMoon(level);
  group.add(far, near, stars, moon);

  const home = {
    near: near.position.clone(),
    far: far.position.clone(),
    stars: stars.position.clone(),
    moon: moon.position.clone(),
  };

  return {
    group,
    follow(x, y) {
      near.position.set(home.near.x + x * DRIFT.near, home.near.y, home.near.z);
      far.position.set(home.far.x + x * DRIFT.far, home.far.y, home.far.z);
      stars.position.set(
        home.stars.x + x * DRIFT.stars,
        home.stars.y + y * DRIFT.stars,
        home.stars.z,
      );
      moon.position.set(home.moon.x + x * DRIFT.moon, home.moon.y + y * DRIFT.moon, home.moon.z);
    },
  };
}

/** Flat silhouettes far behind the street, four columns of skyline to a box. */
function buildSkyline(level: Level, z: number, tint: number, stretch: number): THREE.InstancedMesh {
  const step = 4;
  const columns = Math.ceil(level.skyline.length / step);
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(step, 1, 1),
    new THREE.MeshLambertMaterial({ color: tint }),
    columns,
  );
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  for (let column = 0; column < columns; column++) {
    const height = (level.skyline[column * step] ?? 10) * stretch;
    dummy.position.set(column * step, GROUND_TOP + height / 2 - 3, 0);
    dummy.scale.set(1, height, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(column, dummy.matrix);
  }
  mesh.position.z = z;
  return mesh;
}

/**
 * The lights still on out there. A silhouette alone reads as a wall behind the
 * player; it only becomes a city once you can see somebody is home.
 */
function buildSkyWindows(level: Level, z: number, stretch: number, tint: number): THREE.InstancedMesh {
  const step = 4;
  const rng = mulberry32(0xc17a5 + Math.round(stretch * 1000));
  const columns = Math.ceil(level.skyline.length / step);
  const lights: Array<{ x: number; y: number; lit: number }> = [];

  for (let column = 0; column < columns; column++) {
    const height = (level.skyline[column * step] ?? 10) * stretch;
    const base = GROUND_TOP + height / 2 - 3 - height / 2;
    for (let row = 1.5; row < height - 1; row += 2.2) {
      for (let slot = 0; slot < 4; slot++) {
        if (rng() > 0.26) continue;
        lights.push({
          x: column * step - step / 2 + 0.7 + slot * 0.9,
          y: base + row,
          lit: 0.5 + rng() * 0.5,
        });
      }
    }
  }

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.34, 0.46, 0.1),
    new THREE.MeshBasicMaterial({ color: tint, fog: false }),
    Math.max(1, lights.length),
  );
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const colour = new THREE.Color();
  lights.forEach((light, index) => {
    dummy.position.set(light.x, light.y, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, colour.setScalar(light.lit));
  });
  mesh.count = lights.length;
  mesh.position.z = z;
  return mesh;
}

/** Square, because everything else here is. */
function buildStars(level: Level): THREE.InstancedMesh {
  const count = 280;
  const rng = mulberry32(0x5eed);
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false }),
    count,
  );
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const colour = new THREE.Color();
  for (let index = 0; index < count; index++) {
    // Thinning towards the horizon, where the dusk washes them out anyway.
    const height = rng() ** 0.55;
    dummy.position.set(rng() * level.world.width, GROUND_TOP + 12 + height * 48, 0);
    dummy.scale.setScalar(0.18 + rng() * 0.3);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, colour.setScalar(0.4 + height * 0.6));
  }
  mesh.position.z = -52;
  return mesh;
}

function buildMoon(level: Level): THREE.Mesh {
  const moon = new THREE.Mesh(
    new THREE.BoxGeometry(5, 5, 1),
    new THREE.MeshBasicMaterial({ color: 0xf4f0dc, fog: false }),
  );
  moon.position.set(level.world.width * 0.1, GROUND_TOP + 42, -50);
  return moon;
}
