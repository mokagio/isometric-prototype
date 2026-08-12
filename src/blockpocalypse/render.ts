import * as THREE from "three";
import { buildBackdrop } from "./backdrop";
import { buildCity } from "./city";
import { animateWalk, buildFigure, tintFigure, type Figure, type FigurePalette } from "./figure";
import { loadRifle, RIFLE_MOUNT, RIFLE_SPIN } from "./gun";
import { MAX_ZOMBIES, type Game } from "./game";
import { JOY_CEIL, JOY_FLOOR } from "./joyride";
import { GROUND_TOP, type Level } from "./level";
import { MAX_PARTICLES } from "./particles";
import { chestY, PLAYER_HEIGHT } from "./player";
import type { ZombieKind } from "./level";
import { BREEDS } from "./zombies";

/** Blocks of world visible from the top of the window to the bottom. */
export const VIEW_HEIGHT = 20;
export const MAX_BULLETS = 96;
/** How far ahead the camera leans, in seconds of the player's own run. */
export const LOOKAHEAD = 0.22;
export const CAMERA_LAG = 7;
/**
 * Where the joyride sits the player across the window. Well left of centre,
 * because in an auto-runner every decision is about what is coming.
 */
export const JOY_SCREEN_X = 0.28;

/**
 * The city fills z from -1 to 0, so everything alive stands clear in front of
 * it rather than half-buried in the wall it is running past.
 */
const ACTOR_Z = 0.3;

const PLAYER_PALETTE = {
  skin: 0xd9a066,
  shirt: 0x3f76b5,
  legs: 0x2f3b4a,
  hair: 0x3a2a1a,
  gun: 0x24252b,
};

const ZOMBIE_PALETTE: Record<ZombieKind, FigurePalette> = {
  walker: { skin: 0x6aa84f, shirt: 0x4a3b52, legs: 0x33352c, hair: 0x2d3a24 },
  runner: { skin: 0x86b850, shirt: 0x7a2f2f, legs: 0x2c2c33, hair: 0x1f2a18 },
  flyer: { skin: 0x9fd06a, shirt: 0x4b3f6b, legs: 0x2b2f45, hair: 0x22301c },
};

export interface Renderer {
  render(game: Game, dt: number): void;
  resize(): void;
  /** Turns a pointer position in screen pixels into a point in the world. */
  pointerToWorld(x: number, y: number): { x: number; y: number };
  dispose(): void;
}

