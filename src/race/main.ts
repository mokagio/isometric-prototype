import * as THREE from "three";
import { toon } from "../gods/toon";
import { createMenu } from "../ui";
import { createControls } from "./controls";
import { createHud, type Result } from "./hud";
import {
  crystalAt,
  drawItem,
  placeCrystals,
  REGROW,
  ROCKET_LIFE,
  ROCKET_REACH,
  SLICK_BACK,
  SLICK_LIFE,
  SLICK_REACH,
  stepRocket,
  type Crystal,
  type Item,
  type Rocket,
  type Slick,
} from "./items";
import { bump, makeKart, progress, spinOut, stepKart, track, turbo, type Drive, type Kart } from "./kart";
import { CARS, carsUnlocked, RIVAL_STATS, rung, type Rung } from "./ladder";
import { gridSlots, lapShown, ordinal, standings } from "./race";
import { rivalDrive, type Rival } from "./rival";
import { buildCourse, buildKart, PALETTES, type KartModel } from "./scene";
import { loadSave, recordWin, SAVE_KEY, storeSave } from "./save";
import { angleDiff, bendAhead, headingAt, makeTrack, type Track } from "./track";

// ---------------------------------------------------------------------------
// Stage

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1400);
scene.add(new THREE.HemisphereLight(0xe0f0ff, 0x6a7a4a, 1.5));
const sun = new THREE.DirectionalLight(0xfff0d2, 2.3);
const SUN_OFFSET = new THREE.Vector3(30, 55, 20);
const SHADOW_REACH = 45;
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -SHADOW_REACH, right: SHADOW_REACH, top: SHADOW_REACH, bottom: -SHADOW_REACH, near: 5, far: 160 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  baseFov = camera.aspect < 1 ? 78 : 62;
  camera.updateProjectionMatrix();
}
let baseFov = 62;
resize();
window.addEventListener("resize", resize);

// ---------------------------------------------------------------------------
// The run

const save = loadSave();
const hud = createHud();
const controls = createControls();
createMenu("Turbo Karts", {
  onRestart: () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // nothing saved to wipe
    }
    location.reload();
  },
  onAllGames: () => {
    location.href = "index.html";
  },
});

const RIVAL_NAMES = ["Rosa", "Milo", "Juno", "Ziggy", "Pepper"];
const HELMETS = [0xf4f1e8, 0x1c1c22, 0xf2c230, 0x4fc8e8, 0xf08ab0, 0x9adf6a];

interface Racer {
  name: string;
  color: number;
  kart: Kart;
  model: KartModel;
  /** Null for the player, until the line, when the computer drives them home. */
  rival: Rival | null;
  you: boolean;
  item: Item | null;
  /** Seconds the item roulette has left to spin. */
  rolling: number;
  /** For a computer driver: seconds it waits before using what it holds. */
  itemWait: number;
  /** Seconds left of the visible twirl after a spin-out. */
  twirl: number;
}

type Phase = "garage" | "countdown" | "racing" | "done";
let phase: Phase = "garage";
let current: Rung = rung(0);
let course: THREE.Group | null = null;
let t: Track = makeTrack(current.seed, current.shape);
let racers: Racer[] = [];
let crystals: Crystal[] = [];
let slicks: Slick[] = [];
let rockets: Rocket[] = [];
let clock = 0;
let countdown = 0;
let doneFor = 0;
let wrongWay = 0;

const crystalGeo = new THREE.OctahedronGeometry(0.75, 0);
const crystalMeshes: THREE.Mesh[] = [];
const slickGeo = new THREE.CircleGeometry(1.5, 18).rotateX(-Math.PI / 2);
const slickMat = toon(0x1c1a22, { rim: 0.7 });
const slickMeshes: THREE.Mesh[] = [];
const rocketGeo = new THREE.ConeGeometry(0.35, 1.3, 10).rotateX(Math.PI / 2);
const rocketMat = toon(0xd8382c, { emissive: 0x401010 });
const rocketMeshes: THREE.Mesh[] = [];

function you(): Racer {
  return racers.find((r) => r.you)!;
}

