import * as THREE from "three";
import { createMenu } from "../ui";
import { ARES_HP, BODY, guarding, makeAres, strikeAres, updateAres, type Ares } from "./ares";
import {
  BODY as SEA_BODY,
  FLOOD_DAMAGE,
  floodLevel,
  makePoseidon,
  POSEIDON_HP,
  strikePoseidon,
  updatePoseidon,
  type Poseidon,
} from "./poseidon";
import { buy, damageTaken, godKit, outfitArmor, outfits, shieldStops, swordPower, wearsFullKit, wornOutfit, type Kit } from "./armor";
import { dist, inArc, yawTo } from "./bearing";
import { createControls } from "./controls";
import {
  ARES_BUILD,
  buildFigure,
  fade,
  flash,
  HERO_BUILD,
  KIT_PAINT,
  poseFigure,
  BANDIT_BUILD,
  FISHER_BUILD,
  HADES_BUILD,
  ZEUS_BUILD,
  KRONOS_BUILD,
  ANGEL_BUILD,
  boltGeometry,
  LAVA_SKELETON_BUILD,
  DROWNED_BUILD,
  SKELETON_BUILD,
  POSEIDON_BUILD,
  SMITH_BUILD,
  SPARTAN_BUILD,
  wearKit,
  type Build,
  type Figure,
} from "./figure";
import { CAM_DIST, CAM_HEIGHT, LOOK_HEIGHT, autoTurn, dragTurn, lockOn, moveFromStick } from "./follow";
import {
  BOUNTY,
  DEAD_FADE,
  GRUNTS,
  makeGrunt,
  STRIKE_TIME,
  strikeGrunt,
  updateGrunt,
  type Blow,
  type Grunt,
  type GruntKind,
} from "./grunts";
import {
  CITY_HEAL,
  face,
  hurtHero,
  makeHero,
  MAX_HP,
  RADIUS,
  shove,
  standing,
  startSwing,
  stepHero,
  SWING_REACH,
  SWING_TIME,
  underBlade,
  type Hero,
} from "./hero";
import { createHud } from "./hud";
import { loadSave, storeSave } from "./save";
import { toon } from "./toon";
import { buildScenery, HORIZON, placeStep, SKY_TOP } from "./scenery";
import { BODY as KRONOS_BODY, KRONOS_HP, makeKronos, SLOW, strikeKronos, updateKronos, type Kronos } from "./kronos";
import {
  BODY as ZEUS_BODY,
  inZeusArena,
  makeZeus,
  OLYMPUS,
  OLYMPUS_STAIR_HALF,
  olympusFooting,
  olympusSlope,
  onOlympus,
  STORM_R,
  STORM_WARN,
  strikeZeus,
  updateZeus,
  DOOR,
  MONUMENT,
  ZEUS_HP,
  ZEUS_RING,
  type Zeus,
} from "./zeus";
import {
  ARRIVAL,
  BODY as HADES_BODY,
  HADES_HP,
  hidden as hadesHidden,
  BREAK_BEHIND,
  COLLAPSE_AT,
  CRUMBLE_SPEED,
  HADES_TRIGGER,
  LOW_Y,
  STAIRS,
  ISLAND_GUARDS,
  ISLANDS,
  HOME_PORTAL,
  inHadesArena,
  inTartarus,
  FIRE_Y,
  QUAKE_WARN,
  tartarusFooting,
  makeHades,
  strikeHades,
  TARTARUS,
  updateHades,
  type Hades,
} from "./hades";
import { atPortal, footing, inVolcano, ISLAND_Y, landing, LANDING_OUT, LAVA_Y, ontoStairs, SAFE_DROP, slopeY, STAIR_HALF, stepY, VOLCANO } from "./volcano";
import {
  ARENA_R,
  BLACKSMITH,
  CAMPS,
  COLOSSEUM,
  FIGHT_TRIGGER,
  FISHERS,
  inArena,
  inCity,
  inHamlet,
  inSeaArena,
  inVillage,
  ISLAND_H,
  layoutWorld,
  onIsland,
  pushOut,
  SEA_ARENA,
  SHOP_RANGE,
  VILLAGE,
} from "./world";

const ARES_SCALE = 1.75;
const START = { x: 0, z: 7, yaw: Math.PI };

// ---------------------------------------------------------------------------
// Stage

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(HORIZON);
scene.fog = new THREE.Fog(HORIZON, 45, 230);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2600);

scene.add(new THREE.HemisphereLight(0xd8ecff, 0x6a8a3a, 1.5));
const sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
// The sun's shadow box rides along with the hero: only what is near casts.
const SUN_OFFSET = new THREE.Vector3(30, 60, 22);
const SHADOW_REACH = 38;
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -SHADOW_REACH;
sun.shadow.camera.right = SHADOW_REACH;
sun.shadow.camera.top = SHADOW_REACH;
sun.shadow.camera.bottom = -SHADOW_REACH;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 160;
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const scenery = buildScenery();
scene.add(scenery.root);
/** The sky goes wherever the camera does, so no corner of the world is ever outside it. */
const skyDome = scenery.root.getObjectByName("sky")!;
const PEOPLE_FAR = 110;
/** Scenery tiles, each culled once it is wholly inside the fog, since it would draw as nothing but haze. */
const tiles: THREE.Mesh[] = [];
scenery.root.traverse((o) => {
  if ((o as THREE.Mesh).isMesh && o.userData.tile) tiles.push(o as THREE.Mesh);
});
for (const t of tiles) t.geometry.computeBoundingSphere();
const world = layoutWorld();

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // A phone held upright sees too narrow a slice at a landscape field of view.
  camera.fov = camera.aspect < 1 ? 72 : 55;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);

// ---------------------------------------------------------------------------
// Bits and pieces every body uses

const shadowTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(20,30,10,0.3)");
  grad.addColorStop(0.6, "rgba(20,30,10,0.12)");
  grad.addColorStop(1, "rgba(20,30,10,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function blob(size: number): THREE.Mesh {
  const m = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.scale.set(size, 1, size);
  m.position.y = 0.07;
  scene.add(m);
  return m;
}

// Sparks: one instanced draw for every hit, clang and coin glint.
const SPARKS = 120;
const sparkMesh = new THREE.InstancedMesh(
  new THREE.OctahedronGeometry(0.09, 0),
  new THREE.MeshBasicMaterial({ color: 0xffffff }),
  SPARKS,
);
sparkMesh.frustumCulled = false;
scene.add(sparkMesh);
interface Spark {
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  color: THREE.Color;
}
const sparks: Spark[] = [];
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
function burst(x: number, y: number, z: number, color: number, count: number, speed = 6, size = 1): void {
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    if (sparks.length >= SPARKS) sparks.shift();
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
    const life = 0.35 + Math.random() * 0.35;
    sparks.push({ p: new THREE.Vector3(x, y, z), v, life, max: life, size, color: c });
  }
}
function updateSparks(dt: number): void {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]!;
    s.life -= dt;
    if (s.life <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    s.v.y -= 14 * dt;
    s.p.addScaledVector(s.v, dt);
    if (s.p.y < 0.05) {
      s.p.y = 0.05;
      s.v.multiplyScalar(0.4);
    }
  }
  for (let i = 0; i < SPARKS; i++) {
    const s = sparks[i];
    if (!s) {
      tmpM.makeScale(0, 0, 0);
    } else {
      const k = (s.life / s.max) * s.size;
      tmpS.set(k, k, k);
      tmpQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, s.life * 10);
      tmpM.compose(s.p, tmpQ, tmpS);
      sparkMesh.setColorAt(i, s.color);
    }
    sparkMesh.setMatrixAt(i, tmpM);
  }
  sparkMesh.instanceMatrix.needsUpdate = true;
  if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// The run

const save = loadSave();
const hud = createHud();
const controls = createControls();
createMenu("Battle of the Gods", {
  onAllGames: () => {
    location.href = "index.html";
  },
});

let hero: Hero = makeHero(START.x, START.z, START.yaw);
const heroFig = buildFigure(HERO_BUILD);
wearKit(heroFig, save.armor);
scene.add(heroFig.root);
const heroShadow = blob(1.3);
let heroFlash = 0;
let blockAnim = 0;

// The blacksmith, hammering away behind the counter.
const smith = buildFigure(SMITH_BUILD);
smith.root.position.set(BLACKSMITH.x + 1.7, 0, BLACKSMITH.z + 1.2);
smith.root.rotation.y = -Math.PI / 2;
smith.root.scale.setScalar(1.1);
scene.add(smith.root);
blob(1.3).position.set(smith.root.position.x, 0.07, smith.root.position.z);

// Fishermen about the village, each leaning on a fishing spear.
const fishers = FISHERS.map((f, i) => {
  const fig = buildFigure(FISHER_BUILD);
  fig.root.position.set(f.x, 0, f.z);
  fig.root.rotation.y = f.yaw;
  fig.walk = i * 1.7;
  scene.add(fig.root);
  blob(1.2).position.set(f.x, 0.07, f.z);
  return fig;
});

interface Foe {
  g: Grunt;
  fig: Figure;
  build: Build;
  shadow: THREE.Mesh;
  flash: number;
  /** Which camp it belongs to, or -1 for Ares's soldiers. */
  camp: number;
  /** Knocked off an island in Tartarus: how high it is on the way down to the fire. */
  drop?: number;
}
let foes: Foe[] = [];
let nextId = 1;

const BUILDS: Record<GruntKind, Build> = {
  bandit: BANDIT_BUILD,
  skeleton: SKELETON_BUILD,
  lava: LAVA_SKELETON_BUILD,
  drowned: DROWNED_BUILD,
  spartan: SPARTAN_BUILD,
};

function addFoe(kind: GruntKind, x: number, z: number, yaw: number, camp: number): Foe {
  const build = BUILDS[kind];
  const fig = buildFigure(build);
  if (kind === "spartan") {
    wearKit(fig, { helmet: "bronze", chest: "bronze", arms: "none", legs: "bronze" });
    fig.crest.color.setHex(0xa3241e);
  }
  scene.add(fig.root);
  const g = makeGrunt(nextId++, kind, x, z, yaw);
  const foe: Foe = { g, fig, build, shadow: blob(1.1), flash: 0, camp };
  foes.push(foe);
  return foe;
}

function removeFoe(f: Foe): void {
  scene.remove(f.fig.root);
  scene.remove(f.shadow);
  foes = foes.filter((o) => o !== f);
}

/** Fill a camp back up to strength, so the road is never safe. */
function stockCamp(i: number): void {
  const camp = CAMPS[i]!;
  const have = foes.filter((f) => f.camp === i).length;
  for (let n = have; n < camp.count; n++) {
    const a = (n / camp.count) * Math.PI * 2 + i;
    addFoe("bandit", camp.x + Math.sin(a) * 2.2, camp.z + Math.cos(a) * 2.2, a, i);
  }
}
CAMPS.forEach((_, i) => stockCamp(i));

/** The skeletons that walk the volcano's stairs, as a camp of their own. */
const STAIR_CAMP = 99;
const STAIR_POSTS = [18, 24, 30, 36, 43];
const pacing = new Map<number, number>();
function stockStairs(): void {
  const have = foes.filter((f) => f.camp === STAIR_CAMP).length;
  for (let n = have; n < STAIR_POSTS.length; n++) {
    const f = addFoe("skeleton", VOLCANO.x + STAIR_POSTS[n]!, VOLCANO.z + (n % 2 ? 0.6 : -0.6), Math.PI / 2, STAIR_CAMP);
    pacing.set(f.g.id, n % 2 ? 1 : -1);
  }
}
stockStairs();

/** Skeletons guarding Tartarus's islands, a camp per island. */
const HELL_CAMP = 200;
function stockHell(): void {
  ISLANDS.forEach((isl, n) => {
    const have = foes.filter((f) => f.camp === HELL_CAMP + n).length;
    for (let k = have; k < ISLAND_GUARDS[n]!; k++) {
      const a = (k / ISLAND_GUARDS[n]!) * Math.PI * 2 + n;
      addFoe("skeleton", isl.x + Math.sin(a) * isl.r * 0.45, isl.z + Math.cos(a) * isl.r * 0.45, a, HELL_CAMP + n);
    }
  });
}
stockHell();

/** How high a foe stands: up the volcano's stairs, down in Tartarus, or on the ground. */
function foeY(f: Foe): number {
  if (f.drop !== undefined) return f.drop;
  if (f.camp === STAIR_CAMP) return stepY(f.g.x - VOLCANO.x);
  return inTartarus(f.g.x, f.g.z) ? (tartarusFooting(f.g.x, f.g.z, stairsBroken) ?? TARTARUS.y) : 0;
}