export function createRenderer(canvas: HTMLCanvasElement, level: Level): Renderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  // Starts past the city's own depth, so only the silhouettes behind it haze.
  scene.fog = new THREE.Fog(0x3c4a70, 66, 130);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  // A few degrees off dead-on. Square to the city, a cube is a square and
  // nothing reads as voxels at all.
  const eye = new THREE.Vector3(0.2, 0.14, 1).normalize().multiplyScalar(60);

  scene.add(new THREE.HemisphereLight(0xc9d8f0, 0x50423a, 2));
  const sun = new THREE.DirectionalLight(0xffe3b0, 1.9);
  sun.position.set(-6, 10, 8);
  scene.add(sun);

  const city = buildCity(level.world);
  scene.add(city.group);
  const backdrop = buildBackdrop(level);
  scene.add(backdrop.group);

  const player = buildFigure(PLAYER_PALETTE, PLAYER_HEIGHT);
  scene.add(player.group);
  // The rifle arrives whenever it arrives; until then the figure holds the
  // block that stands in for it, so nothing waits on a download to start.
  let disposed = false;
  void loadRifle().then((rifle) => {
    if (disposed) return;
    const held = rifle.clone();
    held.position.set(RIFLE_MOUNT.x, RIFLE_MOUNT.y, RIFLE_MOUNT.z);
    held.rotation.z = RIFLE_SPIN;
    player.armFront.add(held);
    if (player.gun) player.gun.visible = false;
  });
  const pack = buildJetpack(player.materials);
  player.group.add(pack);

  const zombiePool: Figure[] = [];
  const zombieGroup = new THREE.Group();
  scene.add(zombieGroup);

  const rope = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.08, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xf0e8d2 }),
  );
  rope.visible = false;
  const hookHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.MeshLambertMaterial({ color: 0xc2ccd6 }),
  );
  hookHead.visible = false;
  scene.add(rope, hookHead);

  const bullets = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.3, 0.12, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xffe066 }),
    MAX_BULLETS,
  );
  bullets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bullets.frustumCulled = false;
  scene.add(bullets);

  const particles = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial(),
    MAX_PARTICLES,
  );
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particles.frustumCulled = false;
  scene.add(particles);

  const goalLight = new THREE.PointLight(0xffe066, 40, 34);
  goalLight.position.set(level.goalX, level.goalY + 2, 4);
  scene.add(goalLight);

  const dummy = new THREE.Object3D();
  const colour = new THREE.Color();
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -ACTOR_Z);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const focus = new THREE.Vector2(level.spawnX, level.spawnY + 4);

  let viewWidth = VIEW_HEIGHT;

  function resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    viewWidth = VIEW_HEIGHT * (width / height);
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = VIEW_HEIGHT / 2;
    camera.bottom = -VIEW_HEIGHT / 2;
    camera.updateProjectionMatrix();
  }
  resize();

  function followPlayer(game: Game, dt: number): void {
    const body = game.player.body;
    const joyride = game.player.mode === "joyride";
    // The tunnel is framed rather than followed: a camera that chased the
    // player up and down would make a fixed corridor feel like it was moving.
    const wantX = joyride
      ? body.x + viewWidth * (0.5 - JOY_SCREEN_X)
      : body.x + body.vx * LOOKAHEAD;
    const wantY = joyride
      ? (JOY_FLOOR + JOY_CEIL) / 2
      : Math.max(body.y + 4.5, GROUND_TOP + 5.5);
    const blend = 1 - Math.exp(-CAMERA_LAG * dt);
    focus.x += (wantX - focus.x) * blend;
    focus.y += (wantY - focus.y) * blend;
    backdrop.follow(focus.x, focus.y - (GROUND_TOP + 5.5));

    const shake = game.shake * game.shake * 0.8;
    const jitterX = (Math.random() - 0.5) * shake;
    const jitterY = (Math.random() - 0.5) * shake;
    camera.position.set(focus.x + eye.x + jitterX, focus.y + eye.y + jitterY, eye.z);
    camera.lookAt(focus.x + jitterX, focus.y + jitterY, 0);
  }

  function drawPlayer(game: Game): void {
    const { body, aimAngle, facing, invuln, alive } = game.player;
    player.group.visible = alive && game.status !== "dead";
    pack.visible = game.player.ability === "jetpack";
    player.group.position.set(body.x, body.y, ACTOR_Z);
    faceFigure(player, facing);
    animateWalk(player, game.player.walkPhase, !body.onGround);
    aimArm(player, aimAngle, facing);
    const blink = invuln > 0 && Math.floor(invuln * 20) % 2 === 0;
    tintFigure(player, 0xff4040, blink ? 0.8 : 0);
  }

  function drawZombies(game: Game): void {
    while (zombiePool.length < Math.min(game.zombies.length, MAX_ZOMBIES)) {
      const figure = buildFigure(ZOMBIE_PALETTE.walker, 1.7);
      zombiePool.push(figure);
      zombieGroup.add(figure.group);
    }
    zombiePool.forEach((figure, index) => {
      const zombie = game.zombies[index];
      if (!zombie) {
        figure.group.visible = false;
        return;
      }
      const breed = BREEDS[zombie.kind];
      const palette = ZOMBIE_PALETTE[zombie.kind];
      figure.group.visible = true;
      figure.group.position.set(zombie.body.x, zombie.body.y, ACTOR_Z);
      figure.group.scale.setScalar(breed.height / PLAYER_HEIGHT);
      faceFigure(figure, zombie.facing);
      animateWalk(figure, zombie.walkPhase, !zombie.body.onGround);
      // Both arms out in front, which is the whole of a zombie's body language.
      aimArm(figure, 0, zombie.facing);
      figure.armBack.rotation.copy(figure.armFront.rotation);
      recolour(figure.torso, palette.shirt);
      recolour(figure.head, palette.skin);
      tintFigure(figure, 0xffffff, zombie.flash > 0 ? 0.9 : 0);
    });
  }

  function drawRope(game: Game): void {
    const { rope: attached, hook } = game.player;
    if (!attached && !hook) {
      rope.visible = false;
      hookHead.visible = false;
      return;
    }
    const ax = attached ? attached.anchorX : (hook?.x ?? 0);
    const ay = attached ? attached.anchorY : (hook?.y ?? 0);
    const ox = game.player.body.x;
    const oy = chestY(game.player);
    const dx = ax - ox;
    const dy = ay - oy;
    rope.visible = true;
    rope.position.set(ox + dx / 2, oy + dy / 2, ACTOR_Z + 0.3);
    rope.rotation.z = Math.atan2(dy, dx);
    rope.scale.x = Math.max(Math.hypot(dx, dy), 0.01);
    hookHead.visible = true;
    hookHead.position.set(ax, ay, ACTOR_Z + 0.3);
    hookHead.rotation.z = rope.rotation.z;
  }

  function drawBullets(game: Game): void {
    const count = Math.min(game.bullets.length, MAX_BULLETS);
    for (let index = 0; index < count; index++) {
      const bullet = game.bullets[index];
      if (!bullet) continue;
      dummy.position.set(bullet.x, bullet.y, ACTOR_Z + 0.2);
      dummy.rotation.set(0, 0, Math.atan2(bullet.vy, bullet.vx));
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bullets.setMatrixAt(index, dummy.matrix);
    }
    bullets.count = count;
    bullets.instanceMatrix.needsUpdate = true;
  }

  function drawParticles(game: Game): void {
    const count = Math.min(game.particles.length, MAX_PARTICLES);
    for (let index = 0; index < count; index++) {
      const particle = game.particles[index];
      if (!particle) continue;
      const fade = particle.life / particle.maxLife;
      dummy.position.set(particle.x, particle.y, ACTOR_Z + 0.2);
      dummy.rotation.set(particle.x, particle.y, particle.life * 6);
      dummy.scale.setScalar(particle.size * (0.4 + fade * 0.6));
      dummy.updateMatrix();
      particles.setMatrixAt(index, dummy.matrix);
      particles.setColorAt(index, colour.setHex(particle.colour));
    }
    particles.count = count;
    particles.instanceMatrix.needsUpdate = true;
    if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
  }

  return {
    render(game, dt) {
      city.update(game.world);
      followPlayer(game, dt);
      drawPlayer(game);
      drawZombies(game);
      drawRope(game);
      drawBullets(game);
      drawParticles(game);
      goalLight.intensity = 34 + Math.sin(game.elapsed * 5) * 16;
      renderer.render(scene, camera);
    },
    resize,
    pointerToWorld(x, y) {
      pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const found = raycaster.ray.intersectPlane(aimPlane, hit);
      return found ? { x: hit.x, y: hit.y } : { x: focus.x, y: focus.y };
    },
    dispose() {
      disposed = true;
      city.dispose();
      renderer.dispose();
    },
  };
}

