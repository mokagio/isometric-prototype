import * as THREE from "three";
import { createMenu } from "../ui";
import { ARES_HP, BODY, guarding, makeAres, strikeAres, updateAres, type Ares } from "./ares";
import { buy, damageTaken, godKit, shieldStops, swordPower } from "./armor";
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
  SKELETON_BUILD,
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
import { buildScenery, HORIZON } from "./scenery";
import {
  ARENA_R,
  BLACKSMITH,
  CAMPS,
  COLOSSEUM,
  FIGHT_TRIGGER,
  inArena,
  inCity,
  layoutWorld,
  pushOut,
  SHOP_RANGE,
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
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);

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

interface Foe {
  g: Grunt;
  fig: Figure;
  build: Build;
  shadow: THREE.Mesh;
  flash: number;
  /** Which camp it belongs to, or -1 for Ares's soldiers. */
  camp: number;
}
let foes: Foe[] = [];
let nextId = 1;

function addFoe(kind: GruntKind, x: number, z: number, yaw: number, camp: number): Foe {
  const build = kind === "skeleton" ? SKELETON_BUILD : SPARTAN_BUILD;
  const fig = buildFigure(build);
  if (kind === "spartan") wearKit(fig, { helmet: "bronze", chest: "bronze", arms: "none", legs: "bronze" });
  if (kind === "spartan") fig.crest.color.setHex(0xa3241e);
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

/** Fill a camp back up to strength, so the road always has bones on it. */
function stockCamp(i: number): void {
  const camp = CAMPS[i]!;
  const have = foes.filter((f) => f.camp === i).length;
  for (let n = have; n < camp.count; n++) {
    const a = (n / camp.count) * Math.PI * 2 + i;
    addFoe("skeleton", camp.x + Math.sin(a) * 2.2, camp.z + Math.cos(a) * 2.2, a, i);
  }
}
CAMPS.forEach((_, i) => stockCamp(i));

// Ares and his arena.
type Fight = "waiting" | "on" | "won";
let fight: Fight = save.beaten.includes("ares") ? "won" : "waiting";
let ares: { a: Ares; fig: Figure; shadow: THREE.Mesh; flash: number; stars: THREE.Group } | null = null;
let gateClosed = false;
let reward: { mesh: THREE.Group; x: number; z: number } | null = null;

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
}

function spawnReward(x: number, z: number): void {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 30, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd860, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 15;
  g.add(beam);
  // The armour itself, floating in the light: Ares's helmet over his breastplate.
  const paint = KIT_PAINT.ares;
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
  reward = { mesh: g, x, z };
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
    burst(f.g.x, 1.2, f.g.z, f.g.kind === "skeleton" ? 0xf4ecd0 : 0xffd27a, result === "hurt" ? 8 : 16, 6);
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
  spawnReward(ares.a.x, ares.a.z);
}

function claimReward(): void {
  if (!reward) return;
  scene.remove(reward.mesh);
  burst(reward.x, 1.5, reward.z, 0xffd860, 50, 9, 1.4);
  reward = null;
  save.armor = godKit("ares");
  if (!save.beaten.includes("ares")) save.beaten.push("ares");
  storeSave(save);
  wearKit(heroFig, save.armor);
  hud.setArmor(save.armor);
  hud.banner("Armor of Ares", "Tougher, and your sword hits twice as hard", 4);
  window.setTimeout(() => hud.banner("More gods await…", "Their colosseums are coming soon", 3.5), 4500);
  if (ares) {
    scene.remove(ares.fig.root);
    scene.remove(ares.shadow);
    scene.remove(ares.stars);
    ares = null;
  }
}

function respawn(): void {
  endFight();
  if (fight === "on") fight = "waiting";
  hero = makeHero(START.x, START.z, START.yaw);
  camYaw = START.yaw;
  leftTown = false;
}