/** Keep a stair skeleton on its stairs, whatever it is chasing. */
function onStairs(g: Grunt): void {
  g.x = Math.min(VOLCANO.x + VOLCANO.r - 1, Math.max(VOLCANO.x + LANDING_OUT + 0.5, g.x));
  g.z = Math.min(VOLCANO.z + STAIR_HALF - 0.4, Math.max(VOLCANO.z - STAIR_HALF + 0.4, g.z));
}

// Ares and his arena.
type Fight = "waiting" | "on" | "won";
let fight: Fight = save.beaten.includes("ares") ? "won" : "waiting";
let ares: { a: Ares; fig: Figure; shadow: THREE.Mesh; flash: number; stars: THREE.Group } | null = null;
let gateClosed = false;
let reward: { mesh: THREE.Group; x: number; z: number; kit: GodKit } | null = null;
type GodKit = Exclude<Kit, "none" | "bronze">;

// Poseidon and his.
const SEA_SCALE = 1.75;
let seaFight: Fight = save.beaten.includes("poseidon") ? "won" : "waiting";
let seaGateClosed = false;
let poseidon: { p: Poseidon; fig: Figure; shadow: THREE.Mesh; flash: number; spear: THREE.Group } | null = null;
let floodSting = 0;

/** The thrown trident, flying on its own. */
function thrownTrident(): THREE.Group {
  const g = new THREE.Group();
  const gold = toon(0xe8b83e, { emissive: 0x302008 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), toon(0x7a5232));
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.07, 0.07), gold);
  bar.position.z = 1.6;
  g.add(bar);
  for (const x of [-0.26, 0, 0.26]) {
    const prong = new THREE.Mesh(new THREE.ConeGeometry(0.07, x === 0 ? 0.9 : 0.7, 8), gold);
    prong.rotation.x = Math.PI / 2;
    prong.position.set(x, 0, 1.6 + (x === 0 ? 0.45 : 0.35));
    g.add(prong);
  }
  g.visible = false;
  scene.add(g);
  return g;
}

function startSeaFight(): void {
  seaFight = "on";
  seaGateClosed = true;
  const fig = buildFigure(POSEIDON_BUILD);
  fig.root.scale.setScalar(SEA_SCALE);
  scene.add(fig.root);
  const yaw = SEA_ARENA.yaw + Math.PI;
  const p = makePoseidon(SEA_ARENA.x + Math.sin(yaw) * 7, SEA_ARENA.z + Math.cos(yaw) * 7, SEA_ARENA.yaw);
  poseidon = { p, fig, shadow: blob(2.4), flash: 0, spear: thrownTrident() };
  hud.banner("POSEIDON", "God of the Sea");
  hud.setBoss("Poseidon, God of the Sea", 1);
  shake = 0.4;
}

function clearPoseidon(): void {
  if (!poseidon) return;
  scene.remove(poseidon.fig.root);
  scene.remove(poseidon.shadow);
  scene.remove(poseidon.spear);
  poseidon = null;
}

function endSeaFight(): void {
  clearPoseidon();
  seaGateClosed = false;
  scenery.flood.visible = false;
  hud.setBoss(null, 0);
}

function poseidonFalls(): void {
  if (!poseidon) return;
  seaFight = "won";
  hud.banner("Poseidon is beaten!", "Claim his armor", 3.5);
  hud.setBoss(null, 0);
  shake = 0.7;
  stop = 0.25;
  burst(poseidon.p.x, 2, poseidon.p.z, 0x6fe0ff, 40, 10, 1.6);
  seaGateClosed = false;
  scenery.flood.visible = false;
  for (const f of foes) if (f.camp === -1 && f.g.state !== "dead") {
    f.g.state = "dead";
    f.g.t = 0;
  }
  spawnReward(poseidon.p.x, poseidon.p.z, "poseidon");
}

function makeStars(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe14a });
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mat);
    const a = (i / 4) * Math.PI * 2;
    s.position.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5);
    g.add(s);
  }
  g.visible = false;
  scene.add(g);
  return g;
}

function startFight(): void {
  fight = "on";
  gateClosed = true;
  const fig = buildFigure(ARES_BUILD);
  wearKit(fig, godKit("ares"));
  fig.root.scale.setScalar(ARES_SCALE);
  scene.add(fig.root);
  ares = { a: makeAres(COLOSSEUM.x, COLOSSEUM.z - 9, 0), fig, shadow: blob(2.4), flash: 0, stars: makeStars() };
  hud.banner("ARES", "God of War");
  hud.setBoss("Ares, God of War", 1);
  shake = 0.4;
}

function endFight(): void {
  if (ares) {
    scene.remove(ares.fig.root);
    scene.remove(ares.shadow);
    scene.remove(ares.stars);
  }
  ares = null;
  for (const f of foes.filter((f) => f.camp === -1)) removeFoe(f);
  gateClosed = false;
  hud.setBoss(null, 0);
  endSeaFight();
}

function spawnReward(x: number, z: number, kit: GodKit): void {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 30, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd860, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 15;
  g.add(beam);
  // The armour itself, floating in the light: the god's helmet over his breastplate.
  const paint = KIT_PAINT[kit];
  const armour = new THREE.Group();
  const metal = toon(paint.metal, { emissive: 0x401008 });
  const trim = toon(paint.trim, { emissive: 0x403010 });
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal);
  helm.position.y = 1.15;
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.8), toon(paint.crest));
  crest.position.y = 1.65;
  const plate = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.35, 4, 12), metal);
  plate.scale.z = 0.75;
  const pads = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.4), trim);
  pads.position.y = 0.42;
  armour.add(helm, crest, plate, pads);
  armour.position.y = 1.2;
  g.add(armour);
  g.position.set(x, 0, z);
  scene.add(g);
  reward = { mesh: g, x, z, kit };
}

// Loose coins.
interface Coin {
  mesh: THREE.Mesh;
  v: THREE.Vector3;
  age: number;
}
const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14).rotateX(Math.PI / 2);
const coinMat = new THREE.MeshToonMaterial({ color: 0xffcc33, emissive: 0x6a4a00 });
let coins: Coin[] = [];
function dropCoins(x: number, z: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.position.set(x, 1.2, z);
    const a = Math.random() * Math.PI * 2;
    const v = new THREE.Vector3(Math.sin(a) * 2.5, 6 + Math.random() * 2, Math.cos(a) * 2.5);
    scene.add(mesh);
    coins.push({ mesh, v, age: 0 });
  }
}

// ---------------------------------------------------------------------------
// Feel

let shake = 0;
let stop = 0; // hit-stop: the world holds still for a beat when a blow lands
let camYaw = START.yaw;
let devZoom = 1;
let lastDrag = -10;
let clock = 0;
let leftTown = false;
let wasInVillage = false;
/** How high the hero stands: off the ground only on the volcano and the flood islands. */
let heroY = 0;
let shownY = 0;
/** A fall off the volcano in progress: how fast, and where it ends. */
let falling: { vy: number; y: number; lava: boolean; landed: boolean; slide?: { x: number; z: number; r: number; slope: (d: number) => number } } | null = null;
let hadesFight: Fight = save.beaten.includes("hades") ? "won" : "waiting";
let hades: { h: Hades; fig: Figure; shadow: THREE.Mesh; flash: number } | null = null;
let hadesGateClosed = false;
let triedDoor = false;

// ---------------------------------------------------------------------------
// Zeus

let zeusFight: Fight = save.beaten.includes("zeus") ? "won" : "waiting";
let zeusGateClosed = false;
let zeus: { z: Zeus; fig: Figure; shadow: THREE.Mesh; flash: number; bolt: THREE.Mesh } | null = null;
const boltGlow = new THREE.MeshBasicMaterial({ color: 0xfff27a });
/** Lightning on its way: a ring on the floor, then a bolt from the sky for a moment. */
let strikes: Array<{ ring: THREE.Mesh; flash: THREE.Mesh; t: number }> = [];
const strikeRing = new THREE.RingGeometry(STORM_R - 0.4, STORM_R, 28).rotateX(-Math.PI / 2);
const strikeBeam = new THREE.CylinderGeometry(0.25, 0.5, 40, 6);

function warnStrikes(spots: Array<{ x: number; z: number }>): void {
  for (const p of spots) {
    const ring = new THREE.Mesh(strikeRing, new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.8 }));
    ring.position.set(p.x, 0.05, p.z);
    const flashBeam = new THREE.Mesh(strikeBeam, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
    flashBeam.position.set(p.x, 20, p.z);
    flashBeam.visible = false;
    scene.add(ring, flashBeam);
    strikes.push({ ring, flash: flashBeam, t: 0 });
  }
}
function clearStrikes(): void {
  for (const s of strikes) scene.remove(s.ring, s.flash);
  strikes = [];
}

function startZeusFight(): void {
  zeusFight = "on";
  zeusGateClosed = true;
  const fig = buildFigure(ZEUS_BUILD);
  fig.root.scale.setScalar(1.8);
  scene.add(fig.root);
  const bolt = new THREE.Mesh(boltGeometry(), boltGlow);
  bolt.scale.setScalar(2.4);
  bolt.visible = false;
  scene.add(bolt);
  zeus = { z: makeZeus(ZEUS_RING.x, ZEUS_RING.z + 7, Math.PI), fig, shadow: blob(2.4), flash: 0, bolt };
  hud.banner("ZEUS", "King of the Gods", 2.6);
  hud.setBoss("Zeus, King of the Gods", 1);
  shake = 0.4;
}

function clearZeus(): void {
  if (!zeus) return;
  scene.remove(zeus.fig.root, zeus.shadow, zeus.bolt);
  zeus = null;
}

function endZeusFight(): void {
  clearZeus();
  clearStrikes();
  zeusGateClosed = false;
  if (zeusFight === "on") zeusFight = "waiting";
}

function zeusFalls(): void {
  if (!zeus) return;
  zeusFight = "won";
  zeusGateClosed = false;
  clearStrikes();
  hud.banner("Zeus is beaten!", "Claim his armor", 3.5);
  hud.setBoss(null, 0);
  shake = 0.8;
  stop = 0.25;
  burst(zeus.z.x, 2, zeus.z.z, 0xfff27a, 50, 11, 1.6);
  spawnReward(zeus.z.x, zeus.z.z, "zeus");
  breakBack();
}

// The back of Zeus's colosseum: shut until he falls, then knocked out toward the mountain.
let backFall = -1;
const backVel = scenery.zeusBack.homes.map((_, i) => new THREE.Vector3(((i * 7919) % 100) / 25 - 2, 3 + ((i * 104729) % 100) / 20, -4 - ((i * 1299709) % 100) / 14));
if (zeusFight === "won") scenery.zeusBack.group.visible = false;
function breakBack(): void {
  backFall = clock;
  window.setTimeout(() => hud.banner("The back wall broke!", "Stairs up Mount Olympus!", 3), 1200);
}
function stepBack(): void {
  if (backFall < 0) return;
  const t = clock - backFall;
  const { blocks, homes } = scenery.zeusBack;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  homes.forEach((home, i) => {
    const v = backVel[i]!;
    const p = new THREE.Vector3(home.x + v.x * t, Math.max(0.6, home.y + v.y * t - 9 * t * t), home.z + v.z * t);
    q.setFromEuler(new THREE.Euler(t * v.z * 0.4, 0, t * v.x * 0.5));
    m.compose(p, q, new THREE.Vector3(1.2, 1.2, ZEUS_RING.thick + 0.4));
    blocks.setMatrixAt(i, m);
  });
  blocks.instanceMatrix.needsUpdate = true;
  if (t > 3.5) {
    scenery.zeusBack.group.visible = false;
    backFall = -1;
  }
}

// ---------------------------------------------------------------------------
// The angels of Olympia: some walk the square, some fly over it.

interface Angel {
  fig: Figure;
  wings: THREE.Group[];
  flying: boolean;
  r: number;
  a: number;
  speed: number;
  height: number;
}
const angelHalo = new THREE.MeshBasicMaterial({ color: 0xffe066 });
const angelFeather = toon(0xffffff, { emissive: 0x202020 });
const angels: Angel[] = [];
for (let i = 0; i < 12; i++) {
  const fig = buildFigure({ ...ANGEL_BUILD, hair: [0xf2c94c, 0x7a4421, 0x2b1d14, 0xe8e0d0][i % 4]!, skin: [0xf3d2b0, 0xc68a5a, 0x8a5a3a, 0xf1c27d][(i + 1) % 4]! });
  fig.sword.visible = false;
  const wings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.12, 1.32, -0.16);
    for (const [len, up, out] of [
      [0.7, 0.18, 0.42],
      [0.5, -0.05, 0.32],
    ] as const) {
      const feather = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), angelFeather);
      feather.scale.set(len * 0.62, len * 0.32, 0.04);
      feather.position.set(side * out, up, 0);
      feather.rotation.z = side * 0.45;
      pivot.add(feather);
    }
    fig.root.add(pivot);
    wings.push(pivot);
  }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 20), angelHalo);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 2.08;
  fig.root.add(halo);
  scene.add(fig.root);
  const flying = i % 3 === 0;
  angels.push({ fig, wings, flying, r: flying ? 9 + i : 12 + (i % 4) * 2.5, a: i * 1.3, speed: (i % 2 ? 1 : -1) * (flying ? 0.25 : 0.12), height: flying ? 3 + (i % 3) : 0 });
}