function startRace(index: number): void {
  // The garage's view wants a shadow box over the whole course; a race wants a tight one round the player.
  Object.assign(sun.shadow.camera, { left: -SHADOW_REACH, right: SHADOW_REACH, top: SHADOW_REACH, bottom: -SHADOW_REACH, far: 160 });
  sun.shadow.camera.updateProjectionMatrix();
  current = rung(index);
  t = makeTrack(current.seed, current.shape);
  if (course) scene.remove(course);
  for (const r of racers) scene.remove(r.model.root);
  for (const m of [...crystalMeshes, ...slickMeshes, ...rocketMeshes]) scene.remove(m);
  crystalMeshes.length = slickMeshes.length = rocketMeshes.length = 0;
  slicks = [];
  rockets = [];

  const pal = PALETTES[current.theme];
  scene.background = new THREE.Color(pal.sky);
  scene.fog = new THREE.Fog(pal.sky, 90, 420);
  course = buildCourse(t, current.theme, current.name);
  scene.add(course);

  const mine = CARS[save.car]!;
  const others = CARS.filter((_, i) => i !== save.car);
  const field = current.rivals + 1;
  const slots = gridSlots(t, field);
  racers = [];
  for (let i = 0; i < field; i++) {
    // The player starts at the back of the grid: the race is the overtaking.
    const isYou = i === field - 1;
    const slot = slots[i]!;
    const car = isYou ? mine : others[i % others.length]!;
    const kart = makeKart(slot.x, slot.z, slot.yaw, isYou ? car.stats : RIVAL_STATS);
    track(t, kart);
    kart.lap = -1;
    const model = buildKart(car.color, HELMETS[i % HELMETS.length]!);
    scene.add(model.root);
    racers.push({
      name: isYou ? "You" : RIVAL_NAMES[i % RIVAL_NAMES.length]!,
      color: car.color,
      kart,
      model,
      rival: isYou ? null : { lane: (i % 3 - 1) * 2.6, skill: current.skill * (0.97 + 0.03 * (i / field)) },
      you: isYou,
      item: null,
      rolling: 0,
      itemWait: 0,
      twirl: 0,
    });
  }

  crystals = placeCrystals(t);
  for (let i = 0; i < crystals.length; i++) {
    const m = new THREE.Mesh(crystalGeo, toon(0xffffff, { emissive: 0x333333, rim: 0.8 }));
    m.castShadow = true;
    scene.add(m);
    crystalMeshes.push(m);
  }

  clock = 0;
  countdown = 3.6;
  doneFor = 0;
  wrongWay = 0;
  phase = "countdown";
  hud.closePanels();
  hud.setMap(t);
  hud.show(true);
  controls.show(true);
  hud.setItem(null, false);
  hud.setPlace(field, field);
  hud.setLap(1, current.laps);
  hud.setTime(0);
  hud.banner(current.name, `Race ${current.index + 1} · ${current.laps} laps`, 2);
  snapCamera();
}

function showGarage(): void {
  phase = "garage";
  hud.show(false);
  controls.show(false);
  hud.garage(
    save,
    (i) => startRace(i),
    (car) => {
      save.car = car;
      storeSave(save);
    },
  );
}

// ---------------------------------------------------------------------------
// Items

function useItem(r: Racer, place: number): void {
  const item = r.item;
  if (!item || r.rolling > 0) return;
  r.item = null;
  const k = r.kart;
  if (item === "turbo") {
    turbo(k);
  } else if (item === "oil") {
    slicks.push({ x: k.x - Math.sin(k.yaw) * SLICK_BACK, z: k.z - Math.cos(k.yaw) * SLICK_BACK, life: SLICK_LIFE });
  } else {
    const order = standings(t, racers.map((x) => x.kart));
    const ahead = order[Math.max(0, place - 1)]!;
    const self = racers.indexOf(r);
    rockets.push({ x: k.x + Math.sin(k.yaw) * 2, z: k.z + Math.cos(k.yaw) * 2, yaw: k.yaw, target: ahead === self ? -1 : ahead, owner: self, life: ROCKET_LIFE });
  }
}