/**
 * Turning a figure round spins it rather than mirroring it: a negative scale
 * turns its normals inside out and the lighting goes with them. The gun arm
 * is then swapped to the near side by hand, so it never ends up behind the body.
 */
function faceFigure(figure: Figure, facing: number): void {
  const flipped = facing < 0;
  figure.group.rotation.y = flipped ? Math.PI : 0;
  figure.armFront.position.z = flipped ? -0.22 : 0.22;
  figure.armBack.position.z = flipped ? 0.22 : -0.22;
}

/** Points the gun arm along a world-space angle, flip and all. */
function aimArm(figure: Figure, angle: number, facing: number): void {
  const local = facing < 0 ? Math.PI - angle : angle;
  figure.armFront.rotation.z = local + Math.PI / 2;
}

/**
 * Worn rather than built into the figure, since the gear is picked after the
 * renderer exists. It hangs off the *back* along x rather than sitting behind
 * the torso in z: the camera is all but head-on, so anything narrower than the
 * torso and directly behind it is never seen at all.
 *
 * Its materials join the figure's, so it flashes with the body when a zombie
 * lands one.
 */
function buildJetpack(materials: THREE.MeshLambertMaterial[]): THREE.Group {
  const group = new THREE.Group();
  const tankMaterial = new THREE.MeshLambertMaterial({ color: 0x9aa3ae });
  const nozzleMaterial = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  materials.push(tankMaterial, nozzleMaterial);

  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.52, 0.34), tankMaterial);
  tank.position.set(-0.36, 0.98, 0);
  const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.16), nozzleMaterial);
  nozzle.position.set(-0.36, 0.63, 0);

  group.add(tank, nozzle);
  return group;
}

function recolour(mesh: THREE.Mesh, colour: number): void {
  const material = mesh.material;
  if (material instanceof THREE.MeshLambertMaterial) material.color.setHex(colour);
}

function skyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context) {
    // The warm band sits where the horizon lands on screen, not at the very
    // bottom of the image, or the street covers the only interesting colour.
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#111d42");
    gradient.addColorStop(0.4, "#3f4878");
    gradient.addColorStop(0.6, "#9a6470");
    gradient.addColorStop(0.72, "#e0a066");
    gradient.addColorStop(0.85, "#7d5346");
    gradient.addColorStop(1, "#2a2233");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1, 256);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