function updateAngels(dt: number): void {
  // A dozen winged figures are a lot to draw; only bother once the hero is on the way up.
  const near = dist(hero.x, hero.z, OLYMPUS.x, OLYMPUS.z) < OLYMPUS.r + 10;
  for (const g of angels) {
    g.fig.root.visible = near;
    if (!near) continue;
    g.a += g.speed * dt;
    const x = OLYMPUS.x + Math.sin(g.a) * g.r;
    const z = OLYMPUS.z + Math.cos(g.a) * g.r;
    const bob = g.flying ? Math.sin(clock * 2 + g.r) * 0.4 : 0;
    g.fig.root.position.set(x, OLYMPUS.h + g.height + bob, z);
    // Facing along the way round the circle.
    g.fig.root.rotation.y = g.a + (g.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
    poseFigure(g.fig, dt, { speed: g.flying ? 0 : Math.abs(g.speed) * g.r });
    const beat = g.flying ? Math.sin(clock * 9 + g.r) * 0.5 : Math.sin(clock * 1.5 + g.r) * 0.12;
    g.wings[0]!.rotation.y = 0.35 + beat;
    g.wings[1]!.rotation.y = -0.35 - beat;
  }
}

/** With Zeus's whole kit on, the hero's sword is a lightning bolt. */
const heroBolt = new THREE.Mesh(boltGeometry(), boltGlow);
heroBolt.position.y = 0.05;
heroFig.sword.add(heroBolt);
function armHero(): void {
  const lightning = wearsFullKit(save.armor, "zeus");
  for (const c of heroFig.sword.children) c.visible = c === heroBolt ? lightning : !lightning;
}
armHero();

// ---------------------------------------------------------------------------
// Kronos, behind the monument's door

let kronosFight: Fight = save.beaten.includes("kronos") ? "won" : "waiting";
let kronos: { k: Kronos; fig: Figure; shadow: THREE.Mesh; flash: number } | null = null;
/** How far open the monument's doors are, 0..1. */
let doorsOpen = kronosFight === "won" ? 1 : 0;

function startKronos(): void {
  kronosFight = "on";
  const fig = buildFigure(KRONOS_BUILD);
  fig.root.scale.setScalar(2.0);
  scene.add(fig.root);
  kronos = { k: makeKronos(MONUMENT.x, MONUMENT.z - MONUMENT.d / 2 + 1, Math.PI), fig, shadow: blob(2.6), flash: 0 };
  shake = 0.7;
  hud.banner("KRONOS", "Titan of Time — the doors burst open!", 2.6);
  hud.setBoss("Kronos, Titan of Time", 1);
}

function clearKronos(): void {
  if (!kronos) return;
  scene.remove(kronos.fig.root, kronos.shadow);
  kronos = null;
}

function endKronosFight(): void {
  clearKronos();
  if (kronosFight === "on") {
    kronosFight = "waiting";
    doorsOpen = 0;
  }
}

function kronosFalls(): void {
  if (!kronos) return;
  kronosFight = "won";
  hud.banner("Kronos is beaten!", "Claim his armor", 3.5);
  hud.setBoss(null, 0);
  shake = 0.9;
  stop = 0.3;
  burst(kronos.k.x, OLYMPUS.h + 2.5, kronos.k.z, 0xb88aff, 50, 11, 1.8);
  spawnReward(kronos.k.x, kronos.k.z, "kronos");
  reward!.mesh.position.y = OLYMPUS.h;
}

// ---------------------------------------------------------------------------
// The fire monster on the last staircase

/** Stairs from here down toward the island are gone; Infinity while they stand. */
let stairsBroken = Infinity;
/** When each broken step started to fall, by step. */
let stepFalls: number[] = [];
const LAVA_CAMP = 300;
let collapse: { t: number; at: number; broke: boolean; spawned: boolean } | null = null;
/** When the bottom step went, so the break can run up from there. */
let crumbleStart = -1;
let crumbleTo = Infinity;
let collapsedThisVisit = false;

/** A giant of black rock split by fire, built facing -z, toward the stairs. Its right arm is `userData.arm`. */
function fireMonster(): THREE.Group {
  const g = new THREE.Group();
  const rock = toon(0x2a1a14);
  const glow = new THREE.MeshBasicMaterial({ color: 0xff6a1e });
  const hot = new THREE.MeshBasicMaterial({ color: 0xffd060 });
  const torso = new THREE.Mesh(new THREE.IcosahedronGeometry(4, 0), rock);
  torso.scale.set(1, 1.3, 0.8);
  torso.position.y = 7;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 0), rock);
  head.position.set(0, 13, -0.6);
  g.add(torso, head);
  // Cracks of fire through the rock, and two burning eyes.
  for (let k = 0; k < 9; k++) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6 + (k % 3), 0.25), glow);
    const a = k * 2.3;
    crack.position.set(Math.sin(a) * 2.6, 5 + (k % 4) * 1.6, -Math.abs(Math.cos(a)) * 2.6 - 0.4);
    crack.rotation.z = k;
    g.add(crack);
  }
  for (const side of [-0.7, 0.7]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), hot);
    eye.position.set(side, 13.3, -2.3);
    g.add(eye);
  }
  // A crown of flame.
  for (let k = 0; k < 5; k++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.4, 7), k % 2 ? glow : hot);
    f.position.set((k - 2) * 0.7, 15, -0.4 + Math.abs(k - 2) * 0.3);
    g.add(f);
  }
  // Arms on shoulder pivots; the right one is the one that smashes.
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 4, 10, -1);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 6, 7), rock);
    arm.position.y = 3;
    const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), rock);
    fist.position.y = 6.6;
    pivot.add(arm, fist);
    // Fire showing through the fist's faces.
    fist.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), glow));
    g.add(pivot);
    arms.push(pivot);
  }
  arms[0]!.rotation.x = 2.6; // the left arm hangs down
  g.userData.arm = arms[1];
  g.visible = false;
  scene.add(g);
  return g;
}
const monster = fireMonster();
const MONSTER_Z = TARTARUS.z + 9;

function startCollapse(): void {
  collapsedThisVisit = true;
  collapse = { t: 0, at: hero.x + BREAK_BEHIND, broke: false, spawned: false };
  monster.visible = true;
  monster.position.set(STAIRS.x1 - 3, FIRE_Y - 16, MONSTER_Z);
  shake = 0.4;
  hud.banner("Something is coming out of the fire!", "Keep climbing!", 2);
}

/** Start the break at the foot of the stairs; it runs up to `at`, and each step falls as it reaches it. */
function breakStairs(at: number): void {
  crumbleStart = clock;
  crumbleTo = at;
  stairsBroken = STAIRS.x1;
  stepFalls = scenery.hellStairs.xs.map((x) => (x > at ? clock + (STAIRS.x1 - x) / CRUMBLE_SPEED : -1));
}

/** Where the break has got to by now, climbing from the foot toward the hero. */
function crumble(): void {
  if (crumbleStart < 0) return;
  stairsBroken = Math.max(crumbleTo, STAIRS.x1 - (clock - crumbleStart) * CRUMBLE_SPEED);
}

function mendStairs(): void {
  stairsBroken = Infinity;
  crumbleStart = -1;
  crumbleTo = Infinity;
  stepFalls = [];
  scenery.hellStairs.xs.forEach((_, i) => placeStep(scenery.hellStairs, i));
  monster.visible = false;
  collapse = null;
  collapsedThisVisit = false;
  for (const f of foes.filter((f) => f.camp === LAVA_CAMP)) removeFoe(f);
}

/** The monster's moment: up out of the fire, arm back, the blow, lava skeletons, and back down. */
function stepCollapse(dt: number): void {
  if (!collapse) return;
  const c = collapse;
  c.t += dt;
  // It stands by the foot of the stairs, and that is where the blow lands.
  const stairY = tartarusFooting(STAIRS.x1 - 2, TARTARUS.z) ?? LOW_Y;
  // Stood so the fist comes down on the top of the steps.
  const standY = stairY - 6.5;
  const arm = monster.userData.arm as THREE.Group;
  if (c.t < 1.4) monster.position.y = FIRE_Y - 16 + (standY - FIRE_Y + 16) * Math.sin((c.t / 1.4) * (Math.PI / 2));
  else if (c.t < 4.5) monster.position.y = standY;
  else monster.position.y = standY - (c.t - 4.5) * 12;
  if (c.t < 1.4) arm.rotation.x = 0.2;
  else if (c.t < 2.0) arm.rotation.x = 0.2 + ((c.t - 1.4) / 0.6) * 0.5;
  else if (c.t < 2.3) arm.rotation.x = 0.7 - ((c.t - 2.0) / 0.3) * 2.9;
  else if (c.t > 3.4) arm.rotation.x = Math.min(0.2, -2.2 + (c.t - 3.4) * 2.4);
  if (Math.random() < 0.5) burst(monster.position.x + (Math.random() - 0.5) * 6, monster.position.y + 8 + Math.random() * 6, MONSTER_Z, 0xff8a1e, 1, 3, 0.9);
  if (!c.broke && c.t >= 2.3) {
    c.broke = true;
    breakStairs(c.at);
    shake = 0.9;
    stop = 0.12;
    burst(STAIRS.x1 - 2, stairY + 0.5, TARTARUS.z, 0xff6a1e, 30, 9, 1.5);
    hud.banner("The stairs are falling!", "Run up!", 1.6);
  }
  if (!c.spawned && c.t >= 2.9) {
    c.spawned = true;
    // Lava skeletons climb out onto the steps above.
    for (let k = 1; k <= 4; k++) {
      const x = Math.max(STAIRS.x0 + 1, c.at - BREAK_BEHIND - 3 - k * 3.5);
      const f = addFoe("lava", x, TARTARUS.z + (k % 2 ? 0.7 : -0.7), Math.PI / 2, LAVA_CAMP);
      f.g.state = "walk";
      burst(x, (tartarusFooting(x, TARTARUS.z) ?? LOW_Y) + 0.5, TARTARUS.z, 0xff6a1e, 16, 6);
    }
    hud.banner("Lava skeletons!", "Fight your way up!", 1.8);
  }
  if (c.t >= 6) {
    monster.visible = false;
    collapse = null;
  }
}

/** Stalactites on their way down: a warning ring on the floor, then the rock itself. */
const ROOF_Y = TARTARUS.y + 10.5;
const dropGeo = new THREE.ConeGeometry(0.55, 2.4, 7).rotateX(Math.PI);
const dropMat = toon(0x4a3e48);
const ringGeo = new THREE.RingGeometry(1.0, 1.5, 28).rotateX(-Math.PI / 2);
let drops: Array<{ ring: THREE.Mesh; rock: THREE.Mesh; t: number }> = [];
function warnDrops(spots: Array<{ x: number; z: number }>): void {
  for (const p of spots) {
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.8 }));
    ring.position.set(p.x, TARTARUS.y + 0.04, p.z);
    const rock = new THREE.Mesh(dropGeo, dropMat);
    rock.position.set(p.x, ROOF_Y, p.z);
    rock.castShadow = true;
    scene.add(ring, rock);
    drops.push({ ring, rock, t: 0 });
  }
}
function clearDrops(): void {
  for (const d of drops) scene.remove(d.ring, d.rock);
  drops = [];
}

/** Down below the light changes: a red-black sky and close, dark air. */
function underworld(on: boolean): void {
  const fog = scene.fog as THREE.Fog;
  fog.color.setHex(on ? 0x1a0a10 : HORIZON);
  fog.near = on ? 18 : 45;
  fog.far = on ? 95 : 230;
  (scene.background as THREE.Color).setHex(on ? 0x1a0a10 : HORIZON);
  scenery.sky.uniforms.top!.value.setHex(on ? 0x080306 : SKY_TOP);
  scenery.sky.uniforms.horizon!.value.setHex(on ? 0x4a1018 : HORIZON);
}