/** When a computer driver uses what it holds: a turbo on a straight, oil with someone close behind, a rocket once it is lined up. */
function rivalWantsItem(r: Racer, place: number): boolean {
  if (r.itemWait > 0) return false;
  const k = r.kart;
  if (r.item === "turbo") return bendAhead(t, k.s, 40) < 0.35;
  if (r.item === "oil") {
    return racers.some((o) => o !== r && progress(t, k) - progress(t, o.kart) > 2 && progress(t, k) - progress(t, o.kart) < 18) || r.itemWait < -6;
  }
  return place > 0;
}

function hit(r: Racer): void {
  spinOut(r.kart);
  r.twirl = 0.9;
}

function updateItems(dt: number, order: number[]): void {
  for (const c of crystals) c.wait = Math.max(0, c.wait - dt);
  racers.forEach((r, i) => {
    const place = order.indexOf(i);
    const c = crystalAt(crystals, r.kart.x, r.kart.z);
    if (c) {
      c.wait = REGROW;
      if (!r.item) {
        r.item = drawItem(place, racers.length, Math.random());
        r.rolling = 0.9;
        r.itemWait = 1 + Math.random() * 3;
      }
    }
    r.rolling = Math.max(0, r.rolling - dt);
    r.itemWait -= dt;
    if (r.rival && r.item && r.rolling <= 0 && rivalWantsItem(r, place)) useItem(r, place);
  });

  for (let i = slicks.length - 1; i >= 0; i--) {
    const s = slicks[i]!;
    s.life -= dt;
    const victim = racers.find((r) => r.kart.spin <= 0 && Math.hypot(r.kart.x - s.x, r.kart.z - s.z) < SLICK_REACH);
    if (victim) hit(victim);
    if (victim || s.life <= 0) slicks.splice(i, 1);
  }

  for (let i = rockets.length - 1; i >= 0; i--) {
    const rk = rockets[i]!;
    const target = racers[rk.target];
    const aim = target ? target.kart : { x: rk.x + Math.sin(rk.yaw) * 10, z: rk.z + Math.cos(rk.yaw) * 10 };
    stepRocket(rk, aim.x, aim.z, dt);
    const victim = racers.find((r, j) => j !== rk.owner && Math.hypot(r.kart.x - rk.x, r.kart.z - rk.z) < ROCKET_REACH);
    if (victim) {
      hit(victim);
      victim.kart.speed *= 0.3;
    }
    if (victim || rk.life <= 0) rockets.splice(i, 1);
  }
}

// ---------------------------------------------------------------------------
// The race

function update(dt: number): void {
  if (phase === "garage") return;
  const me = you();

  if (phase === "countdown") {
    const before = Math.ceil(countdown - 0.6);
    countdown -= dt;
    const after = Math.ceil(countdown - 0.6);
    if (after !== before && after >= 1 && after <= 3) hud.banner(String(after), "", 0.8);
    if (countdown <= 0.6) {
      phase = "racing";
      hud.banner("GO!", "", 0.9);
    }
    controls.takeItem();
    return;
  }

  clock += dt;
  const order = standings(t, racers.map((r) => r.kart));
  const mine = progress(t, me.kart);

  racers.forEach((r) => {
    let drive: Drive;
    if (r.rival) drive = rivalDrive(t, r.kart, r.rival, progress(t, r.kart) - mine);
    else drive = controls.drive();
    const wasLap = r.kart.lap;
    stepKart(t, r.kart, drive, dt);
    if (r.kart.finished === null && r.kart.lap >= current.laps) r.kart.finished = clock;
    if (r.you && r.kart.lap > wasLap && r.kart.lap === current.laps - 1 && r.kart.finished === null) hud.banner("Final lap!", "", 1.4);
    r.twirl = Math.max(0, r.twirl - dt);
  });
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) bump(racers[i]!.kart, racers[j]!.kart);
  }

  if (me.rival === null && controls.takeItem()) useItem(me, order.indexOf(racers.indexOf(me)));
  updateItems(dt, order);

  // Wrong way: facing back down the road and moving.
  const facing = Math.abs(angleDiff(me.kart.yaw, headingAt(t, me.kart.s)));
  wrongWay = facing > 2 && me.kart.speed > 3 && me.kart.spin <= 0 ? wrongWay + dt : 0;
  if (wrongWay > 1) {
    hud.banner("Wrong way!", "Turn around", 1);
    wrongWay = -1.5;
  }

  const place = order.indexOf(racers.indexOf(me)) + 1;
  hud.setPlace(place, racers.length);
  hud.setLap(lapShown(me.kart, current.laps), current.laps);
  hud.setTime(me.kart.finished ?? clock);
  hud.setItem(me.rolling > 0 ? rollingFace() : me.item, me.rolling > 0);

  if (phase === "racing" && me.kart.finished !== null) {
    phase = "done";
    // The computer drives the player's kart round its lap of honour.
    me.rival = { lane: 0, skill: 0.75 };
    const won = place === 1;
    hud.banner(won ? "You won!" : `${ordinal(place)} place`, won ? "" : "Win to climb the ladder", 2.2);
    finish(won);
  }
  if (phase === "done") {
    doneFor += dt;
  }
}