let shopRedraw: ((coins: number, armor: typeof save.armor) => void) | null = null;
function openShop(): void {
  shopRedraw = hud.openShop(
    save.coins,
    save.armor,
    (slot) => {
      const sale = buy(slot, save.coins, save.armor);
      if (!sale.ok) return;
      save.coins = sale.coins;
      save.armor = sale.armor;
      storeSave(save);
      wearKit(heroFig, save.armor);
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
  if (aresUp && clock - lastDrag > 1.2) camYaw = lockOn(camYaw, hero, ares!.a, dt);
  else if (!blocking && standing(hero)) camYaw = autoTurn(camYaw, stick.x, dt);
  const move = moveFromStick(stick.x, stick.y, camYaw);

  if (controls.takeAttack() && startSwing(hero)) {
    // Phones get help aiming: the swing turns to the nearest thing in front worth hitting.
    const targets: Array<{ x: number; z: number }> = foes.filter((f) => f.g.state !== "dead").map((f) => f.g);
    if (ares && ares.a.state !== "dead") targets.push(ares.a);
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

  if (stepHero(hero, sim, { move, block: blocking })) swingLands();
  const p = pushOut(world, hero.x, hero.z, RADIUS, gateClosed);
  hero.x = p.x;
  hero.z = p.z;

  if (!standing(hero)) {
    fallTimer += dt;
    if (fallTimer > 2.8) respawn();
  }

  // The city mends you and restocks the road.
  if (inCity(hero.x, hero.z) && standing(hero)) {
    hero.hp = Math.min(MAX_HP, hero.hp + CITY_HEAL * dt);
    for (let i = 0; i < CAMPS.length; i++) stockCamp(i);
    if (leftTown) leftTown = false;
  } else if (!leftTown && hero.z < -26) {
    leftTown = true;
    if (fight !== "won") hud.banner("The Road to Ares", "His colosseum lies to the north", 2.4);
  }

  // Grunts.
  for (const f of foes) {
    const blow = updateGrunt(f.g, sim, { x: hero.x, z: hero.z, alive: standing(hero) });
    if (blow) heroLoses(blow);
    if (f.g.state !== "dead") {
      const q = pushOut(world, f.g.x, f.g.z, 0.45, gateClosed || f.camp === -1);
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
  if (reward && dist(hero.x, hero.z, reward.x, reward.z) < 1.8) claimReward();

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
    fight === "on"
      ? null
      : [
          { id: "colosseum", label: fight === "won" ? "Colosseum" : "Ares", yaw: yawTo(hero.x, hero.z, COLOSSEUM.x, COLOSSEUM.z) },
          { id: "city", label: "City", yaw: yawTo(hero.x, hero.z, 0, 0) },
        ].filter((m) => m.id !== "city" || !inCity(hero.x, hero.z)),
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
  heroFig.root.position.set(hero.x, 0, hero.z);
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
  heroShadow.position.set(hero.x, 0.07, hero.z);

  // The smith hammers on.
  const hammer = (clock * 1.3) % 1;
  poseFigure(smith, dt, { swing: hammer });

  for (const f of foes) {
    const g = f.g;
    f.fig.root.position.set(g.x, 0, g.z);
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
    f.shadow.position.set(g.x, 0.07, g.z);
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
  for (const c of scenery.clouds.children) {
    c.position.x += dt * 2;
    if (c.position.x > 260) c.position.x -= 520;
  }
  updateSparks(dt);

  // Camera: behind the hero, pulled back and up in the arena so the god fits in frame.
  const fighting = ares !== null && ares.a.state !== "dead";
  const back = (fighting ? CAM_DIST + 2.5 : CAM_DIST) * devZoom;
  const up = LOOK_HEIGHT + ((fighting ? CAM_HEIGHT + 1.6 : CAM_HEIGHT) - LOOK_HEIGHT) * devZoom;
  const tx = hero.x;
  const tz = hero.z;
  let cx = tx - Math.sin(camYaw) * back;
  let cz = tz - Math.cos(camYaw) * back;
  // Inside the colosseum the camera stays inside the wall.
  if (inArena(hero.x, hero.z)) {
    const d = dist(cx, cz, COLOSSEUM.x, COLOSSEUM.z);
    const limit = ARENA_R - 0.8;
    if (d > limit) {
      cx = COLOSSEUM.x + ((cx - COLOSSEUM.x) / d) * limit;
      cz = COLOSSEUM.z + ((cz - COLOSSEUM.z) / d) * limit;
    }
  }
  const k = 1 - Math.exp(-dt * 9);
  camPos.lerp(new THREE.Vector3(cx, up, cz), camPos.lengthSq() === 0 ? 1 : k);
  camLook.lerp(new THREE.Vector3(tx, LOOK_HEIGHT, tz), camLook.lengthSq() === 0 ? 1 : Math.min(1, k * 1.6));
  shake = Math.max(0, shake - dt * 1.6);
  const jolt = shake * shake;
  camera.position.set(
    camPos.x + (Math.random() - 0.5) * jolt,
    camPos.y + (Math.random() - 0.5) * jolt,
    camPos.z + (Math.random() - 0.5) * jolt,
  );
  camera.lookAt(camLook);

  // Snap the shadow box to whole texels, or shadows shimmer as the hero walks.
  const texel = (SHADOW_REACH * 2) / sun.shadow.mapSize.x;
  const sx = Math.round(hero.x / texel) * texel;
  const sz = Math.round(hero.z / texel) * texel;
  sun.target.position.set(sx, 0, sz);
  sun.position.set(sx + SUN_OFFSET.x, SUN_OFFSET.y, sz + SUN_OFFSET.z);

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
      state: () => ({ hero, fight, coins: save.coins, armor: save.armor, ares: ares?.a ?? null, foes: foes.map((f) => f.g) }),
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