function intoTartarus(): void {
  burst(hero.x, heroY + 1.5, hero.z, 0xb88aff, 30, 6, 1.2);
  hero.x = ARRIVAL.x;
  hero.z = ARRIVAL.z;
  hero.yaw = ARRIVAL.yaw;
  hero.vx = hero.vz = 0;
  camYaw = ARRIVAL.yaw;
  heroY = tartarusFooting(hero.x, hero.z, stairsBroken) ?? TARTARUS.y;
  camPos.set(0, 0, 0);
  camLook.set(0, 0, 0);
  underworld(true);
  burst(hero.x, heroY + 1.5, hero.z, 0xb88aff, 30, 6, 1.2);
  hud.banner("Tartarus", hadesFight === "won" ? "Hades is beaten. His portal leads home" : "Climb the stairs to Hades's colosseum", 2.8);
}

function outOfTartarus(): void {
  hero.x = VOLCANO.x + 3;
  hero.z = VOLCANO.z;
  hero.yaw = Math.PI / 2;
  camYaw = hero.yaw;
  heroY = ISLAND_Y;
  camPos.set(0, 0, 0);
  camLook.set(0, 0, 0);
  underworld(false);
  burst(hero.x, heroY + 1.5, hero.z, 0xb88aff, 30, 6, 1.2);
}

function startHadesFight(): void {
  hadesFight = "on";
  hadesGateClosed = true;
  const fig = buildFigure(HADES_BUILD);
  fig.root.scale.setScalar(1.8);
  scene.add(fig.root);
  hades = { h: makeHades(TARTARUS.x - 8, TARTARUS.z, Math.PI / 2), fig, shadow: blob(2.4), flash: 0 };
  hud.banner("HADES", "Lord of the Underworld", 2.6);
  hud.setBoss("Hades, Lord of the Underworld", 1);
  shake = 0.4;
}

function clearHades(): void {
  if (!hades) return;
  scene.remove(hades.fig.root);
  scene.remove(hades.shadow);
  hades = null;
}

function hadesFalls(): void {
  if (!hades) return;
  hadesFight = "won";
  hadesGateClosed = false;
  clearDrops();
  hud.banner("Hades is beaten!", "Claim his armor", 3.5);
  hud.setBoss(null, 0);
  shake = 0.7;
  stop = 0.25;
  burst(hades.h.x, TARTARUS.y + 2, hades.h.z, 0x5fe08a, 40, 10, 1.6);
  for (const f of foes) if (f.camp === -1 && f.g.state !== "dead") {
    f.g.state = "dead";
    f.g.t = 0;
  }
  spawnReward(hades.h.x, hades.h.z, "hades");
  reward!.mesh.position.y = TARTARUS.y;
  scenery.portals[1]!.visible = true;
}
let fallTimer = 0;
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();

function heroLoses(blow: Blow): void {
  if (!standing(hero) || hero.hurt > 0) return;
  if (shieldStops(hero.blocking, hero.yaw, hero, blow)) {
    const sx = hero.x + Math.sin(hero.yaw) * 0.6;
    const sz = hero.z + Math.cos(hero.yaw) * 0.6;
    burst(sx, 1.3, sz, 0xfff2a0, 10, 6);
    shove(hero, blow.x, blow.z, blow.heavy ? 14 : 5);
    hero.hurt = 0.25;
    stop = 0.06;
    shake = Math.max(shake, blow.heavy ? 0.35 : 0.12);
    return;
  }
  hurtHero(hero, damageTaken(blow.damage, save.armor), blow.x, blow.z, blow.heavy);
  heroFlash = 1;
  stop = 0.08;
  shake = Math.max(shake, blow.heavy ? 0.5 : 0.25);
  burst(hero.x, 1.2, hero.z, 0xff5040, 8, 5);
  if (!standing(hero)) {
    fallTimer = 0;
    hud.banner("You fell!", "Back to the city to heal up", 2.6);
  }
}

function swingLands(): void {
  const power = swordPower(save.armor);
  let hitAny = false;
  for (const f of foes) {
    if (!underBlade(hero, f.g.x, f.g.z, 0.5)) continue;
    const result = strikeGrunt(f.g, power, hero.x, hero.z);
    if (result === "none") continue;
    hitAny = true;
    f.flash = 1;
    burst(f.g.x, 1.2, f.g.z, f.g.kind === "bandit" ? 0xd9b98a : 0xffd27a, result === "hurt" ? 8 : 16, 6);
    if (result === "dead") dropCoins(f.g.x, f.g.z, BOUNTY[f.g.kind]);
  }
  if (ares && underBlade(hero, ares.a.x, ares.a.z, BODY)) {
    const result = strikeAres(ares.a, power, hero.x, hero.z);
    const ax = ares.a.x;
    const az = ares.a.z;
    if (result === "clang") {
      // Rings off his shield: sparks, and the hero is knocked back a step.
      burst(ax + Math.sin(ares.a.yaw) * 1.2, 1.8, az + Math.cos(ares.a.yaw) * 1.2, 0xfff2a0, 14, 7);
      shove(hero, ax, az, 7);
      stop = 0.07;
      hitAny = true;
    } else if (result !== "none") {
      ares.flash = 1;
      hitAny = true;
      burst(ax, 2.2, az, 0xff6a40, 14, 7);
      hud.setBoss("Ares, God of War", ares.a.hp / ARES_HP);
      if (result === "dead") aresFalls();
    }
  }
  if (kronos && kronos.k.state !== "emerge" && underBlade(hero, kronos.k.x, kronos.k.z, KRONOS_BODY)) {
    const k = kronos.k;
    const result = strikeKronos(k, power, hero.x, hero.z);
    if (result === "clang") {
      burst(k.x + Math.sin(k.yaw) * 1.3, OLYMPUS.h + 2, k.z + Math.cos(k.yaw) * 1.3, 0xd8c8ff, 14, 7);
      shove(hero, k.x, k.z, 8);
      stop = 0.07;
      hitAny = true;
    } else if (result !== "none") {
      kronos.flash = 1;
      hitAny = true;
      burst(k.x, OLYMPUS.h + 2.4, k.z, 0xb88aff, 14, 7);
      hud.setBoss("Kronos, Titan of Time", k.hp / KRONOS_HP);
      if (result === "dead") kronosFalls();
    }
  }
  if (zeus && underBlade(hero, zeus.z.x, zeus.z.z, ZEUS_BODY)) {
    const zz = zeus.z;
    const result = strikeZeus(zz, power, hero.x, hero.z);
    if (result === "clang") {
      burst(zz.x + Math.sin(zz.yaw) * 1.2, 1.8, zz.z + Math.cos(zz.yaw) * 1.2, 0xfff27a, 14, 7);
      shove(hero, zz.x, zz.z, 7);
      stop = 0.07;
      hitAny = true;
    } else if (result !== "none") {
      zeus.flash = 1;
      hitAny = true;
      burst(zz.x, 2.2, zz.z, 0x8fd8ff, 14, 7);
      hud.setBoss("Zeus, King of the Gods", zz.hp / ZEUS_HP);
      if (result === "dead") zeusFalls();
    }
  }
  if (hades && underBlade(hero, hades.h.x, hades.h.z, HADES_BODY)) {
    const h = hades.h;
    const result = strikeHades(h, power, hero.x, hero.z);
    if (result === "clang") {
      burst(h.x + Math.sin(h.yaw) * 1.2, TARTARUS.y + 1.8, h.z + Math.cos(h.yaw) * 1.2, 0x9fffc0, 14, 7);
      shove(hero, h.x, h.z, 7);
      stop = 0.07;
      hitAny = true;
    } else if (result !== "none") {
      hades.flash = 1;
      hitAny = true;
      burst(h.x, TARTARUS.y + 2.2, h.z, 0x5fe08a, 14, 7);
      hud.setBoss("Hades, Lord of the Underworld", h.hp / HADES_HP);
      if (result === "dead") hadesFalls();
    }
  }
  if (poseidon && underBlade(hero, poseidon.p.x, poseidon.p.z, SEA_BODY)) {
    const p = poseidon.p;
    const result = strikePoseidon(p, power, hero.x, hero.z);
    if (result === "clang") {
      // Turned aside by the trident, or by the sea itself while it is up.
      burst(p.x + Math.sin(p.yaw) * 1.2, 1.8, p.z + Math.cos(p.yaw) * 1.2, p.state === "flood" ? 0x9fe8ff : 0xfff2a0, 14, 7);
      shove(hero, p.x, p.z, 7);
      stop = 0.07;
      hitAny = true;
    } else if (result !== "none") {
      poseidon.flash = 1;
      hitAny = true;
      burst(p.x, 2.2, p.z, 0x6fe0ff, 14, 7);
      hud.setBoss("Poseidon, God of the Sea", p.hp / POSEIDON_HP);
      if (result === "dead") poseidonFalls();
    }
  }
  if (hitAny && wearsFullKit(save.armor, "zeus")) {
    const tx = hero.x + Math.sin(hero.yaw) * 1.6;
    const tz = hero.z + Math.cos(hero.yaw) * 1.6;
    burst(tx, heroY + 1.2, tz, 0xfff27a, 12, 8, 0.9);
  }
  if (hitAny) {
    stop = Math.max(stop, 0.05);
    shake = Math.max(shake, 0.12);
  }
}

function aresFalls(): void {
  if (!ares) return;
  fight = "won";
  hud.banner("Ares is beaten!", "Claim his armor", 3.5);
  hud.setBoss(null, 0);
  shake = 0.7;
  stop = 0.25;
  burst(ares.a.x, 2, ares.a.z, 0xffd860, 40, 10, 1.6);
  for (const f of foes) if (f.camp === -1 && f.g.state !== "dead") {
    f.g.state = "dead";
    f.g.t = 0;
  }
  gateClosed = false;
  spawnReward(ares.a.x, ares.a.z, "ares");
}

function claimReward(): void {
  if (!reward) return;
  scene.remove(reward.mesh);
  burst(reward.x, 1.5, reward.z, 0xffd860, 50, 9, 1.4);
  const kit = reward.kit;
  reward = null;
  save.armor = godKit(kit);
  if (!save.beaten.includes(kit)) save.beaten.push(kit);
  storeSave(save);
  wearKit(heroFig, save.armor);
  hud.setArmor(save.armor);
  armHero();
  if (kit === "kronos") {
    hud.banner("Armor of Kronos", "The Titan's own armor — the strongest there is", 4);
    clearKronos();
    return;
  }
  if (kit === "zeus") {
    hud.banner("Armor of Zeus", "Your sword is a lightning bolt now!", 4);
    clearZeus();
    return;
  }
  if (kit === "hades") {
    hud.banner("Armor of Hades", "The toughest of all, and your sword hits twice as hard", 4);
    clearHades();
    return;
  }
  if (kit === "poseidon") {
    hud.banner("Armor of Poseidon", "The toughest yet, and your sword hits twice as hard", 4);
    clearPoseidon();
    return;
  }
  hud.banner("Armor of Ares", "Tougher, and your sword hits twice as hard", 4);
  if (seaFight !== "won") window.setTimeout(() => hud.banner("Poseidon awaits…", "Take the road east to the fishing village", 3.5), 4500);
  if (ares) {
    scene.remove(ares.fig.root);
    scene.remove(ares.shadow);
    scene.remove(ares.stars);
    ares = null;
  }
}

function respawn(): void {
  endFight();
  mendStairs();
  endZeusFight();
  endKronosFight();
  heroY = 0;
  falling = null;
  clearHades();
  clearDrops();
  hadesGateClosed = false;
  if (hadesFight === "on") hadesFight = "waiting";
  underworld(false);
  if (fight === "on") fight = "waiting";
  if (seaFight === "on") seaFight = "waiting";
  hero = makeHero(START.x, START.z, START.yaw);
  camYaw = START.yaw;
  leftTown = false;
}

let shopRedraw: ((coins: number, armor: typeof save.armor) => void) | null = null;

// The wardrobe: swap into any armour already owned.
hud.onWardrobe(() => {
  if (hud.shopOpen()) return;
  hud.openWardrobe(outfits(save.beaten, save.bronze), wornOutfit(save.armor), (outfit) => {
    save.armor = outfitArmor(outfit, save.bronze);
    storeSave(save);
    wearKit(heroFig, save.armor);
    armHero();
    hud.setArmor(save.armor);
    burst(hero.x, heroY + 1.2, hero.z, 0xffd860, 20, 5, 1);
  });
});
function openShop(): void {
  shopRedraw = hud.openShop(
    save.coins,
    save.armor,
    (slot) => {
      const sale = buy(slot, save.coins, save.armor);
      if (!sale.ok) return;
      save.coins = sale.coins;
      save.armor = sale.armor;
      if (!save.bronze.includes(slot)) save.bronze.push(slot);
      storeSave(save);
      wearKit(heroFig, save.armor);
      armHero();
      hud.setArmor(save.armor);
      hud.setCoins(save.coins);
      shopRedraw?.(save.coins, save.armor);
    },
    () => {
      shopRedraw = null;
    },
  );
}