let rollFace = 0;
function rollingFace(): Item {
  rollFace = (rollFace + 1) % 9;
  return (["turbo", "oil", "rocket"] as const)[Math.floor(rollFace / 3)]!;
}

let resultTimer = 0;
function finish(won: boolean): void {
  const me = you();
  const time = me.kart.finished!;
  let note = "";
  if (won) {
    const before = carsUnlocked(save.won);
    const { climbed, best } = recordWin(save, current.index, time);
    storeSave(save);
    const after = carsUnlocked(save.won);
    if (climbed) note = `${rung(save.won).name} is open.`;
    if (after > before) note += ` New kart: ${CARS[after - 1]!.name}!`;
    if (!climbed && best) note = "A new best time!";
    if (!note) note = "Another win.";
  } else {
    note = "Only a win opens the next track. Try again!";
  }
  window.clearTimeout(resultTimer);
  resultTimer = window.setTimeout(() => {
    const order = standings(t, racers.map((r) => r.kart));
    const rows: Result[] = order.map((i) => {
      const r = racers[i]!;
      return { name: r.name, color: r.color, time: r.kart.finished, you: r.you };
    });
    const actions = [];
    if (won && current.index + 1 <= save.won) actions.push({ label: "Next race", run: () => startRace(current.index + 1) });
    actions.push({ label: won ? "Race again" : "Try again", run: () => startRace(current.index) });
    actions.push({ label: "Garage", run: showGarage });
    hud.show(false);
    controls.show(false);
    hud.results(rows, won, note.trim(), actions);
  }, 2600);
}

// ---------------------------------------------------------------------------
// Drawing

const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
let camYaw = 0;

function snapCamera(): void {
  const k = you().kart;
  camYaw = k.yaw;
  placeCamera(1);
}

function placeCamera(blend: number): void {
  const k = you().kart;
  // Follow the road's heading through a spin, not the kart's twirl.
  const want = k.spin > 0 ? camYaw : k.yaw;
  camYaw += angleDiff(camYaw, want) * Math.min(1, blend * 1.4);
  const back = 7.4;
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  const target = new THREE.Vector3(k.x - fx * back, 3.4, k.z - fz * back);
  camPos.lerp(target, blend >= 1 ? 1 : Math.min(1, blend * 1.1));
  camLook.set(k.x + fx * 6, 1.1, k.z + fz * 6);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  const speed = Math.max(0, k.speed);
  camera.fov = baseFov + speed * 0.35 + (k.boost > 0 ? 6 : 0);
  camera.updateProjectionMatrix();
}