// ---------------------------------------------------------------------------
// One frame

function update(dt: number): void {
  clock += dt;
  if (hud.shopOpen()) {
    controls.offer(null);
    controls.takeAttack();
    controls.takeInteract();
    controls.takeTurn();
    return;
  }

  const turned = controls.takeTurn();
  if (turned !== 0) {
    camYaw = dragTurn(camYaw, turned);
    lastDrag = clock;
  }
  const stick = controls.stick();
  const blocking = controls.blocking();
  const aresUp = ares && ares.a.state !== "dead";
  const seaUp = poseidon && poseidon.p.state !== "dead";
  if (aresUp && clock - lastDrag > 1.2) camYaw = lockOn(camYaw, hero, ares!.a, dt);
  else if (seaUp && clock - lastDrag > 1.2) camYaw = lockOn(camYaw, hero, poseidon!.p, dt);
  else if (hades && hades.h.state !== "dead" && !hadesHidden(hades.h) && clock - lastDrag > 1.2) camYaw = lockOn(camYaw, hero, hades.h, dt);
  else if (zeus && zeus.z.state !== "dead" && clock - lastDrag > 1.2) camYaw = lockOn(camYaw, hero, zeus.z, dt);
  else if (kronos && kronos.k.state !== "dead" && clock - lastDrag > 1.2) camYaw = lockOn(camYaw, hero, kronos.k, dt);
  else if (!blocking && standing(hero)) camYaw = autoTurn(camYaw, stick.x, dt);
  const move = moveFromStick(stick.x, stick.y, camYaw);
  // Wading through the flood is slow going.
  const wading = poseidon !== null && floodLevel(poseidon.p) > 0.5 && !onIsland(hero.x, hero.z);
  if (wading) {
    move.x *= 0.6;
    move.z *= 0.6;
  }

  if (controls.takeAttack() && startSwing(hero)) {
    // Phones get help aiming: the swing turns to the nearest thing in front worth hitting.
    const targets: Array<{ x: number; z: number }> = foes.filter((f) => f.g.state !== "dead").map((f) => f.g);
    if (ares && ares.a.state !== "dead") targets.push(ares.a);
    if (poseidon && poseidon.p.state !== "dead") targets.push(poseidon.p);
    if (hades && hades.h.state !== "dead" && !hadesHidden(hades.h)) targets.push(hades.h);
    if (zeus && zeus.z.state !== "dead") targets.push(zeus.z);
    if (kronos && kronos.k.state !== "dead") targets.push(kronos.k);
    let best: { x: number; z: number } | null = null;
    let bestD = SWING_REACH + 2;
    for (const t of targets) {
      const d = dist(hero.x, hero.z, t.x, t.z);
      if (d < bestD && inArc(hero.yaw, hero.x, hero.z, t.x, t.z, Math.PI * 1.2)) {
        best = t;
        bestD = d;
      }
    }
    if (best) face(hero, yawTo(hero.x, hero.z, best.x, best.z));
  }

  const sim = stop > 0 ? 0 : dt;
  stop = Math.max(0, stop - dt);

  // While Kronos holds time, the hero's own world runs slow.
  const heroSim = kronos && kronos.k.slow > 0 ? sim * SLOW : sim;
  const was = { x: hero.x, z: hero.z };
  if (stepHero(hero, heroSim, { move, block: blocking })) swingLands();
  const p = pushOut(world, hero.x, hero.z, RADIUS, gateClosed, seaGateClosed, hadesGateClosed, zeusGateClosed, zeusFight === "won");
  hero.x = p.x;
  hero.z = p.z;
  // The mountains stand in the open country with only their stairs to climb: walking up to
  // one anywhere else stops at its foot, and Olympus stays shut until Zeus is beaten.
  const ontoVolcano = inVolcano(hero.x, hero.z) && !inVolcano(was.x, was.z) && footing(hero.x, hero.z) === null;
  const ontoOlympus = onOlympus(hero.x, hero.z) && !onOlympus(was.x, was.z) && (zeusFight !== "won" || olympusFooting(hero.x, hero.z) === null);
  if (ontoVolcano || ontoOlympus) {
    hero.x = was.x;
    hero.z = was.z;
  }

  // The volcano: stand on its path, and fall off anywhere else.
  if (falling) {
    falling.vy -= 30 * dt;
    if (!falling.lava) {
      // Off the side of the stairs is a long tumble down the slope to the foot.
      const m = falling.slide ?? { x: VOLCANO.x, z: VOLCANO.z, r: VOLCANO.r, slope: slopeY };
      const d = dist(hero.x, hero.z, m.x, m.z);
      if (d < m.r && d > 1e-3) {
        const step = Math.min(m.r - d, 14 * dt);
        hero.x += ((hero.x - m.x) / d) * step;
        hero.z += ((hero.z - m.z) / d) * step;
        falling.y = m.slope(d + step);
        if (Math.random() < 0.4) burst(hero.x, falling.y + 0.3, hero.z, 0x8a7a70, 2, 3);
      }
    }
    heroY = Math.max(falling.y, heroY + falling.vy * dt);
    if (heroY <= falling.y && !falling.landed && (falling.lava || falling.y < 0.1)) {
      falling.landed = true;
      shake = 0.5;
      if (falling.lava) burst(hero.x, falling.y + 0.3, hero.z, 0xff6a1e, 30, 8, 1.4);
      else burst(hero.x, heroY + 0.3, hero.z, 0x8a7a70, 16, 5);
    }
  } else if (inVolcano(hero.x, hero.z) && standing(hero)) {
    let f = footing(hero.x, hero.z);
    if (!f && heroY < SAFE_DROP) {
      const q = ontoStairs(hero.x, hero.z, RADIUS);
      hero.x = q.x;
      hero.z = q.z;
      f = footing(hero.x, hero.z);
    }
    if (f) {
      heroY = f.y;
      if (atPortal(hero.x, hero.z)) intoTartarus();
    } else {
      // Off the edge.
      const end = landing(hero.x, hero.z);
      falling = { vy: 2, y: end.y, lava: end.lava, landed: false };
      hero.hp = 0;
      hero.fallen = 0;
      hero.swing = -1;
      fallTimer = 0;
      hud.banner(end.lava ? "Into the lava!" : "You fell!", "Back to the city", 2.6);
    }
  } else if (onOlympus(hero.x, hero.z)) {
    if (standing(hero)) {
      let y = olympusFooting(hero.x, hero.z);
      if (y === null && heroY < SAFE_DROP) {
        // A stumble off the bottom steps puts you back on them.
        hero.x = Math.min(OLYMPUS.x + OLYMPUS_STAIR_HALF - RADIUS, Math.max(OLYMPUS.x - OLYMPUS_STAIR_HALF + RADIUS, hero.x));
        y = olympusFooting(hero.x, hero.z);
      }
      if (y !== null) heroY = y;
      else {
        falling = { vy: 2, y: olympusSlope(dist(hero.x, hero.z, OLYMPUS.x, OLYMPUS.z)), lava: false, landed: false, slide: { x: OLYMPUS.x, z: OLYMPUS.z, r: OLYMPUS.r, slope: olympusSlope } };
        hero.hp = 0;
        hero.fallen = 0;
        hero.swing = -1;
        fallTimer = 0;
        hud.banner("You fell!", "Back to the city", 2.6);
      }
    }
  } else if (inTartarus(hero.x, hero.z)) {
    if (standing(hero)) {
      const y = tartarusFooting(hero.x, hero.z, stairsBroken);
      if (y !== null) heroY = y;
      else {
        falling = { vy: 2, y: FIRE_Y, lava: true, landed: false };
        hero.hp = 0;
        hero.fallen = 0;
        hero.swing = -1;
        fallTimer = 0;
        hud.banner("Into the fire!", "Back to the city", 2.6);
      }
      if (hadesFight === "waiting" && inHadesArena(hero.x, hero.z, HADES_TRIGGER)) startHadesFight();
      const onLastStairs = hero.x > STAIRS.x0 && hero.x < COLLAPSE_AT && Math.abs(hero.z - TARTARUS.z) < STAIRS.half;
      if (onLastStairs && !collapsedThisVisit && hadesFight !== "won") startCollapse();
      if (hadesFight === "won" && dist(hero.x, hero.z, HOME_PORTAL.x, HOME_PORTAL.z) < 1.4) outOfTartarus();
    }
  } else if (!inVolcano(hero.x, hero.z)) {
    heroY = onIsland(hero.x, hero.z) ? ISLAND_H : 0;
  }

  if (!standing(hero)) {
    fallTimer += dt;
    if (fallTimer > 2.8 && (!falling || falling.landed)) respawn();
  }

  // The city mends you and restocks the road.
  const inTown = inCity(hero.x, hero.z) || inHamlet(hero.x, hero.z) || (inVillage(hero.x, hero.z) && !inSeaArena(hero.x, hero.z, SEA_ARENA.r + SEA_ARENA.thick + 1));
  if (inTown && standing(hero)) {
    hero.hp = Math.min(MAX_HP, hero.hp + CITY_HEAL * dt);
    for (let i = 0; i < CAMPS.length; i++) stockCamp(i);
    stockStairs();
    stockHell();
    if (leftTown) leftTown = false;
  } else if (!leftTown && hero.z < -26) {
    leftTown = true;
    if (fight !== "won") hud.banner("The Road to Ares", "His colosseum lies to the north", 2.4);
  }
  const nowInVillage = inVillage(hero.x, hero.z);
  if (nowInVillage && !wasInVillage) hud.banner("The Fishing Village", seaFight === "won" ? "Poseidon is beaten" : "Poseidon waits in his colosseum", 2.6);
  wasInVillage = nowInVillage;

  // Grunts.
  for (const f of foes) {
    if (f.drop !== undefined) {
      // Falling into the fire, and gone when it gets there.
      f.drop -= 24 * sim;
      if (f.drop < FIRE_Y) {
        burst(f.g.x, FIRE_Y + 0.5, f.g.z, 0xff6a1e, 16, 6);
        f.g.t = DEAD_FADE + 1;
      }
      continue;
    }
    const was = { x: f.g.x, z: f.g.z };
    const blow = updateGrunt(f.g, sim, { x: hero.x, z: hero.z, alive: standing(hero) });
    if (blow) heroLoses(blow);
    if (inTartarus(f.g.x, f.g.z) && tartarusFooting(f.g.x, f.g.z, stairsBroken) === null) {
      // Knocked off the edge, it falls; walking, it just stops at the edge.
      if (f.g.state === "reel" || f.g.state === "down" || f.g.state === "dead") {
        f.drop = foeY(f);
        f.g.state = "dead";
        f.g.t = 0;
        hud.banner("Into the fire!", "", 0.9);
      } else {
        f.g.x = was.x;
        f.g.z = was.z;
      }
    }
    if (f.camp === STAIR_CAMP && f.g.state === "idle") {
      // Pace up and down the stairs until someone comes near.
      let dir = pacing.get(f.g.id) ?? 1;
      f.g.x += dir * 1.2 * sim;
      f.g.yaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      f.g.moving = true;
      const d = f.g.x - VOLCANO.x;
      if (d > VOLCANO.r - 2 || d < LANDING_OUT + 1) {
        dir = -dir;
        pacing.set(f.g.id, dir);
      }
    }
    if (f.camp === STAIR_CAMP) onStairs(f.g);
    else if (f.g.state !== "dead") {
      const q = pushOut(world, f.g.x, f.g.z, 0.45, gateClosed || f.camp === -1, seaGateClosed || f.camp === -1, hadesGateClosed || f.camp === -1);
      f.g.x = q.x;
      f.g.z = q.z;
      // Never stand inside the hero.
      const d = dist(f.g.x, f.g.z, hero.x, hero.z);
      if (d < 0.9 && d > 1e-4) {
        f.g.x = hero.x + ((f.g.x - hero.x) / d) * 0.9;
        f.g.z = hero.z + ((f.g.z - hero.z) / d) * 0.9;
      }
    }
  }
  // Or inside each other.
  for (let i = 0; i < foes.length; i++) {
    for (let j = i + 1; j < foes.length; j++) {
      const a = foes[i]!.g;
      const b = foes[j]!.g;
      if (a.state === "dead" || b.state === "dead") continue;
      const d = dist(a.x, a.z, b.x, b.z);
      if (d < 0.95 && d > 1e-4) {
        const push = (0.95 - d) / 2;
        const nx = (b.x - a.x) / d;
        const nz = (b.z - a.z) / d;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
      }
    }
  }
  for (const f of foes.filter((f) => f.g.state === "dead" && f.g.t > DEAD_FADE)) removeFoe(f);

  // Ares.
  if (fight === "waiting" && inArena(hero.x, hero.z, FIGHT_TRIGGER) && standing(hero)) startFight();
  if (ares) {
    const events = updateAres(ares.a, sim, { x: hero.x, z: hero.z, alive: standing(hero) }, { x: COLOSSEUM.x, z: COLOSSEUM.z, r: ARENA_R });
    for (const e of events) {
      if (e.kind === "blow") heroLoses(e);
      else if (e.kind === "roar") shake = 0.35;
      else if (e.kind === "wall") {
        shake = 0.6;
        burst(ares.a.x, 1, ares.a.z, 0xd2b48c, 24, 8, 1.6);
        hud.banner("He's dizzy!", "Hit him now!", 1.6);
      } else if (e.kind === "summon") {
        for (let i = 0; i < e.count; i++) {
          const a = yawTo(COLOSSEUM.x, COLOSSEUM.z, hero.x, hero.z) + Math.PI + (i - 1) * 0.9;
          const x = COLOSSEUM.x + Math.sin(a) * (ARENA_R - 2);
          const z = COLOSSEUM.z + Math.cos(a) * (ARENA_R - 2);
          const f = addFoe("spartan", x, z, a + Math.PI, -1);
          f.g.state = "walk";
          burst(x, 1, z, 0xff6a40, 12, 5);
        }
        hud.banner("To me, Spartans!", "", 1.6);
      }
    }
    if (ares.a.state !== "dead") {
      const q = pushOut(world, ares.a.x, ares.a.z, BODY, true);
      ares.a.x = q.x;
      ares.a.z = q.z;
      const d = dist(ares.a.x, ares.a.z, hero.x, hero.z);
      const min = BODY + RADIUS;
      if (d < min && d > 1e-4) {
        hero.x = ares.a.x + ((hero.x - ares.a.x) / d) * min;
        hero.z = ares.a.z + ((hero.z - ares.a.z) / d) * min;
      }
    }
  }
  // Poseidon.
  if (seaFight === "waiting" && inSeaArena(hero.x, hero.z, SEA_ARENA.r - 5) && standing(hero)) startSeaFight();
  if (poseidon) {
    const p = poseidon.p;
    const events = updatePoseidon(p, sim, { x: hero.x, z: hero.z, alive: standing(hero) }, { x: SEA_ARENA.x, z: SEA_ARENA.z, r: SEA_ARENA.r });
    for (const e of events) {
      if (e.kind === "blow") heroLoses(e);
      else if (e.kind === "roar") shake = 0.35;
      else if (e.kind === "throw") hud.banner("Look out!", "Block it, or get out of the way", 1.2);
      else if (e.kind === "stuck") {
        shake = 0.25;
        burst(e.x, 1.2, e.z, 0xd2e0de, 14, 6);
        hud.banner("He threw his trident!", "Hit him now!", 1.6);
      } else if (e.kind === "flood") {
        shake = 0.6;
        hud.banner("The sea is coming!", "Get up on an island! Drowned skeletons!", 2.2);
        // Drowned skeletons rise out of the water, across the arena from the hero.
        for (let i = 0; i < 3; i++) {
          const a = yawTo(SEA_ARENA.x, SEA_ARENA.z, hero.x, hero.z) + Math.PI + (i - 1) * 0.9;
          const x = SEA_ARENA.x + Math.sin(a) * (SEA_ARENA.r - 3);
          const z = SEA_ARENA.z + Math.cos(a) * (SEA_ARENA.r - 3);
          const f = addFoe("drowned", x, z, a + Math.PI, -1);
          f.g.state = "walk";
          burst(x, 0.6, z, 0x9fe8ff, 16, 5);
        }
      }
    }
    // Caught in the flood, off the islands: it stings, a little at a time.
    const level = floodLevel(p);
    if (level > 0.5 && standing(hero) && !onIsland(hero.x, hero.z) && inSeaArena(hero.x, hero.z)) {
      floodSting += sim;
      if (floodSting >= 0.5) {
        floodSting = 0;
        hero.hp = Math.max(0, hero.hp - damageTaken(FLOOD_DAMAGE * 0.5, save.armor));
        heroFlash = 0.6;
        burst(hero.x, 0.8, hero.z, 0x9fe8ff, 6, 4);
        if (hero.hp === 0) {
          hero.fallen = 0;
          hero.swing = -1;
          fallTimer = 0;
          hud.banner("You fell!", "Back to town to heal up", 2.6);
        }
      }
    } else floodSting = 0;
    if (p.state !== "dead") {
      const q = pushOut(world, p.x, p.z, SEA_BODY, gateClosed, true);
      p.x = q.x;
      p.z = q.z;
      const d = dist(p.x, p.z, hero.x, hero.z);
      const min = SEA_BODY + RADIUS;
      if (d < min && d > 1e-4) {
        hero.x = p.x + ((hero.x - p.x) / d) * min;
        hero.z = p.z + ((hero.z - p.z) / d) * min;
      }
    }
  }
  stepCollapse(sim);
  crumble();
  stepBack();

  // Kronos: reaching the top opens the door.
  const onSummit = onOlympus(hero.x, hero.z) && heroY > OLYMPUS.h - 0.5 && dist(hero.x, hero.z, OLYMPUS.x, OLYMPUS.z) < OLYMPUS.top;
  if (kronosFight === "waiting" && onSummit && standing(hero) && !falling) startKronos();
  if (kronosFight !== "waiting") doorsOpen = Math.min(1, doorsOpen + dt / 0.5);
  if (kronos) {
    const k = kronos.k;
    const events = updateKronos(k, sim, { x: hero.x, z: hero.z, alive: standing(hero) });
    for (const e of events) {
      if (e.kind === "blow") heroLoses(e);
      else if (e.kind === "roar") shake = 0.5;
      else if (e.kind === "slow") {
        shake = 0.4;
        hud.banner("Time is slowing down!", "Hold on until it wears off", 2);
      } else if (e.kind === "tired") hud.banner("He's worn out!", "Hit him now!", 1.6);
    }
    if (k.state !== "dead" && k.state !== "emerge") {
      const q = pushOut(world, k.x, k.z, KRONOS_BODY, true, true, true, true);
      // Keep him on the summit.
      const d = dist(q.x, q.z, OLYMPUS.x, OLYMPUS.z);
      const limit = OLYMPUS.top - 2;
      k.x = d > limit ? OLYMPUS.x + ((q.x - OLYMPUS.x) / d) * limit : q.x;
      k.z = d > limit ? OLYMPUS.z + ((q.z - OLYMPUS.z) / d) * limit : q.z;
      const dh = dist(k.x, k.z, hero.x, hero.z);
      const min = KRONOS_BODY + RADIUS;
      if (dh < min && dh > 1e-4) {
        hero.x = k.x + ((hero.x - k.x) / dh) * min;
        hero.z = k.z + ((hero.z - k.z) / dh) * min;
      }
    }
  }

  // Zeus.
  if (zeusFight === "waiting" && inZeusArena(hero.x, hero.z, ZEUS_RING.r - 4) && standing(hero)) startZeusFight();
  updateAngels(dt);
  // Olympia's great door: shut, with no lock on it.
  const atDoor = standing(hero) && heroY > OLYMPUS.h - 1 && dist(hero.x, hero.z, DOOR.x, DOOR.z) < 2.4;
  if (atDoor && !triedDoor) hud.banner("The door is locked", "There's no lock and no keyhole… what opens it?", 3);
  triedDoor = atDoor;
  if (zeus) {
    const zz = zeus.z;
    const events = updateZeus(zz, sim, { x: hero.x, z: hero.z, alive: standing(hero) }, ZEUS_RING);
    for (const e of events) {
      if (e.kind === "blow") heroLoses(e);
      else if (e.kind === "roar") shake = 0.35;
      else if (e.kind === "throw") hud.banner("Lightning bolt!", "Block it!", 1.2);
      else if (e.kind === "storm") {
        warnStrikes(e.spots);
        hud.banner("A storm is coming!", "Get out of the blue circles!", 1.6);
      } else if (e.kind === "lightning") {
        shake = 0.8;
        for (const p of e.spots) burst(p.x, 0.4, p.z, 0xfff27a, 14, 8, 1.1);
        for (const s of strikes) s.flash.visible = true;
        hud.banner("He's worn out!", "Hit him now!", 1.6);
      } else if (e.kind === "zap" && standing(hero)) {
        hurtHero(hero, damageTaken(e.damage, save.armor), hero.x + 0.01, hero.z, true);
        heroFlash = 1;
        stop = 0.1;
        if (!standing(hero)) {
          fallTimer = 0;
          hud.banner("Struck by lightning!", "Back to the city to heal up", 2.6);
        }
      }
    }
    if (zz.state !== "dead") {
      const q = pushOut(world, zz.x, zz.z, ZEUS_BODY, true, true, true, true);
      zz.x = q.x;
      zz.z = q.z;
      const d = dist(zz.x, zz.z, hero.x, hero.z);
      const min = ZEUS_BODY + RADIUS;
      if (d < min && d > 1e-4) {
        hero.x = zz.x + ((hero.x - zz.x) / d) * min;
        hero.z = zz.z + ((hero.z - zz.z) / d) * min;
      }
    }
  }

  // Hades.
  if (hades) {
    const h = hades.h;
    const events = updateHades(h, sim, { x: hero.x, z: hero.z, yaw: hero.yaw, alive: standing(hero) }, TARTARUS);
    for (const e of events) {
      if (e.kind === "blow") heroLoses(e);
      else if (e.kind === "roar") shake = 0.35;
      else if (e.kind === "vanish") {
        burst(h.x, TARTARUS.y + 1.5, h.z, 0x3a2a44, 24, 5, 1.4);
        hud.banner("He vanished!", "Watch your back", 1.4);
      } else if (e.kind === "appear") burst(e.x, TARTARUS.y + 1.5, e.z, 0x5fe08a, 20, 5, 1.2);
      else if (e.kind === "quake") {
        shake = 0.5;
        warnDrops(e.spots);
        hud.banner("The roof is falling!", "Get out of the red circles!", 1.6);
      } else if (e.kind === "crash") {
        shake = 0.7;
        for (const p of e.spots) burst(p.x, TARTARUS.y + 0.4, p.z, 0x5a4e58, 14, 6, 1.2);
      } else if (e.kind === "crush" && standing(hero)) {
        hurtHero(hero, damageTaken(e.damage, save.armor), hero.x + 0.01, hero.z, true);
        heroFlash = 1;
        stop = 0.08;
        if (!standing(hero)) {
          fallTimer = 0;
          hud.banner("Crushed!", "Back to the city to heal up", 2.6);
        }
      }
      else if (e.kind === "raise") {
        for (let i = 0; i < e.count; i++) {
          const a = yawTo(TARTARUS.x, TARTARUS.z, hero.x, hero.z) + Math.PI + (i - 1) * 0.9;
          const x = TARTARUS.x + Math.sin(a) * (TARTARUS.r - 3);
          const z = TARTARUS.z + Math.cos(a) * (TARTARUS.r - 3);
          const f = addFoe("skeleton", x, z, a + Math.PI, -1);
          f.g.state = "walk";
          burst(x, TARTARUS.y + 0.5, z, 0x5fe08a, 12, 5);
        }
        hud.banner("Rise, my dead!", "", 1.6);
      }
    }
    if (h.state !== "dead" && !hadesHidden(h)) {
      const q = pushOut(world, h.x, h.z, HADES_BODY, true, true, true);
      h.x = q.x;
      h.z = q.z;
      const d = dist(h.x, h.z, hero.x, hero.z);
      const min = HADES_BODY + RADIUS;
      if (d < min && d > 1e-4) {
        hero.x = h.x + ((hero.x - h.x) / d) * min;
        hero.z = h.z + ((hero.z - h.z) / d) * min;
      }
    }
  }
  if (reward && dist(hero.x, hero.z, reward.x, reward.z) < 2.4) claimReward();

  // Coins hop out, settle, and fly to a hero who comes near.
  for (const c of coins) {
    c.age += sim;
    const m = c.mesh.position;
    const d = dist(m.x, m.z, hero.x, hero.z);
    if (c.age > 0.5 && d < 2.2 && standing(hero)) {
      const k = Math.min(1, dt * 12);
      m.x += (hero.x - m.x) * k;
      m.z += (hero.z - m.z) * k;
      m.y += (1 - m.y) * k;
    } else {
      c.v.y -= 20 * sim;
      m.addScaledVector(c.v, sim);
      if (m.y < 0.3) {
        m.y = 0.3;
        c.v.set(c.v.x * 0.5, Math.abs(c.v.y) > 2 ? -c.v.y * 0.35 : 0, c.v.z * 0.5);
      }
    }
    c.mesh.rotation.y += dt * 4;
    if (c.age > 0.5 && d < 0.7) {
      c.age = -1;
      save.coins += 1;
      burst(m.x, m.y, m.z, 0xffd860, 4, 3, 0.7);
    }
  }
  if (coins.some((c) => c.age < 0)) {
    for (const c of coins.filter((c) => c.age < 0)) scene.remove(c.mesh);
    coins = coins.filter((c) => c.age >= 0);
    hud.setCoins(save.coins);
    storeSave(save);
  }

  // The blacksmith's counter.
  const atCounter = standing(hero) && dist(hero.x, hero.z, BLACKSMITH.x - 1.4, BLACKSMITH.z) < SHOP_RANGE;
  controls.offer(atCounter ? "Blacksmith" : null);
  if (controls.takeInteract() && atCounter) openShop();

  blockAnim += ((hero.blocking ? 1 : 0) - blockAnim) * Math.min(1, dt * 18);
  heroFlash = Math.max(0, heroFlash - dt * 5);
  hud.setHealth(Math.ceil(hero.hp));
  hud.setCompass(
    camYaw,
    fight === "on" || seaFight === "on" || zeusFight === "on" || kronosFight === "on" || inTartarus(hero.x, hero.z)
      ? null
      : [
          { id: "colosseum", label: fight === "won" ? "Colosseum" : "Ares", yaw: yawTo(hero.x, hero.z, COLOSSEUM.x, COLOSSEUM.z) },
          { id: "city", label: "City", yaw: yawTo(hero.x, hero.z, 0, 0) },
          { id: "village", label: seaFight === "won" ? "Village" : "Poseidon", yaw: yawTo(hero.x, hero.z, VILLAGE.x, VILLAGE.z) },
          { id: "volcano", label: "Volcano", yaw: yawTo(hero.x, hero.z, VOLCANO.x, VOLCANO.z) },
          zeusFight === "won"
            ? { id: "olympus", label: "Olympia", yaw: yawTo(hero.x, hero.z, OLYMPUS.x, OLYMPUS.z) }
            : { id: "olympus", label: "Zeus", yaw: yawTo(hero.x, hero.z, ZEUS_RING.x, ZEUS_RING.z) },
        ].filter(
          (m) =>
            (m.id !== "city" || !inCity(hero.x, hero.z)) &&
            (m.id !== "village" || !inVillage(hero.x, hero.z)) &&
            (m.id !== "volcano" || !inVolcano(hero.x, hero.z)) &&
            (m.id !== "olympus" || !onOlympus(hero.x, hero.z)),
        ),
  );
}