function draw(dt: number, now: number): void {
  if (phase !== "garage") {
    for (const r of racers) {
      const k = r.kart;
      const m = r.model;
      m.root.position.set(k.x, 0, k.z);
      const twirl = r.twirl > 0 ? (1 - r.twirl / 0.9) * Math.PI * 4 : 0;
      m.root.rotation.y = k.yaw + twirl;
      const steer = r.rival ? 0 : controls.drive().steer;
      m.body.rotation.z = -steer * Math.min(1, Math.abs(k.speed) / 20) * 0.08;
      m.body.position.y = Math.sin(now * 0.03 + k.x) * 0.02 * Math.min(1, Math.abs(k.speed) / 5);
      for (const w of m.wheels) w.rotation.x += (k.speed * dt) / 0.42;
      for (const f of m.frontWheels) f.rotation.y = -steer * 0.4;
      m.flame.visible = k.boost > 0;
      m.flame.scale.setScalar(0.8 + Math.random() * 0.4);
    }
    crystals.forEach((c, i) => {
      const m = crystalMeshes[i]!;
      m.visible = c.wait < REGROW - 0.01 && c.wait <= 0.6;
      const grow = c.wait > 0 ? 1 - c.wait / 0.6 : 1;
      m.scale.setScalar(Math.max(0.01, grow));
      m.position.set(c.x, 1.3 + Math.sin(now * 0.003 + i) * 0.2, c.z);
      m.rotation.y = now * 0.002 + i;
      (m.material as THREE.MeshToonMaterial).color.setHSL((now * 0.0002 + i * 0.13) % 1, 0.75, 0.6);
    });
    syncPool(slickMeshes, slicks.length, () => new THREE.Mesh(slickGeo, slickMat), (m, i) => {
      const s = slicks[i]!;
      m.position.set(s.x, 0.05, s.z);
    });
    syncPool(rocketMeshes, rockets.length, () => {
      const m = new THREE.Mesh(rocketGeo, rocketMat);
      m.castShadow = true;
      return m;
    }, (m, i) => {
      const rk = rockets[i]!;
      m.position.set(rk.x, 0.9, rk.z);
      m.rotation.y = rk.yaw;
    });
    const crowd = course?.getObjectByName("crowd");
    if (crowd) crowd.position.y = Math.abs(Math.sin(now * 0.012)) * 0.12;

    placeCamera(Math.min(1, dt * 6));
    const k = you().kart;
    sun.position.set(k.x + SUN_OFFSET.x, SUN_OFFSET.y, k.z + SUN_OFFSET.z);
    sun.target.position.set(k.x, 0, k.z);
    hud.drawMap(racers.map((r) => ({ x: r.kart.x, z: r.kart.z, color: r.color, you: r.you })));
  } else {
    // Behind the garage, the camera circles the last course.
    const a = now * 0.00008;
    camera.position.set(Math.cos(a) * 160, 70, Math.sin(a) * 160);
    camera.lookAt(0, 0, 0);
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
}

function syncPool(pool: THREE.Mesh[], count: number, make: () => THREE.Mesh, place: (m: THREE.Mesh, i: number) => void): void {
  while (pool.length < count) {
    const m = make();
    scene.add(m);
    pool.push(m);
  }
  pool.forEach((m, i) => {
    m.visible = i < count;
    if (i < count) place(m, i);
  });
}

// The garage shows the first open course behind it.
{
  const preview = rung(save.won);
  t = makeTrack(preview.seed, preview.shape);
  const pal = PALETTES[preview.theme];
  scene.background = new THREE.Color(pal.sky);
  scene.fog = new THREE.Fog(pal.sky, 120, 520);
  course = buildCourse(t, preview.theme, preview.name);
  scene.add(course);
  sun.position.copy(SUN_OFFSET);
  sun.target.position.set(0, 0, 0);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -200;
  sun.shadow.camera.right = sun.shadow.camera.top = 200;
  sun.shadow.camera.far = 400;
  sun.shadow.camera.updateProjectionMatrix();
}
showGarage();

// Dev server only: lets a recording script read the race and skip ahead.
if (import.meta.env.DEV) {
  Object.assign(window, {
    race: {
      state: () => ({ phase, clock, rung: current.index, save, racers: racers.map((r) => ({ name: r.name, lap: r.kart.lap, s: r.kart.s, speed: r.kart.speed, item: r.item, finished: r.kart.finished })) }),
      start: (i: number) => startRace(i),
      /** Puts the player just short of the line on the last lap. */
      lastStretch() {
        const k = you().kart;
        k.lap = current.laps - 1;
        const s = t.length - 25;
        const p = { x: t.xs[Math.floor(s / 2)]!, z: t.zs[Math.floor(s / 2)]! };
        k.x = p.x;
        k.z = p.z;
        k.yaw = headingAt(t, s);
        track(t, k);
        k.lap = current.laps - 1;
      },
      /** Hands the player's wheel to the computer, for recording a lap. */
      autopilot() {
        you().rival = { lane: 0, skill: 1 };
      },
      give: (item: Item) => {
        you().item = item;
      },
    },
  });
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  update(dt);
  draw(dt, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