/** Where a grunt is in its own swing, as a 0..1 through the shared swing animation. */
function gruntSwing(g: Grunt): number {
  const s = GRUNTS[g.kind];
  if (g.state === "windup") return 0.38 * Math.min(1, g.t / s.windup);
  if (g.state === "strike") return 0.38 + 0.24 * Math.min(1, g.t / STRIKE_TIME);
  if (g.state === "recover") return 0.62 + 0.38 * Math.min(1, g.t / 0.3);
  return -1;
}

function draw(dt: number): void {
  // Hero.
  // Step up and down stairs over a moment rather than popping a whole step; anything bigger (a portal, a fall) snaps.
  shownY = Math.abs(heroY - shownY) > 2.5 ? heroY : shownY + (heroY - shownY) * Math.min(1, dt * 16);
  heroFig.root.position.set(hero.x, shownY, hero.z);
  heroFig.root.rotation.y = hero.yaw;
  poseFigure(heroFig, dt, {
    speed: hero.speed,
    swing: hero.swing >= 0 ? hero.swing / SWING_TIME : -1,
    block: blockAnim,
    fallen: hero.fallen,
  });
  flash(heroFig, heroFlash * 0.8, 0xff3020);
  // Blink while nothing can hurt you, the way every game says so.
  heroFig.root.visible = !(hero.hurt > 0.25 && standing(hero) && Math.floor(clock * 20) % 2 === 0);
  heroShadow.position.set(hero.x, shownY + 0.07, hero.z);

  // The smith hammers on.
  const hammer = (clock * 1.3) % 1;
  poseFigure(smith, dt, { swing: hammer });
  for (const f of fishers) poseFigure(f, dt, {});

  for (const f of foes) {
    const g = f.g;
    f.fig.root.position.set(g.x, foeY(f), g.z);
    f.fig.root.rotation.y = g.yaw;
    let fallen = -1;
    if (g.state === "down") fallen = g.t + 0.5;
    else if (g.state === "rise") fallen = Math.max(0, 0.5 - g.t * 0.6);
    else if (g.state === "dead") fallen = g.t + 0.5;
    poseFigure(f.fig, dt, { speed: g.moving ? GRUNTS[g.kind].speed : 0, swing: gruntSwing(g), fallen, block: g.kind === "spartan" ? 0.3 : 0 });
    // The wind-up glows, so a swing can be seen coming.
    if (g.state === "windup") flash(f.fig, 0.25 + 0.25 * Math.sin(clock * 30), 0xffaa40);
    else flash(f.fig, f.flash, 0xffffff);
    f.flash = Math.max(0, f.flash - dt * 6);
    if (g.state === "dead") fade(f.fig, Math.max(0, 1 - g.t / DEAD_FADE));
    f.shadow.position.set(g.x, foeY(f) + 0.07, g.z);
    f.shadow.visible = g.state !== "dead";
  }

  if (ares) {
    const a = ares.a;
    const fig = ares.fig;
    fig.root.position.set(a.x, 0, a.z);
    fig.root.rotation.y = a.yaw;
    let swing = -1;
    if (a.state === "windup") swing = 0.38 * Math.min(1, a.t / 0.75);
    else if (a.state === "swing") swing = 0.38 + 0.24 * Math.min(1, a.t / 0.2);
    else if (a.state === "recover") swing = 0.62 + 0.38 * Math.min(1, a.t / 0.4);
    poseFigure(fig, dt, {
      speed: a.state === "charge" ? 14 : a.moving ? 2.6 : 0,
      swing,
      block: a.state === "charge" ? 1 : guarding(a) ? 0.75 : 0,
      raise: a.state === "summon" ? 1 : 0,
      daze: a.state === "dazed" ? 1 : 0,
      fallen: a.state === "dead" ? a.t : -1,
    });
    if (a.state === "brace") flash(fig, 0.4 + 0.4 * Math.sin(clock * 24), 0xff2a00);
    else if (a.state === "windup") flash(fig, 0.2 + 0.2 * Math.sin(clock * 30), 0xffaa40);
    else flash(fig, ares.flash, 0xffffff);
    ares.flash = Math.max(0, ares.flash - dt * 6);
    ares.shadow.position.set(a.x, 0.07, a.z);
    ares.stars.visible = a.state === "dazed";
    ares.stars.position.set(a.x, 3.6, a.z);
    ares.stars.rotation.y = clock * 5;
    if (a.state === "charge" && Math.random() < 0.6) burst(a.x, 0.2, a.z, 0xd2b48c, 1, 3, 1.2);
  }

  if (poseidon) {
    const p = poseidon.p;
    const fig = poseidon.fig;
    fig.root.position.set(p.x, 0, p.z);
    fig.root.rotation.y = p.yaw;
    let swing = -1;
    if (p.state === "windup") swing = 0.38 * Math.min(1, p.t / 0.7);
    else if (p.state === "jab") swing = 0.38 + 0.24 * Math.min(1, p.t / 0.2);
    else if (p.state === "recover") swing = 0.62 + 0.38 * Math.min(1, p.t / 0.4);
    poseFigure(fig, dt, {
      speed: p.moving ? 2.4 : 0,
      swing,
      raise: p.state === "flood" || p.state === "aim" ? 1 : 0,
      fallen: p.state === "dead" ? p.t : -1,
    });
    fig.sword.visible = p.spear === null;
    if (p.state === "aim") flash(fig, 0.4 + 0.4 * Math.sin(clock * 24), 0x2fd6ff);
    else if (p.state === "windup") flash(fig, 0.2 + 0.2 * Math.sin(clock * 30), 0xffaa40);
    else flash(fig, poseidon.flash, 0xffffff);
    poseidon.flash = Math.max(0, poseidon.flash - dt * 6);
    poseidon.shadow.position.set(p.x, 0.07, p.z);
    const spear = poseidon.spear;
    spear.visible = p.spear !== null;
    if (p.spear) {
      spear.position.set(p.spear.x, p.spear.flying ? 2.2 : 1.4, p.spear.z);
      spear.rotation.set(p.spear.flying ? 0 : -0.5, p.spear.yaw, 0);
    }
    const level = floodLevel(p);
    scenery.flood.visible = level > 0;
    scenery.flood.position.y = level * 0.65;
    if (level > 0.3 && Math.random() < 0.3) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * SEA_ARENA.r;
      burst(SEA_ARENA.x + Math.sin(a) * r, level * 0.65, SEA_ARENA.z + Math.cos(a) * r, 0xe8fbff, 1, 2, 0.8);
    }
  }

  if (hades) {
    const h = hades.h;
    const fig = hades.fig;
    fig.root.position.set(h.x, TARTARUS.y, h.z);
    fig.root.rotation.y = h.yaw;
    let swing = -1;
    if (h.state === "windup" || h.state === "ambush") swing = 0.38 * Math.min(1, h.t / 0.7);
    else if (h.state === "strike") swing = 0.38 + 0.24 * Math.min(1, h.t / 0.2);
    else if (h.state === "recover" || h.state === "exposed") swing = 0.62 + 0.38 * Math.min(1, h.t / 0.4);
    poseFigure(fig, dt, { speed: h.moving ? 2.6 : 0, swing, raise: h.state === "raise" ? 1 : 0, daze: h.state === "exposed" ? 0.5 : 0, fallen: h.state === "dead" ? h.t : -1 });
    // Fading out into the helmet's dark, and the green warning before he strikes from behind.
    fade(fig, h.state === "vanish" ? Math.max(0, 1 - h.t * 3) : 1);
    fig.root.visible = !(h.state === "vanish" && h.t > 0.35);
    if (h.state === "ambush") flash(fig, 0.45 + 0.45 * Math.sin(clock * 26), 0x5fff8a);
    else if (h.state === "windup") flash(fig, 0.2 + 0.2 * Math.sin(clock * 30), 0xffaa40);
    else flash(fig, hades.flash, 0xffffff);
    hades.flash = Math.max(0, hades.flash - dt * 6);
    hades.shadow.visible = fig.root.visible;
    hades.shadow.position.set(h.x, TARTARUS.y + 0.07, h.z);
  }
  if (zeus) {
    const zz = zeus.z;
    const fig = zeus.fig;
    fig.root.position.set(zz.x, 0, zz.z);
    fig.root.rotation.y = zz.yaw;
    let swing = -1;
    if (zz.state === "windup") swing = 0.38 * Math.min(1, zz.t / 0.65);
    else if (zz.state === "strike") swing = 0.38 + 0.24 * Math.min(1, zz.t / 0.2);
    else if (zz.state === "recover") swing = 0.62 + 0.38 * Math.min(1, zz.t / 0.4);
    poseFigure(fig, dt, { speed: zz.moving ? 2.8 : 0, swing, raise: zz.state === "storm" || zz.state === "aim" ? 1 : 0, daze: zz.state === "spent" ? 0.6 : 0, fallen: zz.state === "dead" ? zz.t : -1 });
    if (zz.state === "aim" || zz.state === "storm") flash(fig, 0.4 + 0.4 * Math.sin(clock * 26), 0x8fd8ff);
    else if (zz.state === "windup") flash(fig, 0.2 + 0.2 * Math.sin(clock * 30), 0xffaa40);
    else flash(fig, zeus.flash, 0xffffff);
    zeus.flash = Math.max(0, zeus.flash - dt * 6);
    zeus.shadow.position.set(zz.x, 0.07, zz.z);
    zeus.bolt.visible = zz.bolt !== null;
    if (zz.bolt) {
      zeus.bolt.position.set(zz.bolt.x, 1.8, zz.bolt.z);
      // Laid flat with its point along the way it flies.
      zeus.bolt.rotation.set(Math.PI / 2, zz.bolt.yaw, 0, "YXZ");
      if (Math.random() < 0.6) burst(zz.bolt.x, 1.8, zz.bolt.z, 0xfff27a, 1, 3, 0.7);
    }
  }
  scenery.doors.forEach((door, i) => (door.rotation.y = (i === 0 ? 1 : -1) * 1.45 * doorsOpen));
  if (kronos) {
    const k = kronos.k;
    const fig = kronos.fig;
    fig.root.position.set(k.x, OLYMPUS.h, k.z);
    fig.root.rotation.y = k.yaw;
    let swing = -1;
    if (k.state === "windup") swing = 0.38 * Math.min(1, k.t / 0.8);
    else if (k.state === "sweep") swing = 0.38 + 0.24 * Math.min(1, k.t / 0.3);
    else if (k.state === "recover") swing = 0.62 + 0.38 * Math.min(1, k.t / 0.4);
    poseFigure(fig, dt, { speed: k.moving ? 2.4 : 0, swing, raise: k.state === "cast" ? 1 : 0, daze: k.state === "tired" ? 0.8 : 0, fallen: k.state === "dead" ? k.t : -1 });
    // The sweep spins him right round.
    if (k.state === "sweep") fig.root.rotation.y = k.yaw + (k.t / 0.3) * Math.PI * 2;
    if (k.state === "cast") flash(fig, 0.4 + 0.4 * Math.sin(clock * 22), 0xb88aff);
    else if (k.state === "windup") flash(fig, 0.25 + 0.25 * Math.sin(clock * 30), 0xffaa40);
    else flash(fig, kronos.flash, 0xffffff);
    kronos.flash = Math.max(0, kronos.flash - dt * 6);
    kronos.shadow.position.set(k.x, OLYMPUS.h + 0.07, k.z);
    if (k.slow > 0 && Math.random() < 0.6) burst(hero.x + (Math.random() - 0.5) * 1.6, heroY + 0.5 + Math.random() * 1.6, hero.z + (Math.random() - 0.5) * 1.6, 0xb88aff, 1, 1, 0.8);
  }
  for (const s of strikes) {
    s.t += stop > 0 ? 0 : dt;
    (s.ring.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.4 * Math.sin(clock * 22);
  }
  if (strikes.length > 0 && strikes[0]!.t >= STORM_WARN + 0.3) clearStrikes();
  scenery.zeusGate.position.y += ((zeusGateClosed ? 0 : 6) - scenery.zeusGate.position.y) * Math.min(1, dt * (zeusGateClosed ? 10 : 2));
  // The lightning sword crackles as it swings.
  if (hero.swing >= 0 && wearsFullKit(save.armor, "zeus") && Math.random() < 0.7) {
    burst(hero.x + Math.sin(hero.yaw) * 1.3, heroY + 1.3, hero.z + Math.cos(hero.yaw) * 1.3, 0xfff27a, 1, 4, 0.6);
  }
  for (const p of scenery.portals) p.children[1]!.rotation.z = -clock * 2;
  stepFalls.forEach((start, i) => {
    if (start < 0 || clock < start) return;
    const t = clock - start;
    placeStep(scenery.hellStairs, i, 12 * t * t, t * (i % 2 ? 0.8 : -0.8));
  });
  // Stalactites: hang and shiver while the rings glow, drop in the last moment, and are gone on impact.
  for (const d of drops) {
    d.t += stop > 0 ? 0 : dt;
    const fall = QUAKE_WARN - 0.3;
    (d.ring.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.4 * Math.sin(clock * 20);
    if (d.t < fall) d.rock.position.x += Math.sin(clock * 60) * 0.01;
    else d.rock.position.y = Math.max(TARTARUS.y + 1.2, ROOF_Y - ((d.t - fall) / 0.3) * (ROOF_Y - TARTARUS.y));
  }
  if (drops.length > 0 && drops[0]!.t >= QUAKE_WARN + 0.05) clearDrops();
  scenery.hadesGate.position.y += ((hadesGateClosed ? 0 : 6) - scenery.hadesGate.position.y) * Math.min(1, dt * (hadesGateClosed ? 10 : 2));
  scenery.portals[1]!.visible = hadesFight === "won";

  if (reward) {
    reward.mesh.children[1]!.rotation.y = clock * 1.5;
    reward.mesh.children[1]!.position.y = 1.2 + Math.sin(clock * 2) * 0.2;
  }

  // Portcullis drops when the fight starts and lifts when it is over.
  scenery.gate.position.y += ((gateClosed ? 0 : 6) - scenery.gate.position.y) * Math.min(1, dt * (gateClosed ? 10 : 2));

  for (const f of scenery.flames) {
    const s = f.userData.size as number;
    const flick = 1 + Math.sin(clock * 17 + f.position.x) * 0.12 + Math.sin(clock * 29 + f.position.z) * 0.08;
    f.scale.set(s * 0.55, s * 1.3 * flick, s * 0.55);
  }
  scenery.grass.uniforms.time!.value = clock;
  scenery.sea.uniforms.time!.value = clock;
  scenery.lava.color.setHSL(0.045, 1, 0.5 + Math.sin(clock * 2) * 0.06);
  for (const puff of scenery.smoke.children) {
    puff.position.y += dt * 2.5;
    puff.scale.addScalar(dt * 0.4);
    if (puff.position.y > VOLCANO.h + 34) {
      puff.position.y = VOLCANO.h + 3;
      puff.scale.setScalar(3);
    }
  }
  scenery.seaGate.position.y += ((seaGateClosed ? 0 : 6) - scenery.seaGate.position.y) * Math.min(1, dt * (seaGateClosed ? 10 : 2));
  for (const c of scenery.clouds.children) {
    c.position.x += dt * 2;
    if (c.position.x > 800) c.position.x -= 1600;
  }
  updateSparks(dt);

  // Camera: behind the hero, pulled back and up in the arena so the god fits in frame.
  const fighting = (ares !== null && ares.a.state !== "dead") || (poseidon !== null && poseidon.p.state !== "dead") || (hades !== null && hades.h.state !== "dead") || (zeus !== null && zeus.z.state !== "dead") || (kronos !== null && kronos.k.state !== "dead");
  const back = (fighting ? CAM_DIST + 2.5 : CAM_DIST) * devZoom;
  const up = LOOK_HEIGHT + ((fighting ? CAM_HEIGHT + 1.6 : CAM_HEIGHT) - LOOK_HEIGHT) * devZoom;
  const tx = hero.x;
  const tz = hero.z;
  let cx = tx - Math.sin(camYaw) * back;
  let cz = tz - Math.cos(camYaw) * back;
  // Inside the colosseum the camera stays inside the wall.
  if (inZeusArena(hero.x, hero.z)) {
    const d = dist(cx, cz, ZEUS_RING.x, ZEUS_RING.z);
    const limit = ZEUS_RING.r - 0.8;
    if (d > limit) {
      cx = ZEUS_RING.x + ((cx - ZEUS_RING.x) / d) * limit;
      cz = ZEUS_RING.z + ((cz - ZEUS_RING.z) / d) * limit;
    }
  } else if (inTartarus(hero.x, hero.z) && inHadesArena(hero.x, hero.z)) {
    const d = dist(cx, cz, TARTARUS.x, TARTARUS.z);
    const limit = TARTARUS.r - 0.8;
    if (d > limit) {
      cx = TARTARUS.x + ((cx - TARTARUS.x) / d) * limit;
      cz = TARTARUS.z + ((cz - TARTARUS.z) / d) * limit;
    }
  } else if (inSeaArena(hero.x, hero.z)) {
    const d = dist(cx, cz, SEA_ARENA.x, SEA_ARENA.z);
    const limit = SEA_ARENA.r - 0.8;
    if (d > limit) {
      cx = SEA_ARENA.x + ((cx - SEA_ARENA.x) / d) * limit;
      cz = SEA_ARENA.z + ((cz - SEA_ARENA.z) / d) * limit;
    }
  } else if (inArena(hero.x, hero.z)) {
    const d = dist(cx, cz, COLOSSEUM.x, COLOSSEUM.z);
    const limit = ARENA_R - 0.8;
    if (d > limit) {
      cx = COLOSSEUM.x + ((cx - COLOSSEUM.x) / d) * limit;
      cz = COLOSSEUM.z + ((cz - COLOSSEUM.z) / d) * limit;
    }
  }
  // Up the volcano the camera rises with the hero, and never sinks into the rock.
  let cy = up + heroY;
  const camFrom = dist(cx, cz, VOLCANO.x, VOLCANO.z);
  if (camFrom < VOLCANO.r + 2) cy = Math.max(cy, (camFrom < VOLCANO.rim ? LAVA_Y : slopeY(camFrom)) + 2.5);
  const camFromOlympus = dist(cx, cz, OLYMPUS.x, OLYMPUS.z);
  if (camFromOlympus < OLYMPUS.r + 2) cy = Math.max(cy, olympusSlope(camFromOlympus) + 2.5);
  const k = 1 - Math.exp(-dt * 9);
  camPos.lerp(new THREE.Vector3(cx, cy, cz), camPos.lengthSq() === 0 ? 1 : k);
  camLook.lerp(new THREE.Vector3(tx, LOOK_HEIGHT + heroY, tz), camLook.lengthSq() === 0 ? 1 : Math.min(1, k * 1.6));
  shake = Math.max(0, shake - dt * 1.6);
  const jolt = shake * shake;
  camera.position.set(
    camPos.x + (Math.random() - 0.5) * jolt,
    camPos.y + (Math.random() - 0.5) * jolt,
    camPos.z + (Math.random() - 0.5) * jolt,
  );
  camera.lookAt(camLook);
  skyDome.position.copy(camera.position);
  const far = (scene.fog as THREE.Fog).far;
  for (const t of tiles) {
    const s = t.geometry.boundingSphere!;
    t.visible = Math.hypot(s.center.x - camera.position.x, s.center.z - camera.position.z) - s.radius < far;
  }
  // People go sooner: past this a figure is a few pixels tall, and each one is a dozen draws.
  const seen = (x: number, z: number): boolean => Math.hypot(x - camera.position.x, z - camera.position.z) < Math.min(far, PEOPLE_FAR);
  for (const f of foes) {
    f.fig.root.visible = seen(f.g.x, f.g.z);
    f.shadow.visible = f.fig.root.visible && f.g.state !== "dead";
  }
  for (const f of fishers) f.root.visible = seen(f.root.position.x, f.root.position.z);
  smith.root.visible = seen(smith.root.position.x, smith.root.position.z);

  // Snap the shadow box to whole texels, or shadows shimmer as the hero walks.
  const texel = (SHADOW_REACH * 2) / sun.shadow.mapSize.x;
  const sx = Math.round(hero.x / texel) * texel;
  const sz = Math.round(hero.z / texel) * texel;
  sun.target.position.set(sx, heroY, sz);
  sun.position.set(sx + SUN_OFFSET.x, SUN_OFFSET.y + heroY, sz + SUN_OFFSET.z);

  renderer.render(scene, camera);
}

hud.setCoins(save.coins);
hud.setArmor(save.armor);
hud.setHealth(hero.hp);
hud.banner("Battle of the Gods", fight === "won" ? "Ares is beaten — more gods are coming" : "Ares waits in his colosseum, north of the city", 3.5);

// Dev server only: lets a recording script jump the hero about and read the state.
if (import.meta.env.DEV) {
  Object.assign(window, {
    gods: {
      state: () => ({ hero, fight, seaFight, coins: save.coins, armor: save.armor, ares: ares?.a ?? null, poseidon: poseidon?.p ?? null, hades: hades?.h ?? null, hadesFight, zeusFight, kronosFight, kronos: kronos?.k ?? null, zeus: zeus?.z ?? null, heroY, falling, stairsBroken, collapse, foes: foes.map((f) => f.g) }),
      teleport(x: number, z: number, yaw = hero.yaw) {
        hero.x = x;
        hero.z = z;
        hero.yaw = yaw;
        camYaw = yaw;
      },
      info: () => {
        let meshes = 0;
        scene.traverse((o) => {
          if ((o as THREE.Mesh).isMesh && o.visible) meshes++;
        });
        let sceneryMeshes = 0;
        scenery.root.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) sceneryMeshes++;
        });
        return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, meshes, sceneryMeshes, hero: heroFig.root.children.length };
      },
      /** What is being drawn, grouped by what it hangs off, for finding where the draw calls go. */
      heaviest() {
        const counts = new Map<string, number>();
        for (const top of scene.children) {
          let n = 0;
          top.traverseVisible((o) => {
            if ((o as THREE.Mesh).isMesh || (o as THREE.InstancedMesh).isInstancedMesh) n++;
          });
          const key = `${top.type}:${top.name || top.children.length}`;
          counts.set(key, (counts.get(key) ?? 0) + n);
        }
        return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 12);
      },
      zoom(k: number) {
        devZoom = k;
      },
      give(n: number) {
        save.coins += n;
        hud.setCoins(save.coins);
      },
    },
  });
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
