import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Batch } from "./batch";
import { dist } from "./bearing";
import { ARES_BUILD, boltGeometry, buildFigure, HERO_BUILD, POSEIDON_BUILD, poseFigure, wearKit, ZEUS_BUILD, type Build } from "./figure";
import { MONUMENT, OLYMPUS, OLYMPUS_STAIR_HALF, OLYMPUS_STEP, olympiaHouses, olympusSlope, olympusStepY, ZEUS_RING } from "./zeus";
import { godKit } from "./armor";
import { BRIDGE_HALF as HELL_BRIDGE, BRIDGES, HADES_RING, HOME_PORTAL, ISLAND, ISLANDS, LOW_Y, stairStepY, STAIRS, TARTARUS } from "./hades";
import { toon } from "./toon";
import {
  BRIDGE_HALF,
  ISLAND_R,
  ISLAND_Y,
  LANDING_HALF,
  LANDING_IN,
  LANDING_OUT,
  LAVA_Y,
  PORTAL_R,
  slopeY,
  STAIR_HALF,
  stepY,
  VOLCANO,
} from "./volcano";
import {
  ARENA_R,
  BLACKSMITH,
  BOUNDS,
  CAMPS,
  CITY,
  CITY_GATE_Z,
  COLOSSEUM,
  EAST_ROAD_END,
  EAST_ROAD_Z,
  GATE_HALF,
  hash,
  houses,
  huts,
  inRegions,
  inVillage,
  ISLAND_H,
  SEA_ISLANDS,
  LIGHTHOUSE,
  outside,
  PIER_HALF,
  PIER_LENGTH,
  PIERS,
  SEA_ARENA,
  SEA_STATUE,
  SHORE_X,
  VILLAGE,
  nearColosseum,
  nearRoad,
  PLAZA_R,
  ROAD_END,
  ROAD_HALF,
  ROAD_START,
  trees,
  WALL_THICK,
} from "./world";

export const SKY_TOP = 0x3f8fd8;
export const HORIZON = 0xcfe6f2;

const C = {
  grass: 0x7cbf4a,
  grassDark: 0x5ea33a,
  grassLight: 0xa4d65e,
  dirt: 0xc9ab78,
  cobble: 0xd8c8a4,
  cobbleDark: 0xbfae88,
  cobbleWarm: 0xd6b98c,
  plaza: 0xe2dccb,
  plazaDark: 0xc9bfa6,
  wall: 0xf6f0e2,
  wallWarm: 0xf1e3c8,
  roofRed: 0xc8643c,
  roofDark: 0xa84e2e,
  roofBlue: 0x3e78c4,
  door: 0x7a4a2a,
  shutter: 0x3a7cc2,
  window: 0x23354f,
  marble: 0xeee9dd,
  marbleShade: 0xd9d2c2,
  trunk: 0x7a5232,
  olive: 0x8fae5c,
  oliveDark: 0x6f9248,
  cypress: 0x2e5b30,
  pine: 0x447d38,
  oak: 0x56a03e,
  oakLight: 0x74b84c,
  bush: 0x4c8f3a,
  rock: 0xa8a59c,
  sandstone: 0xd8a47c,
  sandstoneLight: 0xe4b991,
  sandstoneDark: 0xa86f4f,
  arena: 0xe0c08a,
  arch: 0x3e241a,
  banner: 0x9b1c18,
  gold: 0xe8b83e,
  iron: 0x4a4a52,
  water: 0x5fb4e0,
  wood: 0x8a5a34,
  terracotta: 0xb8643a,
  mountain: 0x8fb0cc,
  snow: 0xf4f7fb,
};

/** Fluted, the way a Greek column is: thirty-two shallow grooves round the shaft. */
function fluted(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(1, 1.08, 1, 40, 1);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 - Math.max(0, Math.cos(a * 20)) * 0.07;
    p.setXYZ(i, x * k, p.getY(i), z * k);
  }
  g.computeVertexNormals();
  return g;
}

function lathe(profile: Array<[number, number]>, segments = 18): THREE.BufferGeometry {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), segments);
}

/** A Doric capital: the cushion and the square slab on top of it. */
const ECHINUS = lathe([
  [0.95, 0],
  [1.05, 0.05],
  [1.3, 0.22],
  [1.35, 0.3],
  [0, 0.3],
]);

const AMPHORA = lathe([
  [0, 0],
  [0.12, 0.02],
  [0.28, 0.2],
  [0.34, 0.45],
  [0.3, 0.7],
  [0.14, 0.86],
  [0.1, 0.98],
  [0.14, 1.04],
  [0, 1.05],
]);

const BASIN = lathe([
  [0, 0],
  [2.6, 0],
  [2.7, 0.55],
  [2.9, 0.62],
  [2.9, 0.72],
  [2.5, 0.72],
  [2.45, 0.2],
  [0, 0.2],
]);

/** A rectangle with one or more round-topped openings, for walls you can see through. */
function arcade(width: number, height: number, holes: Array<{ x: number; w: number; bottom: number; top: number }>, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(width / 2, 0);
  s.lineTo(width / 2, height);
  s.lineTo(-width / 2, height);
  s.closePath();
  for (const h of holes) {
    const r = h.w / 2;
    const hole = new THREE.Path();
    hole.moveTo(h.x - r, h.bottom);
    hole.lineTo(h.x - r, h.top - r);
    hole.absarc(h.x, h.top - r, r, Math.PI, 0, true);
    hole.lineTo(h.x + r, h.bottom);
    hole.closePath();
    s.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function prism(width: number, height: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(width / 2, 0);
  s.lineTo(0, height);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 20),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  taper: new THREE.CylinderGeometry(0.7, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 16),
  pyramid: new THREE.ConeGeometry(1, 1, 4),
  dome: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  blob: new THREE.IcosahedronGeometry(1, 1),
  rock: flat(new THREE.IcosahedronGeometry(1, 1)),
  cobble: new THREE.CylinderGeometry(1, 1, 1, 7),
  halfDisc: new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, -Math.PI / 2, Math.PI),
  fluted: fluted(),
};

/** Faceted rather than smooth: each face its own flat colour band. */
function flat(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  n.computeVertexNormals();
  return n;
}

export interface Scenery {
  root: THREE.Group;
  /** The colosseum's portcullis: up is open. */
  gate: THREE.Group;
  /** Brazier and forge flames, flickered every frame. */
  flames: THREE.Mesh[];
  clouds: THREE.Group;
  grass: THREE.ShaderMaterial;
  water: THREE.Mesh;
  sea: THREE.ShaderMaterial;
  /** Poseidon's portcullis: up is open. */
  seaGate: THREE.Group;
  /** The water he floods his arena with, raised by the fight. */
  flood: THREE.Mesh;
  /** Hades's portcullis: up is open. */
  hadesGate: THREE.Group;
  /** Zeus's portcullis: up is open. */
  zeusGate: THREE.Group;
  /** The blocks filling the back of Zeus's colosseum, which break when he does. */
  zeusBack: BackWall;
  /** The last staircase, which the fire monster breaks. */
  hellStairs: HellStairs;
  /** Smoke puffs over the volcano, drifted up every frame. */
  smoke: THREE.Group;
  lava: THREE.MeshBasicMaterial;
  /** The swirl inside each portal, spun every frame: the volcano's, then the way home from Tartarus. */
  portals: THREE.Group[];
  sky: THREE.ShaderMaterial;
}

export function buildScenery(): Scenery {
  const root = new THREE.Group();
  root.add(sky());
  const meadow = ground();
  meadow.receiveShadow = true;
  root.add(meadow);
  const grass = grassField();
  root.add(grass.mesh);
  root.add(flowers());

  const batch = new Batch();
  city(batch);
  road(batch);
  forest(batch);
  colosseum(batch, ARES_LOOK);
  eastRoad(batch);
  village(batch);
  colosseum(batch, SEA_LOOK);
  const torches = volcano(batch);
  const pits = tartarusFloor(batch);
  const olympusTorches = olympus(batch);
  olympia(batch);
  colosseum(batch, ZEUS_LOOK);
  colosseum(batch, HADES_LOOK);
  root.add(batch.build());
  const fire = volcanoFire();
  root.add(fire.group);
  const below = tartarus();
  const sea = seaPlane();
  root.add(sea);
  root.add(mountains());

  // The hero of the city, in marble, sword raised over the fountain.
  root.add(statue(HERO_BUILD, 0xeee9dd, { x: 0, y: 1.55, z: 0 }, Math.PI, 0.95));
  // Ares in bronze, outside his own gate.
  root.add(statue(ARES_BUILD, 0x9c6a3a, { x: COLOSSEUM.x + GATE_HALF + 7, y: 1.6, z: COLOSSEUM.z + ARENA_R + WALL_THICK + 4 }, 0.4, 1.6));
  // Poseidon in green bronze outside his, trident raised to the road.
  root.add(statue(POSEIDON_BUILD, 0x5fa59a, { x: SEA_STATUE.x, y: 1.6, z: SEA_STATUE.z }, -Math.PI / 2 - 0.4, 1.6));

  const flames: THREE.Mesh[] = [];
  // The forge glows at the blacksmith's.
  const forge = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.25, 1.3), new THREE.MeshBasicMaterial({ color: 0xff7a1e }));
  forge.position.set(BLACKSMITH.x + 2.6, 1.05, BLACKSMITH.z - 1.8);
  root.add(forge);
  flames.push(flame(root, BLACKSMITH.x + 2.6, 1.15, BLACKSMITH.z - 1.8, 0.5));

  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.5, 0.1, 32),
    new THREE.MeshBasicMaterial({ color: C.water, transparent: true, opacity: 0.85 }),
  );
  water.position.set(0, 0.55, 0);
  root.add(water);

  for (const f of colosseumFlameSpots()) flames.push(flame(root, f.x, f.y, f.z, 0.7));
  // Poseidon's braziers burn sea-green, and the lighthouse keeps its fire lit.
  for (const f of flameSpots(SEA_LOOK)) flames.push(flame(root, f.x, f.y, f.z, 0.7, 0x2fd6c8, 0xc8fff6));
  flames.push(flame(root, LIGHTHOUSE.x, LIGHTHOUSE_TOP + 0.2, LIGHTHOUSE.z, 1.1));
  for (const t of torches) flames.push(flame(root, t.x, t.y, t.z, 0.45));
  for (const t of pits) flames.push(flame(root, t.x, t.y, t.z, 0.8, 0x3fe07a, 0xc8ffd8));
  for (const f of flameSpots(HADES_LOOK)) flames.push(flame(root, f.x, f.y, f.z, 0.7, 0x3fe07a, 0xc8ffd8));
  const hadesGate = portcullis(HADES_LOOK);
  root.add(hadesGate);
  const zeusGate = portcullis(ZEUS_LOOK);
  root.add(zeusGate);
  for (const f of flameSpots(ZEUS_LOOK)) flames.push(flame(root, f.x, f.y, f.z, 0.7, 0x8fd8ff, 0xffffff));
  for (const t of olympusTorches) flames.push(flame(root, t.x, t.y, t.z, 0.45));
  root.add(olympusClouds());
  // Zeus in gold outside his gate, bolt raised to the city.
  root.add(statue(ZEUS_BUILD, 0xe8b83e, { x: ZEUS_RING.x + GATE_HALF + 7, y: 1.6, z: ZEUS_RING.z - ZEUS_RING.r - ZEUS_RING.thick - 4 }, Math.PI - 0.4, 1.6));
  const zeusBack = backWall(ZEUS_LOOK);
  root.add(zeusBack.group);
  const stairs = hellStairs();
  root.add(stairs.steps, stairs.edges);
  root.add(below);
  const volcanoPortal = portal(VOLCANO.x, ISLAND_Y, VOLCANO.z, Math.PI / 2);
  const homePortal = portal(HOME_PORTAL.x, TARTARUS.y, HOME_PORTAL.z, Math.PI / 2);
  homePortal.visible = false;
  root.add(volcanoPortal, homePortal);

  const gate = portcullis(ARES_LOOK);
  root.add(gate);
  const seaGate = portcullis(SEA_LOOK);
  root.add(seaGate);
  const flood = new THREE.Mesh(
    new THREE.CylinderGeometry(SEA_ARENA.r + 0.2, SEA_ARENA.r + 0.2, 0.08, 56),
    new THREE.MeshBasicMaterial({ color: 0x2f9fd8, transparent: true, opacity: 0.78 }),
  );
  flood.position.set(SEA_ARENA.x, 0, SEA_ARENA.z);
  flood.visible = false;
  root.add(flood);
  const clouds = cloudLayer();
  root.add(clouds);
  return { root, gate, flames, clouds, grass: grass.material, water, sea: sea.material as THREE.ShaderMaterial, seaGate, hadesGate, zeusGate, zeusBack, hellStairs: stairs, flood, smoke: fire.smoke, lava: fire.lava, portals: [volcanoPortal, homePortal], sky: (root.getObjectByName("sky") as THREE.Mesh).material as THREE.ShaderMaterial };
}

/** A figure cast in one material, struck in a pose and set on a plinth. */
function statue(build: Build, color: number, at: { x: number; y: number; z: number }, yaw: number, scale: number): THREE.Group {
  const fig = buildFigure(build);
  if (build === ARES_BUILD) wearKit(fig, godKit("ares"));
  poseFigure(fig, 0, { raise: 0.85, block: 0.2 });
  for (const m of fig.mats) {
    m.vertexColors = false;
    m.needsUpdate = true;
    m.color.setHex(color);
    m.emissive.setHex(0);
  }
  fig.slash.visible = false;
  const g = new THREE.Group();
  fig.root.scale.setScalar(scale);
  fig.root.position.y = at.y;
  fig.root.rotation.y = yaw;
  g.add(fig.root);
  const plinth = new THREE.Mesh(G.box, toon(C.marbleShade));
  plinth.scale.set(1.3 * scale, at.y, 1.3 * scale);
  plinth.position.y = at.y / 2;
  plinth.castShadow = plinth.receiveShadow = true;
  g.add(plinth);
  g.position.set(at.x, 0, at.z);
  return g;
}

/** Wildflowers through the meadow: white, yellow, poppy red and a little purple. */
function flowers(): THREE.InstancedMesh {
  const spots: Array<{ x: number; z: number; c: number }> = [];
  const colors = [0xffffff, 0xffe066, 0xe8463c, 0xb48ae0, 0xffffff, 0xffe066];
  for (let z = BOUNDS.z0; z < BOUNDS.z1; z += 2.3) {
    for (let x = BOUNDS.x0; x < SHORE_X; x += 2.3) {
      const ix = Math.round(x * 7);
      const iz = Math.round(z * 7);
      // Patches rather than an even sprinkle.
      if (hash(Math.floor(x / 14), Math.floor(z / 14), 40) > 0.45 || hash(ix, iz, 41) > 0.5) continue;
      const px = x + (hash(ix, iz, 42) - 0.5) * 2;
      const pz = z + (hash(ix, iz, 43) - 0.5) * 2;
      if (dist(px, pz, CITY.x, CITY.z) < CITY.r || nearRoad(px, pz, 0.5) || nearColosseum(px, pz, 1)) continue;
      if (!inRegions(px, pz) || inVillage(px, pz) || px > SHORE_X - 16) continue;
      spots.push({ x: px, z: pz, c: colors[Math.floor(hash(Math.floor(x / 14), Math.floor(z / 14), 44) * colors.length)]! });
    }
  }
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), spots.length);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    m.makeTranslation(s.x, 0.42 + hash(i, 0, 45) * 0.15, s.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.setHex(s.c));
  });
  return mesh;
}

// ---------------------------------------------------------------------------
// The city

function city(b: Batch): void {
  // Plaza: concentric courses of slabs, alternating, with a marble kerb.
  for (let ring = 0; ring < 5; ring++) {
    const r0 = 3.2 + ring * 1.8;
    const n = Math.round((2 * Math.PI * (r0 + 0.9)) / 1.6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.3;
      const shade = (i + ring) % 3 === 0 ? C.plazaDark : C.plaza;
      b.add(G.box, shade, { x: Math.sin(a) * (r0 + 0.9), y: 0.03, z: Math.cos(a) * (r0 + 0.9) }, { y: a }, {
        x: (2 * Math.PI * (r0 + 0.9)) / n - 0.08,
        y: 0.06,
        z: 1.7,
      });
    }
  }
  b.add(G.cyl, C.plazaDark, { x: 0, y: 0.015, z: 0 }, {}, { x: PLAZA_R + 0.4, y: 0.03, z: PLAZA_R + 0.4 });
  // A paved lane out of the north gate to meet the road.
  for (let z = -PLAZA_R; z > CITY_GATE_Z - 1; z -= 1.2) {
    for (let x = -ROAD_HALF + 0.6; x < ROAD_HALF; x += 1.2) {
      b.add(G.box, (Math.round(x + z) & 1) === 0 ? C.plaza : C.plazaDark, { x, y: 0.04, z }, {}, { x: 1.12, y: 0.07, z: 1.12 });
    }
  }

  // The fountain: a basin with a lip, and the statue's column rising from the water.
  b.add(BASIN, C.marble, { x: 0, y: 0, z: 0 });
  b.add(G.fluted, C.marble, { x: 0, y: 0.85, z: 0 }, {}, { x: 0.35, y: 1.4, z: 0.35 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    // Lion-head spouts.
    b.add(G.blob, C.marble, { x: Math.sin(a) * 0.42, y: 1.1, z: Math.cos(a) * 0.42 }, {}, 0.14);
  }

  for (const h of houses()) house(b, h.x, h.z, h.w, h.d, h.yaw, h.dome);

  // City gate: two fluted columns, an entablature with triglyphs, a pediment.
  for (const sx of [-4.5, 4.5]) column(b, sx, CITY_GATE_Z, 5.0, 0.55);
  b.add(G.box, C.marble, { x: 0, y: 5.55, z: CITY_GATE_Z }, {}, { x: 11, y: 0.5, z: 1.5 });
  for (let i = -5; i <= 5; i++) b.add(G.box, i % 2 ? C.marbleShade : 0x4a6fa8, { x: i * 0.95, y: 6.05, z: CITY_GATE_Z + 0.02 }, {}, { x: 0.5, y: 0.5, z: 1.5 });
  b.add(G.box, C.marble, { x: 0, y: 6.4, z: CITY_GATE_Z }, {}, { x: 11.4, y: 0.25, z: 1.7 });
  b.add(prism(11.4, 1.6, 1.4), C.marble, { x: 0, y: 6.52, z: CITY_GATE_Z });
  b.add(prism(9.4, 1.1, 1.45), C.roofRed, { x: 0, y: 6.62, z: CITY_GATE_Z });

  smithy(b);
  market(b);
}

function house(b: Batch, x: number, z: number, w: number, d: number, yaw: number, dome: boolean): void {
  const h = 3.4;
  const wall = hash(x, z, 50) > 0.5 ? C.wall : C.wallWarm;
  b.add(G.box, C.marbleShade, { x, y: 0.15, z }, {}, { x: w + 0.25, y: 0.3, z: d + 0.25 });
  b.add(G.box, wall, { x, y: h / 2 + 0.15, z }, {}, { x: w, y: h, z: d });
  b.add(G.box, C.marble, { x, y: h + 0.22, z }, {}, { x: w + 0.3, y: 0.18, z: d + 0.3 });
  if (dome) {
    b.add(G.cyl, wall, { x, y: h + 0.6, z }, {}, { x: Math.min(w, d) * 0.36, y: 0.6, z: Math.min(w, d) * 0.36 });
    b.add(G.dome, C.roofBlue, { x, y: h + 0.88, z }, {}, Math.min(w, d) * 0.38);
    b.add(G.cyl8, C.marble, { x, y: h + 0.88 + Math.min(w, d) * 0.38, z }, {}, { x: 0.06, y: 0.4, z: 0.06 });
  } else {
    // A tiled roof that overhangs the walls, with a ridge cap.
    const roof = hash(x, z, 51) > 0.4 ? C.roofRed : C.roofDark;
    b.add(G.pyramid, roof, { x, y: h + 1.1, z }, { y: Math.PI / 4 }, { x: (w + 0.9) * 0.72, y: 1.7, z: (d + 0.9) * 0.72 });
    // Tile courses: darker bands round the roof.
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      b.add(G.pyramid, C.roofDark, { x, y: h + 0.25 + t * 1.7 - 0.02, z }, { y: Math.PI / 4 }, {
        x: (w + 0.9) * 0.72 * (1 - t) + 0.03,
        y: 0.06,
        z: (d + 0.9) * 0.72 * (1 - t) + 0.03,
      });
    }
  }
  // Door, frame, steps, and shuttered windows on the face toward the plaza.
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const half = Math.abs(fx) > 0.5 ? w / 2 : d / 2;
  const ax = Math.abs(fz);
  const az = Math.abs(fx);
  const at = (side: number, y: number, out = 0.02): { x: number; y: number; z: number } => ({
    x: x + fx * (half + out) + ax * side,
    y,
    z: z + fz * (half + out) + az * side,
  });
  b.add(G.box, C.marble, at(0, 1.25, 0.04), { y: yaw }, { x: 1.4, y: 2.3, z: 0.1 });
  b.add(G.box, C.door, at(0, 1.15, 0.08), { y: yaw }, { x: 1.0, y: 1.9, z: 0.08 });
  b.add(G.halfDisc, C.door, at(0, 2.1, 0.08), { y: yaw, x: Math.PI / 2 }, { x: 0.5, y: 0.08, z: 0.5 });
  b.add(G.box, C.marbleShade, at(0, 0.1, 0.45), { y: yaw }, { x: 1.6, y: 0.2, z: 0.7 });
  for (const side of [-1.7, 1.7]) {
    b.add(G.box, C.window, at(side, 2.3, 0.04), { y: yaw }, { x: 0.7, y: 0.8, z: 0.06 });
    b.add(G.box, C.shutter, at(side - 0.55, 2.3, 0.08), { y: yaw }, { x: 0.36, y: 0.86, z: 0.06 });
    b.add(G.box, C.shutter, at(side + 0.55, 2.3, 0.08), { y: yaw }, { x: 0.36, y: 0.86, z: 0.06 });
    // A window box of geraniums.
    b.add(G.box, C.terracotta, at(side, 1.8, 0.18), { y: yaw }, { x: 0.9, y: 0.2, z: 0.25 });
    for (let f = -1; f <= 1; f++) b.add(G.blob, f === 0 ? 0xe8463c : C.bush, at(side + f * 0.28, 1.98, 0.2), {}, 0.13);
  }
  // A pot by the door.
  b.add(AMPHORA, C.terracotta, at(1.0, 0, 0.5), {}, 0.7);
  b.add(G.blob, C.bush, at(-1.05, 0.35, 0.45), {}, { x: 0.35, y: 0.4, z: 0.35 });
}

function column(b: Batch, x: number, z: number, height: number, r: number, color = C.marble): void {
  b.add(G.box, color, { x, y: 0.12, z }, {}, { x: r * 2.8, y: 0.24, z: r * 2.8 });
  b.add(G.cyl, color, { x, y: 0.3, z }, {}, { x: r * 1.15, y: 0.14, z: r * 1.15 });
  b.add(G.fluted, color, { x, y: height / 2 + 0.3, z }, {}, { x: r, y: height - 0.6, z: r });
  b.add(ECHINUS, color, { x, y: height - 0.3, z }, {}, { x: r, y: r, z: r });
  b.add(G.box, color, { x, y: height + 0.05, z }, {}, { x: r * 2.8, y: 0.25, z: r * 2.8 });
}

function smithy(b: Batch): void {
  const { x, z } = BLACKSMITH;
  // Stone counter facing the plaza (west), forge behind it.
  b.add(G.box, C.wood, { x: x + 0.3, y: 0.55, z }, {}, { x: 0.9, y: 1.1, z: 4.6 });
  b.add(G.box, C.wood, { x: x + 0.2, y: 1.12, z }, {}, { x: 1.1, y: 0.08, z: 4.8 });
  b.add(G.box, 0xb9ad94, { x: x + 2.6, y: 0.5, z: z - 1.8 }, {}, { x: 1.8, y: 1.0, z: 1.8 });
  b.add(G.taper, 0x9a8f7a, { x: x + 2.6, y: 2.4, z: z - 1.8 }, {}, { x: 0.5, y: 2.8, z: 0.5 });
  // Anvil: waist and a horned face.
  b.add(G.taper, C.iron, { x: x + 2.4, y: 0.4, z: z + 1.4 }, {}, { x: 0.3, y: 0.8, z: 0.3 });
  b.add(G.box, C.iron, { x: x + 2.4, y: 0.88, z: z + 1.4 }, {}, { x: 0.42, y: 0.2, z: 0.85 });
  b.add(G.cone, C.iron, { x: x + 2.4, y: 0.88, z: z + 2.0 }, { x: Math.PI / 2 }, { x: 0.12, y: 0.4, z: 0.12 });
  // Posts and a striped awning, scalloped at the edge.
  for (const [dx, dz] of [
    [-0.2, -2.8],
    [-0.2, 2.8],
    [3.6, -2.8],
    [3.6, 2.8],
  ] as const) {
    b.add(G.cyl8, C.wood, { x: x + dx, y: 1.6, z: z + dz }, {}, { x: 0.1, y: 3.2, z: 0.1 });
  }
  for (let i = 0; i < 6; i++) {
    const zz = z - 2.75 + i * 1.1;
    const col = i % 2 ? 0xf4ead2 : C.banner;
    b.add(G.box, col, { x: x + 1.7, y: 3.3, z: zz }, { z: 0.18 }, { x: 4.6, y: 0.08, z: 1.1 });
    b.add(G.halfDisc, col, { x: x - 0.6, y: 2.88, z: zz }, { z: Math.PI / 2, y: Math.PI / 2 }, { x: 0.5, y: 0.05, z: 0.3 });
  }
  // Wares on display: helmet and breastplate on a stand, a rack of swords, amphorae.
  b.add(G.cyl8, C.wood, { x: x - 1.2, y: 0.8, z: z + 3.4 }, {}, { x: 0.05, y: 1.6, z: 0.05 });
  b.add(G.dome, 0xc8913a, { x: x - 1.2, y: 1.6, z: z + 3.4 }, {}, 0.3);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI - Math.PI / 2;
    b.add(G.box, 0x2f6fb5, { x: x - 1.2, y: 1.9 + Math.cos(a) * 0.12, z: z + 3.4 + Math.sin(a) * 0.25 }, { x: -a }, { x: 0.06, y: 0.12, z: 0.1 });
  }
  b.add(G.taper, 0xc8913a, { x: x - 1.2, y: 1.15, z: z + 3.4 }, { x: Math.PI }, { x: 0.32, y: 0.55, z: 0.22 });
  for (let i = 0; i < 3; i++) {
    b.add(G.box, 0xdfe8f0, { x: x + 3.5, y: 1.1, z: z + 0.8 + i * 0.4 }, { z: 0.1 }, { x: 0.05, y: 0.9, z: 0.1 });
  }
  b.add(G.box, C.wood, { x: x + 3.5, y: 0.6, z: z + 1.2 }, {}, { x: 0.2, y: 0.12, z: 1.3 });
  for (let i = 0; i < 3; i++) b.add(AMPHORA, C.terracotta, { x: x - 0.9 + i * 0.5, y: 0, z: z - 3.6 }, { y: i }, 0.8 - i * 0.1);
}

/** A couple of stalls on the plaza, so the city looks lived in. */
function market(b: Batch): void {
  const stalls = [
    { x: -9, z: 6, color: 0x2f6fb5, goods: [0xe8463c, 0xffd23a, 0x7cbf4a] },
    { x: -10, z: -4, color: 0x5a9a3a, goods: [0x9b59b6, 0xe8b83e, 0xf08a3a] },
  ];
  for (const s of stalls) {
    b.add(G.box, C.wood, { x: s.x, y: 0.5, z: s.z }, {}, { x: 1.2, y: 1.0, z: 2.6 });
    for (const dz of [-1.3, 1.3]) for (const dx of [-0.6, 0.6]) b.add(G.cyl8, C.wood, { x: s.x + dx, y: 1.3, z: s.z + dz }, {}, { x: 0.06, y: 2.6, z: 0.06 });
    b.add(G.box, s.color, { x: s.x, y: 2.65, z: s.z }, { z: 0.15 }, { x: 1.7, y: 0.08, z: 3.0 });
    s.goods.forEach((c, i) => {
      for (let n = 0; n < 4; n++) b.add(G.blob, c, { x: s.x - 0.25 + (n % 2) * 0.3, y: 1.12, z: s.z - 0.8 + i * 0.8 + Math.floor(n / 2) * 0.25 }, {}, 0.13);
    });
    b.add(AMPHORA, C.terracotta, { x: s.x + 0.9, y: 0, z: s.z + 1.6 }, {}, 0.7);
  }
}

// ---------------------------------------------------------------------------
// The road

function road(b: Batch): void {
  // A bed of packed earth, then cobbles laid over it in staggered courses.
  b.add(G.box, C.dirt, { x: 0, y: 0.015, z: (ROAD_START + ROAD_END) / 2 }, {}, { x: ROAD_HALF * 2 + 0.6, y: 0.03, z: ROAD_START - ROAD_END });
  const tones = [C.cobble, C.cobbleDark, C.cobbleWarm];
  for (let z = ROAD_START - 0.4; z > ROAD_END; z -= 0.95) {
    const iz = Math.round(z * 10);
    const off = Math.round(z / 0.95) % 2 ? 0.47 : 0;
    for (let x = -ROAD_HALF + 0.4 + off; x < ROAD_HALF - 0.2; x += 0.95) {
      const ix = Math.round(x * 10);
      const r = 0.38 + hash(ix, iz, 11) * 0.12;
      // Stones thin out toward the edge, where the grass is taking the road back.
      if (Math.abs(x) > ROAD_HALF - 0.9 && hash(ix, iz, 14) > 0.5) continue;
      b.add(G.cobble, tones[Math.floor(hash(ix, iz, 12) * 3)]!, { x: x + (hash(ix, iz, 13) - 0.5) * 0.15, y: 0.05, z }, { y: hash(ix, iz, 15) * 3 }, {
        x: r,
        y: 0.1,
        z: r * 0.9,
      });
    }
  }
  // Columns along the way, some standing, some fallen into drums.
  for (let z = ROAD_START - 8; z > ROAD_END + 6; z -= 14) {
    for (const side of [-1, 1]) {
      const iz = Math.round(z);
      const broken = hash(iz, side, 13) > 0.55;
      const x = side * (ROAD_HALF + 1.6);
      if (!broken) {
        column(b, x, z, 4.4, 0.42);
      } else {
        const height = 1.2 + hash(iz, side, 14) * 1.5;
        b.add(G.box, C.marble, { x, y: 0.12, z }, {}, { x: 1.2, y: 0.24, z: 1.2 });
        b.add(G.fluted, C.marble, { x, y: height / 2 + 0.2, z }, {}, { x: 0.42, y: height, z: 0.42 });
        for (let d = 0; d < 2; d++) {
          b.add(G.fluted, C.marbleShade, { x: x + side * (1.3 + d * 1.1), y: 0.42, z: z + 0.5 - d * 0.3 }, { z: Math.PI / 2, y: 0.4 + d }, { x: 0.42, y: 0.9, z: 0.42 });
        }
        b.add(ECHINUS, C.marbleShade, { x: x - side * 1.1, y: 0.0, z: z - 1.0 }, { z: 0.3 }, 0.42);
      }
    }
  }
  // Each camp: a ring of stones, a cold fire, and a broken shield.
  for (const camp of CAMPS) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      b.add(G.rock, C.rock, { x: camp.x + Math.sin(a) * 4.8, y: 0.2, z: camp.z + Math.cos(a) * 4.8 }, { y: a }, { x: 0.5 + (i % 3) * 0.15, y: 0.4, z: 0.5 });
    }
    b.add(G.cyl8, 0x3a3a3a, { x: camp.x, y: 0.05, z: camp.z }, {}, { x: 0.9, y: 0.1, z: 0.9 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.add(G.rock, 0x7a7670, { x: camp.x + Math.sin(a) * 0.95, y: 0.1, z: camp.z + Math.cos(a) * 0.95 }, { y: a }, 0.22);
      b.add(G.cyl8, 0x4a3020, { x: camp.x + Math.sin(a) * 0.35, y: 0.15, z: camp.z + Math.cos(a) * 0.35 }, { z: 1.2, y: a }, { x: 0.06, y: 0.8, z: 0.06 });
    }
    // Bedrolls round the fire, and the loot in sacks.
    for (let i = 0; i < 3; i++) {
      const a = hash(i, Math.round(camp.z), 16) * Math.PI * 2;
      const roll = i % 2 ? 0x7a1f1a : 0x6b5a3a;
      b.add(G.cyl8, roll, { x: camp.x + Math.sin(a) * 3.2, y: 0.16, z: camp.z + Math.cos(a) * 3.2 }, { z: Math.PI / 2, y: a + Math.PI / 2 }, { x: 0.18, y: 1.4, z: 0.18 });
    }
    b.add(G.blob, 0x9a7a4a, { x: camp.x + 2, y: 0.3, z: camp.z - 2.2 }, {}, { x: 0.36, y: 0.42, z: 0.34 });
    b.add(G.blob, 0x8a6a3e, { x: camp.x + 2.6, y: 0.24, z: camp.z - 1.7 }, {}, { x: 0.3, y: 0.34, z: 0.3 });
    b.add(G.cyl, 0x8a6a3a, { x: camp.x - 2.4, y: 0.05, z: camp.z + 1.4 }, { x: 0.1 }, { x: 0.5, y: 0.04, z: 0.5 });
  }
}

// ---------------------------------------------------------------------------
// Trees: olives near town, cypress spires, umbrella pines and round oaks further out.

function forest(b: Batch): void {
  for (const t of trees()) {
    const ix = Math.round(t.x * 10);
    const iz = Math.round(t.z * 10);
    const s = t.size;
    const kind = hash(ix, iz, 16);
    const near = dist(t.x, t.z, CITY.x, CITY.z) < 60;
    const turn = hash(ix, iz, 17) * 6;
    if (kind < (near ? 0.35 : 0.12)) olive(b, t.x, t.z, s, turn);
    else if (kind < (near ? 0.6 : 0.35)) cypress(b, t.x, t.z, s);
    else if (kind < 0.6) umbrellaPine(b, t.x, t.z, s, turn);
    else oak(b, t.x, t.z, s, turn);
    if (hash(ix, iz, 18) > 0.7) b.add(G.blob, C.bush, { x: t.x + 1.4, y: 0.35, z: t.z - 0.9 }, {}, { x: 0.7, y: 0.55, z: 0.6 });
    if (hash(ix, iz, 19) > 0.85) b.add(G.rock, C.rock, { x: t.x - 1.5, y: 0.25, z: t.z + 1 }, { y: turn }, { x: 0.7, y: 0.5, z: 0.6 });
  }
}

function olive(b: Batch, x: number, z: number, s: number, turn: number): void {
  // A gnarled trunk that forks low.
  b.add(G.taper, 0x6e5a44, { x, y: 0.7 * s, z }, { z: 0.15, y: turn }, { x: 0.28 * s, y: 1.4 * s, z: 0.28 * s });
  b.add(G.taper, 0x6e5a44, { x: x + 0.3 * s, y: 1.6 * s, z }, { z: -0.5 }, { x: 0.15 * s, y: 1.1 * s, z: 0.15 * s });
  b.add(G.taper, 0x6e5a44, { x: x - 0.25 * s, y: 1.6 * s, z: z + 0.1 }, { z: 0.55 }, { x: 0.14 * s, y: 1.1 * s, z: 0.14 * s });
  for (let i = 0; i < 6; i++) {
    const a = turn + (i / 6) * Math.PI * 2;
    const r = i % 2 ? 0.9 : 0.5;
    b.add(G.blob, i % 3 ? C.olive : C.oliveDark, { x: x + Math.sin(a) * r * s, y: (2.3 + (i % 3) * 0.3) * s, z: z + Math.cos(a) * r * s }, {}, {
      x: 0.85 * s,
      y: 0.6 * s,
      z: 0.85 * s,
    });
  }
}

function cypress(b: Batch, x: number, z: number, s: number): void {
  b.add(G.taper, C.trunk, { x, y: 0.4 * s, z }, {}, { x: 0.18 * s, y: 0.8 * s, z: 0.18 * s });
  b.add(G.blob, C.cypress, { x, y: 3.0 * s, z }, {}, { x: 0.85 * s, y: 2.8 * s, z: 0.85 * s });
  b.add(G.cone, C.cypress, { x, y: 5.9 * s, z }, {}, { x: 0.45 * s, y: 1.4 * s, z: 0.45 * s });
}

function umbrellaPine(b: Batch, x: number, z: number, s: number, turn: number): void {
  b.add(G.taper, C.trunk, { x, y: 2.2 * s, z }, { z: 0.08, y: turn }, { x: 0.2 * s, y: 4.4 * s, z: 0.2 * s });
  b.add(G.blob, C.pine, { x, y: 4.9 * s, z }, {}, { x: 2.6 * s, y: 0.8 * s, z: 2.6 * s });
  b.add(G.blob, 0x528f42, { x: x + 0.8 * s, y: 5.3 * s, z: z + 0.4 * s }, {}, { x: 1.6 * s, y: 0.6 * s, z: 1.6 * s });
  b.add(G.blob, 0x3a6e30, { x: x - 0.9 * s, y: 4.6 * s, z: z - 0.5 * s }, {}, { x: 1.4 * s, y: 0.5 * s, z: 1.4 * s });
}

function oak(b: Batch, x: number, z: number, s: number, turn: number): void {
  b.add(G.taper, C.trunk, { x, y: 1.2 * s, z }, { y: turn }, { x: 0.3 * s, y: 2.4 * s, z: 0.3 * s });
  b.add(G.blob, C.oak, { x, y: 3.3 * s, z }, {}, { x: 1.9 * s, y: 1.6 * s, z: 1.9 * s });
  b.add(G.blob, C.oakLight, { x: x + 0.8 * s, y: 3.9 * s, z: z + 0.3 * s }, {}, 1.15 * s);
  b.add(G.blob, 0x4a8c36, { x: x - 0.9 * s, y: 3.0 * s, z: z - 0.4 * s }, {}, 1.05 * s);
}

// ---------------------------------------------------------------------------
// A colosseum: an arcade of two storeys outside, tiers of seats inside, a
// podium wall round the sand, and its god's colours hung everywhere. Drawn
// with the gate toward +z, then stood where it belongs and turned to face its road.

const WALL_H = 10.5;
const PODIUM = 2.6;
const TIERS = 5;

interface ArenaLook {
  x: number;
  z: number;
  r: number;
  thick: number;
  /** Which way the gate faces. */
  yaw: number;
  stone: number;
  light: number;
  dark: number;
  arch: number;
  seats: number;
  seatsShade: number;
  floor: number;
  rake: number;
  banner: number;
  accent: number;
  device: "spear" | "trident" | "bident" | "bolt";
  /** Floor height, for a colosseum that is not on the ground. */
  y?: number;
  /** A roof over the seats, hung with stalactites. */
  roof?: boolean;
  /** A gap in the back wall as wide as the gate, filled by something that can break. */
  back?: boolean;
}

const ARES_LOOK: ArenaLook = {
  ...COLOSSEUM,
  r: ARENA_R,
  thick: WALL_THICK,
  yaw: 0,
  stone: C.sandstone,
  light: C.sandstoneLight,
  dark: C.sandstoneDark,
  arch: C.arch,
  seats: C.marble,
  seatsShade: C.marbleShade,
  floor: C.arena,
  rake: 0xcfae78,
  banner: C.banner,
  accent: C.gold,
  device: "spear",
};

const SEA_LOOK: ArenaLook = {
  ...SEA_ARENA,
  stone: 0xd2e0de,
  light: 0xeef5f3,
  dark: 0x8fb0b6,
  arch: 0x1c3442,
  seats: 0xf4f7f5,
  seatsShade: 0xd2dedd,
  floor: 0xeadcb0,
  rake: 0x7fb8c8,
  banner: 0x1f4f9a,
  accent: 0x3fc6c0,
  device: "trident",
};

const ZEUS_LOOK: ArenaLook = {
  ...ZEUS_RING,
  back: true,
  stone: 0xeee9dd,
  light: 0xfbf8f0,
  dark: 0xc9c0ac,
  arch: 0x2a3a5a,
  seats: 0xf6f2e8,
  seatsShade: 0xe2dccb,
  floor: 0xe8e0c8,
  rake: 0x8fb8e8,
  banner: 0x2a4fb0,
  accent: 0xe8b83e,
  device: "bolt",
};

const HADES_LOOK: ArenaLook = {
  ...HADES_RING,
  y: TARTARUS.y,
  stone: 0x3a3038,
  light: 0x4a3e48,
  dark: 0x241c24,
  arch: 0x0a080c,
  seats: 0x2e262e,
  seatsShade: 0x262028,
  floor: 0x2a2228,
  rake: 0x2f8a4e,
  banner: 0x3a1a4a,
  accent: 0x5fe08a,
  device: "bident",
  roof: true,
};

/** A spot in a colosseum's own frame, out in the world. */
function arenaToWorld(L: ArenaLook, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(L.yaw);
  const s = Math.sin(L.yaw);
  return { x: L.x + c * lx + s * lz, z: L.z - s * lx + c * lz };
}

/** Braziers in the colosseum's own frame: six round the floor and a pair outside the gate. */
function brazierSpots(L: ArenaLook): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    out.push({ x: Math.sin(a) * (L.r - 3), z: Math.cos(a) * (L.r - 3) });
  }
  const gz = L.r + L.thick + 1.5;
  out.push({ x: -GATE_HALF - 2.5, z: gz }, { x: GATE_HALF + 2.5, z: gz });
  return out;
}

/** A trident standing on its butt at the origin of `at`, facing +z. */
function tridentDevice(b: Batch, color: number, at: { x: number; y: number; z: number }, size: number, prongs = [-0.3, 0, 0.3]): void {
  b.add(G.box, color, { x: at.x, y: at.y, z: at.z }, {}, { x: 0.1 * size, y: 1.5 * size, z: 0.04 });
  b.add(G.box, color, { x: at.x, y: at.y + 0.45 * size, z: at.z }, {}, { x: 0.7 * size, y: 0.1 * size, z: 0.04 });
  for (const x of prongs) {
    const h = x === 0 ? 0.55 : 0.4;
    b.add(G.box, color, { x: at.x + x * size, y: at.y + (0.5 + h / 2) * size, z: at.z }, {}, { x: 0.08 * size, y: h * size, z: 0.04 });
    b.add(G.pyramid, color, { x: at.x + x * size, y: at.y + (0.5 + h + 0.08) * size, z: at.z }, { y: Math.PI / 4 }, { x: 0.12 * size, y: 0.18 * size, z: 0.04 });
  }
}

function colosseum(b: Batch, L: ArenaLook): void {
  b.setFrame(L.x, L.z, L.yaw, L.y ?? 0);
  const R = L.r;
  const T = L.thick;
  const segments = Math.max(28, Math.round((44 * R) / 20));
  const outer = R + T;
  const span = ((2 * Math.PI * outer) / segments) * 1.005;
  const facade = arcade(span, WALL_H, [
    { x: 0, w: span * 0.56, bottom: 0, top: 4.4 },
    { x: 0, w: span * 0.5, bottom: 5.4, top: 9.0 },
  ], 0.5);
  const innerSpan = ((2 * Math.PI * R) / segments) * 1.01;

  b.add(G.cyl, L.floor, { x: 0, y: 0.03, z: 0 }, {}, { x: R + 0.5, y: 0.06, z: R + 0.5 });
  // Rake marks in the sand.
  for (let r = 4; r < R - 1; r += 3.2) {
    b.add(new THREE.TorusGeometry(1, L.device === "spear" ? 0.012 : 0.05, 3, 64), L.rake, { x: 0, y: 0.065, z: 0 }, { x: Math.PI / 2 }, { x: r, y: r, z: 1 });
  }

  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const sx = Math.sin(a);
    const sz = Math.cos(a);
    if (Math.abs(sx * (R + T / 2)) < GATE_HALF + span / 2 && (sz > 0 || L.back)) continue;
    const at = (r: number, y: number): { x: number; y: number; z: number } => ({ x: sx * r, y, z: sz * r });
    const shade = i % 2 ? L.stone : L.light;

    // Outside: the arcade, with half-columns between the arches and a cornice per storey.
    b.add(facade, shade, at(outer - 0.25, 0), { y: a });
    b.add(G.box, L.arch, at(outer - 0.9, WALL_H / 2), { y: a }, { x: span, y: WALL_H, z: 0.3 });
    b.add(G.cyl, L.dark, at(outer + 0.05, 4.9), { y: a }, { x: span * 1.0, y: 0.3, z: 0.25 });
    b.add(G.box, L.dark, at(outer + 0.02, 4.85), { y: a }, { x: span, y: 0.35, z: 0.4 });
    b.add(G.box, L.dark, at(outer + 0.02, WALL_H), { y: a }, { x: span, y: 0.4, z: 0.5 });
    const edge = a + Math.PI / segments;
    const ex = Math.sin(edge) * (outer + 0.1);
    const ez = Math.cos(edge) * (outer + 0.1);
    b.add(G.fluted, L.light, { x: ex, y: 2.2, z: ez }, {}, { x: 0.28, y: 4.4, z: 0.28 });
    b.add(G.fluted, L.light, { x: ex, y: 7.2, z: ez }, {}, { x: 0.25, y: 3.6, z: 0.25 });
    // Every other bay carries a mast for an awning, with a pennant.
    if (i % 2 === 0) {
      b.add(G.cyl8, C.wood, at(outer - 0.2, WALL_H + 1.6), {}, { x: 0.07, y: 3.2, z: 0.07 });
      b.add(G.box, L.banner, at(outer - 0.2, WALL_H + 2.6), { y: a + Math.PI / 2 }, { x: 0.9, y: 0.5, z: 0.03 });
    }

    // Inside: a podium wall round the sand, and tiers rising back to the arcade.
    b.add(G.box, L.light, at(R + 0.3, PODIUM / 2), { y: a }, { x: innerSpan, y: PODIUM, z: 0.6 });
    b.add(G.box, L.seats, at(R + 0.25, PODIUM + 0.1), { y: a }, { x: innerSpan, y: 0.2, z: 0.75 });
    const depth = (T - 1.0) / TIERS;
    for (let t = 0; t < TIERS; t++) {
      const r0 = R + 0.6 + t * depth;
      const y = PODIUM + (t + 1) * ((WALL_H - PODIUM - 0.6) / TIERS);
      const midR = (r0 + outer - 0.9) / 2;
      const arc = ((2 * Math.PI * midR) / segments) * 1.02;
      b.add(G.box, t % 2 ? L.seatsShade : L.seats, at(midR, y / 2), { y: a }, { x: arc, y, z: outer - 0.9 - r0 });
    }
    // The god's colours: a hanging with a boss on every fourth bay of the podium.
    if (i % 4 === 2) {
      b.add(G.box, L.banner, at(R - 0.02, PODIUM / 2 + 0.2), { y: a }, { x: innerSpan * 0.55, y: PODIUM - 0.2, z: 0.05 });
      b.add(G.cyl, L.accent, at(R - 0.06, PODIUM / 2 + 0.4), { y: a, x: Math.PI / 2 }, { x: 0.32, y: 0.04, z: 0.32 });
      b.add(G.box, L.accent, at(R - 0.05, 0.38), { y: a }, { x: innerSpan * 0.55, y: 0.1, z: 0.06 });
    }
  }

  // The gate: an arch flanked by towers, the god's banners either side.
  const gz = R + T / 2;
  const gateWall = arcade(GATE_HALF * 2 + 3.2, WALL_H + 1.5, [{ x: 0, w: GATE_HALF * 2, bottom: 0, top: 6 + GATE_HALF }], T + 0.6);
  b.add(gateWall, L.light, { x: 0, y: 0, z: gz });
  b.add(G.box, L.accent, { x: 0, y: 6.1 + GATE_HALF, z: gz + T / 2 + 0.32 }, {}, { x: 0.7, y: 0.9, z: 0.1 });
  for (const side of [-1, 1]) {
    const tx = side * (GATE_HALF + 2.4);
    const front = gz + T / 2;
    b.add(G.box, L.dark, { x: tx, y: (WALL_H + 3) / 2, z: gz }, {}, { x: 2.4, y: WALL_H + 3, z: T + 1.6 });
    b.add(G.box, L.stone, { x: tx, y: WALL_H + 3.2, z: gz }, {}, { x: 2.8, y: 0.4, z: T + 2 });
    for (let m = -1; m <= 1; m++) b.add(G.box, L.dark, { x: tx + m * 0.9, y: WALL_H + 3.75, z: front + 0.6 }, {}, { x: 0.5, y: 0.7, z: 0.5 });
    b.add(G.box, L.banner, { x: tx, y: 6.8, z: front + 0.85 }, {}, { x: 1.7, y: 6.4, z: 0.06 });
    b.add(G.box, L.accent, { x: tx, y: 9.8, z: front + 0.88 }, {}, { x: 1.7, y: 0.18, z: 0.08 });
    if (L.device === "spear") {
      // A gold spear-and-shield device on each banner.
      b.add(G.cyl, L.accent, { x: tx, y: 7.6, z: front + 0.9 }, { x: Math.PI / 2 }, { x: 0.5, y: 0.05, z: 0.5 });
      b.add(G.box, L.banner, { x: tx, y: 7.6, z: front + 0.94 }, { z: Math.PI / 4 }, { x: 0.1, y: 1.3, z: 0.04 });
    } else if (L.device === "bolt") {
      b.add(boltGeometry(), L.accent, { x: tx, y: 6.0, z: front + 0.92 }, { z: 0.15 }, 3.2);
    } else {
      tridentDevice(b, L.accent, { x: tx, y: 7.2, z: front + 0.92 }, 1.3, L.device === "bident" ? [-0.2, 0.2] : undefined);
      // Waves along the foot of the banner.
      for (let w = -1; w <= 1; w++) b.add(G.halfDisc, L.accent, { x: tx + w * 0.55, y: 4.6, z: front + 0.9 }, { x: Math.PI / 2 }, { x: 0.27, y: 0.04, z: 0.27 });
    }
    b.add(prism(1.7, 0.6, 0.06), L.banner, { x: tx, y: 3.6, z: front + 0.85 }, { z: Math.PI });
  }

  // Braziers: tripod legs and a bowl.
  for (const f of brazierSpots(L)) {
    for (let l = 0; l < 3; l++) {
      const a = (l / 3) * Math.PI * 2;
      b.add(G.cyl8, C.iron, { x: f.x + Math.sin(a) * 0.25, y: 0.8, z: f.z + Math.cos(a) * 0.25 }, { x: Math.cos(a) * 0.2, z: -Math.sin(a) * 0.2 }, { x: 0.05, y: 1.7, z: 0.05 });
    }
    b.add(G.dome, C.iron, { x: f.x, y: 1.95, z: f.z }, { x: Math.PI }, { x: 0.6, y: 0.35, z: 0.6 });
    b.add(G.cyl, L.device === "spear" ? 0xb88a2e : L.accent, { x: f.x, y: 1.95, z: f.z }, {}, { x: 0.62, y: 0.06, z: 0.62 });
  }
  // Spears stuck in the sand and a fallen shield or two for Ares; tridents and seashells for Poseidon.
  for (let i = 0; i < 10; i++) {
    const a = hash(i, 3, 21) * Math.PI * 2;
    const r = R * 0.3 + hash(i, 4, 21) * R * 0.5;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (L.device === "spear") {
      b.add(G.cyl8, C.wood, { x, y: 0.9, z }, { x: 0.25, z: 0.2 }, { x: 0.035, y: 2, z: 0.035 });
      b.add(G.cone, C.iron, { x: x + 0.05, y: 1.95, z: z + 0.22 }, { x: 0.25, z: 0.2 }, { x: 0.07, y: 0.32, z: 0.07 });
      if (i % 3 === 0) b.add(G.cyl, 0xc8913a, { x: x + 1.2, y: 0.08, z: z - 0.6 }, { x: 0.12, z: 0.1 }, { x: 0.4, y: 0.06, z: 0.4 });
    } else if (L.device === "bolt") {
      // Scorch marks where lightning has struck the sand before.
      b.add(G.cyl, 0x8a8478, { x, y: 0.065, z }, {}, { x: 0.9, y: 0.01, z: 0.9 });
    } else if (L.device === "bident") {
      // Bones, and the rubble of stalactites that came down before.
      b.add(G.cyl8, 0xe9e1c9, { x, y: 0.05, z }, { z: Math.PI / 2, y: a }, { x: 0.05, y: 0.7, z: 0.05 });
      b.add(G.rock, 0x3a3038, { x: x + 1.3, y: 0.15, z: z - 0.7 }, { y: a }, 0.45);
    } else {
      b.add(G.dome, i % 2 ? 0xf6c6c0 : 0xfff4e6, { x, y: 0.05, z }, { y: a }, { x: 0.22, y: 0.12, z: 0.28 });
      b.add(G.dome, 0xf2a9a0, { x: x + 1.4, y: 0.05, z: z - 0.8 }, { y: -a }, { x: 0.16, y: 0.1, z: 0.2 });
    }
  }
  if (L.roof) {
    // A ceiling over the whole thing, its underside bristling with stalactites, and a dome on top.
    const top = WALL_H + 0.6;
    b.add(G.cyl, L.dark, { x: 0, y: top, z: 0 }, {}, { x: R + T + 0.4, y: 1.2, z: R + T + 0.4 });
    b.add(G.dome, L.stone, { x: 0, y: top + 0.6, z: 0 }, {}, { x: R + T, y: 5, z: R + T });
    b.add(G.dome, L.dark, { x: 0, y: top + 5.4, z: 0 }, {}, { x: 3, y: 1.4, z: 3 });
    for (let k = 0; k < 44; k++) {
      const a = hash(k, 5, 82) * Math.PI * 2;
      const d = Math.sqrt(hash(k, 6, 82)) * (R + 1);
      const len = 0.8 + hash(k, 7, 82) * 1.8;
      b.add(G.cone, k % 3 ? L.stone : L.light, { x: Math.sin(a) * d, y: top - 0.6 - len / 2, z: Math.cos(a) * d }, { x: Math.PI }, { x: 0.25 + len * 0.12, y: len, z: 0.25 + len * 0.12 });
    }
  }
  if (L.device === "trident") {
    // A blue mosaic star of waves in the middle of the sand.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      b.add(G.box, 0x2f7fb8, { x: Math.sin(a) * 2.2, y: 0.07, z: Math.cos(a) * 2.2 }, { y: a }, { x: 0.5, y: 0.02, z: 3.2 });
    }
    b.add(G.cyl, 0x3fc6c0, { x: 0, y: 0.075, z: 0 }, {}, { x: 1.4, y: 0.02, z: 1.4 });
  }
  b.setFrame();
}

/** Where a colosseum's braziers burn, out in the world. */
function flameSpots(L: ArenaLook): Array<{ x: number; y: number; z: number }> {
  return brazierSpots(L).map((p) => ({ ...arenaToWorld(L, p.x, p.z), y: (L.y ?? 0) + 1.95 }));
}

export function colosseumFlameSpots(): Array<{ x: number; y: number; z: number }> {
  return flameSpots(ARES_LOOK);
}

// ---------------------------------------------------------------------------
// The road east and the fishing village

function eastRoad(b: Batch): void {
  const z = EAST_ROAD_Z;
  const from = ROAD_HALF;
  b.add(G.box, C.dirt, { x: (from + EAST_ROAD_END) / 2, y: 0.015, z }, {}, { x: EAST_ROAD_END - from, y: 0.03, z: ROAD_HALF * 2 + 0.6 });
  // Worn flagstones, thinning toward the verges.
  for (let x = from + 0.6; x < EAST_ROAD_END - 0.5; x += 1.25) {
    for (let k = -2; k <= 2; k++) {
      const ix = Math.round(x * 10);
      if (hash(ix, k, 60) > 0.55 - Math.abs(k) * 0.12) continue;
      const shade = [C.cobble, C.cobbleDark, C.cobbleWarm][Math.floor(hash(ix, k, 61) * 3)]!;
      b.add(G.cobble, shade, { x: x + (hash(ix, k, 62) - 0.5) * 0.4, y: 0.04, z: z + k * 1.3 }, { y: hash(ix, k, 63) * 3 }, { x: 0.55, y: 0.06, z: 0.45 });
    }
  }
  // Milestones, alternating sides.
  for (let x = from + 14, i = 0; x < EAST_ROAD_END - 6; x += 16, i++) {
    const side = i % 2 ? 1 : -1;
    b.add(G.box, C.marbleShade, { x, y: 0.45, z: z + side * (ROAD_HALF + 0.9) }, {}, { x: 0.45, y: 0.9, z: 0.35 });
    b.add(G.halfDisc, C.marbleShade, { x, y: 0.9, z: z + side * (ROAD_HALF + 0.9) }, { x: Math.PI / 2 }, { x: 0.225, y: 0.35, z: 0.225 });
  }
  // A signpost at the fork: red for Ares up the road, blue for Poseidon by the sea.
  const sx = ROAD_HALF + 1.2;
  const sz = z + ROAD_HALF + 1.2;
  b.add(G.cyl8, C.wood, { x: sx, y: 1.3, z: sz }, {}, { x: 0.09, y: 2.6, z: 0.09 });
  b.add(G.box, C.banner, { x: sx, y: 2.2, z: sz - 0.55 }, {}, { x: 0.08, y: 0.42, z: 1.1 });
  b.add(G.pyramid, C.banner, { x: sx, y: 2.2, z: sz - 1.2 }, { x: -Math.PI / 2, y: Math.PI / 4 }, { x: 0.3, y: 0.3, z: 0.3 });
  b.add(G.box, 0x2a6cb0, { x: sx + 0.55, y: 1.7, z: sz }, {}, { x: 1.1, y: 0.42, z: 0.08 });
  b.add(G.pyramid, 0x2a6cb0, { x: sx + 1.2, y: 1.7, z: sz }, { z: -Math.PI / 2, y: Math.PI / 4 }, { x: 0.3, y: 0.3, z: 0.3 });
  b.add(G.blob, C.rock, { x: sx, y: 0.1, z: sz }, {}, { x: 0.4, y: 0.25, z: 0.4 });
}

const HUT = { wall: 0xf6f3ec, blue: 0x2a6cb0, thatch: 0xc9a35a, thatchDark: 0xa8843f, net: 0x8a7656 };

function fishHut(b: Batch, x: number, z: number, w: number, d: number, yaw: number): void {
  const h = 2.7;
  b.add(G.box, 0xd6d0c2, { x, y: 0.12, z }, {}, { x: w + 0.25, y: 0.24, z: d + 0.25 });
  b.add(G.box, HUT.wall, { x, y: h / 2 + 0.12, z }, {}, { x: w, y: h, z: d });
  // A steep thatched roof along the long side, with a ridge pole.
  const along = w >= d;
  const roofW = (along ? d : w) + 0.9;
  const roofL = (along ? w : d) + 0.7;
  const turn = along ? 0 : Math.PI / 2;
  b.add(prism(roofW, 1.6, roofL), HUT.thatch, { x, y: h + 0.1, z }, { y: turn + Math.PI / 2 });
  b.add(prism(roofW * 0.55, 0.9, roofL + 0.02), HUT.thatchDark, { x, y: h + 0.78, z }, { y: turn + Math.PI / 2 });
  b.add(G.cyl8, C.wood, { x, y: h + 1.72, z }, { z: Math.PI / 2, y: turn }, { x: 0.08, y: roofL + 0.3, z: 0.08 });
  // The front: a blue door and shutters, a net hung to dry, a lobster pot and oars.
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const half = Math.abs(fx) > 0.5 ? w / 2 : d / 2;
  const ax = Math.abs(fz);
  const az = Math.abs(fx);
  const at = (side: number, y: number, out = 0.02): { x: number; y: number; z: number } => ({
    x: x + fx * (half + out) + ax * side,
    y,
    z: z + fz * (half + out) + az * side,
  });
  b.add(G.box, HUT.blue, at(-0.6, 1.05, 0.05), { y: yaw }, { x: 0.95, y: 1.8, z: 0.08 });
  b.add(G.box, C.window, at(1.1, 1.75, 0.04), { y: yaw }, { x: 0.6, y: 0.6, z: 0.06 });
  b.add(G.box, HUT.blue, at(0.68, 1.75, 0.08), { y: yaw }, { x: 0.26, y: 0.66, z: 0.06 });
  b.add(G.box, HUT.blue, at(1.52, 1.75, 0.08), { y: yaw }, { x: 0.26, y: 0.66, z: 0.06 });
  b.add(G.box, HUT.net, at(1.1, 0.75, 0.1), { y: yaw, x: 0.08 }, { x: 1.3, y: 0.9, z: 0.03 });
  for (let k = 0; k < 4; k++) b.add(G.blob, k % 2 ? 0xf08a3a : 0xffffff, at(0.6 + k * 0.33, 1.22, 0.14), {}, 0.07);
  b.add(G.cyl8, 0x9a7448, at(-1.6, 0.3, 0.6), {}, { x: 0.32, y: 0.6, z: 0.32 });
  b.add(G.cyl8, 0x6e5232, at(-1.6, 0.62, 0.6), {}, { x: 0.22, y: 0.05, z: 0.22 });
  b.add(G.cyl8, C.wood, at(1.9, 1.0, 0.25), { y: yaw, z: 0.25 }, { x: 0.045, y: 2.1, z: 0.045 });
  b.add(G.box, C.wood, at(2.12, 0.15, 0.25), { y: yaw, z: 0.25 }, { x: 0.18, y: 0.5, z: 0.04 });
}

/** A Greek fishing boat: a round hull, a painted rail, and an eye on the bow to find the way home. */
function boat(b: Batch, x: number, y: number, z: number, yaw: number, hull: number, rail: number, mast: boolean): void {
  b.add(G.cyl, hull, { x, y, z }, { y: yaw, z: Math.PI / 2 }, { x: 0.75, y: 4.2, z: 0.75 });
  b.add(G.cone, hull, { x: x + Math.cos(yaw) * 2.45, y, z: z - Math.sin(yaw) * 2.45 }, { y: yaw, z: -Math.PI / 2 }, { x: 0.75, y: 0.7, z: 0.75 });
  b.add(G.box, 0x5a3a22, { x, y: y + 0.68, z }, { y: yaw }, { x: 4.0, y: 0.06, z: 1.25 });
  b.add(G.box, rail, { x, y: y + 0.74, z }, { y: yaw }, { x: 4.3, y: 0.1, z: 1.55 });
  for (const side of [-1, 1]) {
    const ex = x + Math.cos(yaw) * 2.1 + Math.sin(yaw) * side * 0.62;
    const ez = z - Math.sin(yaw) * 2.1 + Math.cos(yaw) * side * 0.62;
    b.add(G.blob, 0xffffff, { x: ex, y: y + 0.42, z: ez }, {}, 0.13);
    b.add(G.blob, 0x1b1b2a, { x: ex + Math.sin(yaw) * side * 0.06, y: y + 0.42, z: ez + Math.cos(yaw) * side * 0.06 }, {}, 0.07);
  }
  b.add(G.box, C.wood, { x, y: y + 0.8, z }, { y: yaw + 0.3 }, { x: 0.12, y: 0.06, z: 2.4 });
  if (mast) {
    b.add(G.cyl8, C.wood, { x, y: y + 2.4, z }, {}, { x: 0.07, y: 3.4, z: 0.07 });
    b.add(G.cyl8, C.wood, { x, y: y + 3.6, z }, { y: yaw, z: Math.PI / 2 }, { x: 0.05, y: 2.6, z: 0.05 });
    b.add(G.box, 0xf4ead2, { x, y: y + 3.4, z }, { y: yaw, z: 0.06 }, { x: 2.3, y: 0.35, z: 0.05 });
  }
}

export const LIGHTHOUSE_TOP = 13;

function village(b: Batch): void {
  for (const h of huts()) fishHut(b, h.x, h.z, h.w, h.d, h.yaw);

  // Stone islands in Poseidon's arena, to stand on when the sea comes in.
  for (const c of SEA_ISLANDS) {
    b.add(G.cyl, 0x9fb4b8, { x: c.x, y: ISLAND_H / 2, z: c.z }, {}, { x: c.r, y: ISLAND_H, z: c.r });
    b.add(G.cyl, 0xeef5f3, { x: c.x, y: ISLAND_H - 0.05, z: c.z }, {}, { x: c.r + 0.1, y: 0.1, z: c.r + 0.1 });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      b.add(G.rock, 0x8fa4a8, { x: c.x + Math.sin(a) * c.r, y: 0.15, z: c.z + Math.cos(a) * c.r }, { y: a }, 0.35);
    }
  }

  // A sandy lane from Poseidon's colosseum down to the docks.
  const laneFrom = SEA_ARENA.x + SEA_ARENA.r + SEA_ARENA.thick;
  b.add(G.box, 0xdcc48e, { x: (laneFrom + SHORE_X) / 2, y: 0.02, z: VILLAGE.z }, {}, { x: SHORE_X - laneFrom, y: 0.03, z: 5 });

  // Piers: planks on posts, with bollards and a coil of rope.
  for (const pz of PIERS) {
    for (let x = SHORE_X - 2; x < SHORE_X + PIER_LENGTH; x += 0.5) {
      const shade = hash(Math.round(x * 2), pz, 64) > 0.5 ? 0x9a6a3e : 0x86592f;
      b.add(G.box, shade, { x: x + 0.25, y: 0.08, z: pz }, { x: (hash(Math.round(x * 2), pz, 65) - 0.5) * 0.04 }, { x: 0.46, y: 0.08, z: PIER_HALF * 2 });
    }
    for (let x = SHORE_X; x <= SHORE_X + PIER_LENGTH; x += 3) {
      for (const side of [-1, 1]) {
        b.add(G.cyl8, 0x5a3a22, { x, y: -0.6, z: pz + side * (PIER_HALF + 0.1) }, {}, { x: 0.14, y: 1.8, z: 0.14 });
      }
      b.add(G.cyl8, 0x4a3020, { x, y: 0.3, z: pz + PIER_HALF - 0.15 }, {}, { x: 0.12, y: 0.4, z: 0.12 });
    }
    b.add(new THREE.TorusGeometry(0.22, 0.06, 6, 12), 0xd8c49a, { x: SHORE_X + 8, y: 0.16, z: pz - 0.7 }, { x: Math.PI / 2 }, 1);
    // A boat tied up alongside.
    boat(b, SHORE_X + 9, -0.25, pz + PIER_HALF + 1.6, 0, hash(pz, 1, 66) > 0.5 ? 0x2a6cb0 : 0xc8463a, 0xf4ead2, true);
  }

  // Boats pulled up on the beach, a net rack and fish drying in the sun.
  const beached = [
    { z: -52, yaw: 0.25, hull: 0xf4ead2, rail: 0x2a6cb0 },
    { z: -30, yaw: -0.2, hull: 0x2f8f8a, rail: 0xe8b83e },
    { z: -12, yaw: 0.1, hull: 0xc8463a, rail: 0xf4ead2 },
    { z: -68, yaw: -0.3, hull: 0x2a6cb0, rail: 0xf4ead2 },
  ];
  for (const s of beached) boat(b, SHORE_X - 4, 0.05, s.z, s.yaw, s.hull, s.rail, false);
  for (const rz of [-46, -24, -6]) {
    const rx = SHORE_X - 10;
    for (const side of [-1.5, 1.5]) b.add(G.cyl8, C.wood, { x: rx, y: 1.1, z: rz + side }, {}, { x: 0.07, y: 2.2, z: 0.07 });
    b.add(G.cyl8, C.wood, { x: rx, y: 2.15, z: rz }, { x: Math.PI / 2 }, { x: 0.05, y: 3.2, z: 0.05 });
    b.add(G.box, HUT.net, { x: rx, y: 1.45, z: rz }, {}, { x: 0.03, y: 1.3, z: 2.9 });
    for (let k = 0; k < 6; k++) b.add(G.blob, k % 2 ? 0xf08a3a : 0xffffff, { x: rx + 0.04, y: 0.82, z: rz - 1.25 + k * 0.5 }, {}, 0.08);
  }
  for (const rz of [-36, -16]) {
    const rx = SHORE_X - 15;
    for (const side of [-1.3, 1.3]) b.add(G.cyl8, C.wood, { x: rx, y: 0.9, z: rz + side }, {}, { x: 0.06, y: 1.8, z: 0.06 });
    b.add(G.cyl8, C.wood, { x: rx, y: 1.75, z: rz }, { x: Math.PI / 2 }, { x: 0.04, y: 2.8, z: 0.04 });
    for (let k = 0; k < 7; k++) {
      b.add(G.blob, 0xb8c8d2, { x: rx, y: 1.45, z: rz - 1.05 + k * 0.35 }, {}, { x: 0.03, y: 0.24, z: 0.08 });
      b.add(G.cone, 0x8a9aa6, { x: rx, y: 1.17, z: rz - 1.05 + k * 0.35 }, { x: Math.PI }, { x: 0.06, y: 0.1, z: 0.02 });
    }
  }

  // The fish market by the colosseum: a striped awning over the day's catch.
  const mx = SEA_ARENA.x + SEA_ARENA.r + SEA_ARENA.thick + 4;
  const mz = VILLAGE.z - 8;
  b.add(G.box, C.wood, { x: mx, y: 0.5, z: mz }, {}, { x: 1.3, y: 1.0, z: 3.2 });
  for (const dz of [-1.6, 1.6]) for (const dx of [-0.7, 0.7]) b.add(G.cyl8, C.wood, { x: mx + dx, y: 1.3, z: mz + dz }, {}, { x: 0.06, y: 2.6, z: 0.06 });
  for (let i = 0; i < 5; i++) b.add(G.box, i % 2 ? 0xffffff : HUT.blue, { x: mx, y: 2.65, z: mz - 1.5 + i * 0.75 }, { z: 0.15 }, { x: 1.9, y: 0.08, z: 0.75 });
  for (let i = 0; i < 9; i++) {
    b.add(G.blob, i % 4 === 3 ? 0xe86a5a : 0xb8c8d2, { x: mx - 0.3 + (i % 3) * 0.3, y: 1.1, z: mz - 1.1 + Math.floor(i / 3) * 0.9 }, { y: 0.3 * i }, { x: 0.1, y: 0.07, z: 0.32 });
  }
  b.add(G.blob, 0x9a4ab8, { x: mx + 0.1, y: 1.12, z: mz + 1.3 }, {}, { x: 0.22, y: 0.18, z: 0.22 });

  // Barrels, crates and amphorae about the docks.
  for (let i = 0; i < 10; i++) {
    const x = SHORE_X - 8 + hash(i, 1, 67) * 6;
    const z = VILLAGE.z - 30 + hash(i, 2, 67) * 60;
    if (PIERS.some((pz) => Math.abs(z - pz) < 3) || Math.abs(z - VILLAGE.z) < 4) continue;
    const kind = i % 3;
    if (kind === 0) {
      b.add(G.cyl, 0x8a5a34, { x, y: 0.5, z }, {}, { x: 0.42, y: 1.0, z: 0.42 });
      for (const y of [0.2, 0.8]) b.add(G.cyl, C.iron, { x, y, z }, {}, { x: 0.44, y: 0.06, z: 0.44 });
    } else if (kind === 1) {
      b.add(G.box, 0xa87a48, { x, y: 0.35, z }, { y: hash(i, 3, 67) }, { x: 0.8, y: 0.7, z: 0.8 });
    } else {
      b.add(AMPHORA, C.terracotta, { x, y: 0, z }, {}, 0.75);
    }
  }

  // The lighthouse at the end of the middle pier: a tapering white tower banded in blue.
  const { x: lx, z: lz } = LIGHTHOUSE;
  b.add(G.cyl, C.rock, { x: lx, y: -0.9, z: lz }, {}, { x: 3.4, y: 2.2, z: 3.4 });
  b.add(G.cyl, 0xd6d0c2, { x: lx, y: 0.2, z: lz }, {}, { x: 3.2, y: 0.1, z: 3.2 });
  b.add(G.taper, HUT.wall, { x: lx, y: 5.6, z: lz }, {}, { x: 1.7, y: 11, z: 1.7 });
  for (const y of [3, 7]) b.add(G.taper, HUT.blue, { x: lx, y, z: lz }, {}, { x: 2.0 - y * 0.07, y: 0.9, z: 2.0 - y * 0.07 });
  b.add(G.cyl, C.marbleShade, { x: lx, y: 11.2, z: lz }, {}, { x: 1.6, y: 0.3, z: 1.6 });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    b.add(G.cyl8, C.marble, { x: lx + Math.sin(a) * 1.0, y: 12.1, z: lz + Math.cos(a) * 1.0 }, {}, { x: 0.1, y: 1.6, z: 0.1 });
  }
  b.add(G.cone, HUT.blue, { x: lx, y: LIGHTHOUSE_TOP + 1.4, z: lz }, {}, { x: 1.5, y: 1.4, z: 1.5 });
  b.add(G.dome, C.iron, { x: lx, y: LIGHTHOUSE_TOP, z: lz }, { x: Math.PI }, { x: 0.6, y: 0.35, z: 0.6 });
  b.add(G.box, HUT.blue, { x: lx - 1.75, y: 1.2, z: lz }, {}, { x: 0.08, y: 2.0, z: 1.0 });
}

/** The sea: shallow turquoise at the beach going to deep blue, with glints that drift. */
function seaPlane(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      time: { value: 0 },
      shore: { value: SHORE_X },
      shallow: { value: new THREE.Color(0x5fd0d8) },
      deep: { value: new THREE.Color(0x1f6fb8) },
      fogColor: { value: new THREE.Color(HORIZON) },
      fogNear: { value: 40 },
      fogFar: { value: 200 },
    },
    vertexShader: `
      varying vec3 vWorld; varying float vDepth;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 view = viewMatrix * w;
        vDepth = -view.z;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform float time; uniform float shore; uniform vec3 shallow; uniform vec3 deep;
      uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      varying vec3 vWorld; varying float vDepth;
      void main() {
        float out_ = vWorld.x - shore;
        vec3 c = mix(shallow, deep, smoothstep(0.0, 28.0, out_));
        // Foam where the waves break on the sand.
        float foam = smoothstep(1.4, 0.0, out_ + sin(vWorld.z * 0.35 + time * 1.4) * 0.5 + 0.6);
        float glint = step(0.92, sin(vWorld.x * 0.9 + time * 0.8) * sin(vWorld.z * 0.7 - time * 0.6));
        c = mix(c, vec3(1.0), max(foam * 0.85, glint * 0.35));
        gl_FragColor = vec4(mix(c, fogColor, smoothstep(fogNear, fogFar, vDepth)), 0.92);
        #include <colorspace_fragment>
      }`,
  });
  const g = new THREE.PlaneGeometry(500, 900, 1, 1);
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, material);
  mesh.position.set(SHORE_X - 2 + 250, -0.25, -75);
  return mesh;
}

// ---------------------------------------------------------------------------
// The volcano: a cone of dark rock, one staircase up it, lava in the crater
// and a rock island with a pool in the middle.

const ROCK = { dark: 0x4a3c38, mid: 0x5e4c46, step: 0x8a7a70, stepDark: 0x74665e, nose: 0xa8988c };

/** Returns where the stair torches burn. */
function volcano(b: Batch): Array<{ x: number; y: number; z: number }> {
  const { x: vx, z: vz, r, h, rim } = VOLCANO;
  // The cone, faceted, with its crater dished out of the top.
  const cone = flat(
    lathe(
      [
        [r + 2, -1],
        [r, 0],
        [LANDING_OUT, h],
        [rim, h],
        [rim - 0.6, h - 1],
        [rim - 0.5, LAVA_Y - 0.6],
        [0, LAVA_Y - 0.6],
      ],
      36,
    ),
  );
  b.add(cone, ROCK.dark, { x: vx, y: 0, z: vz });
  // Ridges of lighter rock running down the flanks.
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + 0.2;
    if (Math.abs(Math.sin(a) - 1) < 0.08) continue;
    const d = rim + 8 + hash(k, 1, 70) * 22;
    b.add(G.rock, ROCK.mid, { x: vx + Math.sin(a) * d, y: slopeY(d) + 0.3, z: vz + Math.cos(a) * d }, { y: a }, { x: 1.6, y: 1.0, z: 3.2 });
  }

  // The staircase, one block per step, each a little proud of the slope.
  const torches: Array<{ x: number; y: number; z: number }> = [];
  const run = 1.2;
  let i = 0;
  for (let d = LANDING_OUT; d < r; d += run, i++) {
    const top = stepY(d + run / 2);
    b.add(G.box, i % 2 ? ROCK.step : ROCK.stepDark, { x: vx + d + run / 2, y: top - 0.75, z: vz }, {}, { x: run, y: 1.5, z: STAIR_HALF * 2 });
    b.add(G.box, ROCK.nose, { x: vx + d + run - 0.06, y: top - 0.04, z: vz }, {}, { x: 0.14, y: 0.1, z: STAIR_HALF * 2 + 0.02 });
    // A torch every few steps, on alternate sides.
    if (i % 5 === 2) {
      const side = i % 10 === 2 ? 1 : -1;
      const tz = vz + side * (STAIR_HALF + 0.35);
      const ty = slopeY(d + run / 2);
      b.add(G.cyl8, C.wood, { x: vx + d + run / 2, y: ty + 0.6, z: tz }, {}, { x: 0.07, y: 1.6, z: 0.07 });
      b.add(G.cyl8, C.iron, { x: vx + d + run / 2, y: ty + 1.4, z: tz }, {}, { x: 0.16, y: 0.18, z: 0.16 });
      torches.push({ x: vx + d + run / 2, y: ty + 1.45, z: tz });
    }
  }
  // Bones and skulls at the foot, to say what is up there.
  for (const side of [-1, 1]) {
    const px = vx + r + 1;
    const pz = vz + side * (STAIR_HALF + 1);
    b.add(G.box, ROCK.step, { x: px, y: 1.2, z: pz }, {}, { x: 0.7, y: 2.4, z: 0.7 });
    b.add(G.blob, 0xe9e1c9, { x: px, y: 2.6, z: pz }, {}, { x: 0.3, y: 0.28, z: 0.32 });
    b.add(G.blob, 0x1b1410, { x: px + 0.22, y: 2.62, z: pz - 0.1 }, {}, 0.07);
    b.add(G.blob, 0x1b1410, { x: px + 0.22, y: 2.62, z: pz + 0.1 }, {}, 0.07);
  }
  // A worn path to it from the meadow.
  const pathFrom = BOUNDS.x0 + 2;
  b.add(G.box, C.dirt, { x: (pathFrom + vx + r) / 2, y: 0.02, z: vz }, {}, { x: pathFrom - (vx + r), y: 0.03, z: 4.5 });

  // The landing on the lip, and the bridge down to the island.
  b.add(G.box, ROCK.step, { x: vx + (LANDING_IN + LANDING_OUT) / 2, y: h - 0.6, z: vz }, {}, { x: LANDING_OUT - LANDING_IN, y: 1.2, z: LANDING_HALF * 2 });
  const slabs = 10;
  for (let k = 0; k < slabs; k++) {
    const d0 = ISLAND_R - 0.4 + ((LANDING_IN - ISLAND_R + 0.4) * k) / slabs;
    const d1 = ISLAND_R - 0.4 + ((LANDING_IN - ISLAND_R + 0.4) * (k + 1)) / slabs;
    const y = ISLAND_Y + (h - ISLAND_Y) * Math.max(0, ((d0 + d1) / 2 - ISLAND_R) / (LANDING_IN - ISLAND_R));
    b.add(G.box, k % 2 ? ROCK.step : ROCK.stepDark, { x: vx + (d0 + d1) / 2, y: y - 0.3, z: vz }, {}, { x: d1 - d0 + 0.05, y: 0.6, z: BRIDGE_HALF * 2 });
  }
  for (const d of [ISLAND_R + 1.5, (ISLAND_R + LANDING_IN) / 2 + 0.5]) {
    b.add(G.cyl8, ROCK.dark, { x: vx + d, y: LAVA_Y, z: vz }, {}, { x: 0.6, y: 3, z: 0.6 });
  }
  // The island: a stump of rock standing in the lava, a rim of stones round its pool.
  b.add(G.cyl, ROCK.mid, { x: vx, y: (ISLAND_Y + LAVA_Y - 1) / 2, z: vz }, {}, { x: ISLAND_R + 0.2, y: ISLAND_Y - LAVA_Y + 1, z: ISLAND_R + 0.2 });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    b.add(G.rock, ROCK.dark, { x: vx + Math.sin(a) * ISLAND_R, y: LAVA_Y + 0.2, z: vz + Math.cos(a) * ISLAND_R }, { y: a }, 0.8);
    b.add(G.rock, ROCK.nose, { x: vx + Math.sin(a) * (PORTAL_R + 1.6), y: ISLAND_Y + 0.05, z: vz + Math.cos(a) * (PORTAL_R + 1.6) }, { y: a }, 0.4);
  }
  // Crust floating on the lava.
  for (let k = 0; k < 18; k++) {
    const a = hash(k, 2, 71) * Math.PI * 2;
    const d = ISLAND_R + 1 + hash(k, 3, 71) * (rim - ISLAND_R - 2);
    if (Math.abs(Math.sin(a) - 1) < 0.15) continue;
    b.add(G.rock, 0x2a201e, { x: vx + Math.sin(a) * d, y: LAVA_Y, z: vz + Math.cos(a) * d }, { y: a }, { x: 0.9, y: 0.25, z: 0.7 });
  }
  return torches;
}

/** What glows on the volcano: the lava lake, the streams down its sides, and its smoke. */
function volcanoFire(): { group: THREE.Group; smoke: THREE.Group; lava: THREE.MeshBasicMaterial } {
  const { x: vx, z: vz, rim } = VOLCANO;
  const group = new THREE.Group();
  const lava = new THREE.MeshBasicMaterial({ color: 0xff5a14 });
  const lake = new THREE.Mesh(new THREE.CylinderGeometry(rim - 0.5, rim - 0.5, 0.1, 36), lava);
  lake.position.set(vx, LAVA_Y, vz);
  group.add(lake);
  // Streams of lava down the flanks, all one mesh.
  const parts: THREE.BufferGeometry[] = [];
  const o = new THREE.Object3D();
  for (const deg of [25, 60, 130, 165, 215, 250, 300, 335]) {
    const a = (deg * Math.PI) / 180;
    const d0 = LANDING_OUT - 0.5;
    const d1 = d0 + 14 + hash(deg, 0, 72) * 12;
    const start = new THREE.Vector3(vx + Math.sin(a) * d0, slopeY(d0) + 0.08, vz + Math.cos(a) * d0);
    const end = new THREE.Vector3(vx + Math.sin(a) * d1, slopeY(d1) + 0.08, vz + Math.cos(a) * d1);
    o.position.copy(start).add(end).multiplyScalar(0.5);
    o.lookAt(end);
    o.updateMatrix();
    parts.push(new THREE.BoxGeometry(0.8 + hash(deg, 1, 72), 0.12, start.distanceTo(end)).applyMatrix4(o.matrix));
  }
  group.add(new THREE.Mesh(mergeGeometries(parts)!, lava));
  const smoke = new THREE.Group();
  const puff = new THREE.IcosahedronGeometry(1, 1);
  const grey = new THREE.MeshBasicMaterial({ color: 0x9a928e, transparent: true, opacity: 0.7, fog: false });
  for (let k = 0; k < 7; k++) {
    const m = new THREE.Mesh(puff, grey);
    m.position.set(vx + (hash(k, 0, 73) - 0.5) * 6, VOLCANO.h + 4 + k * 4, vz + (hash(k, 1, 73) - 0.5) * 6);
    m.scale.setScalar(3 + k * 0.8);
    smoke.add(m);
  }
  group.add(smoke);
  return { group, smoke, lava };
}

// ---------------------------------------------------------------------------
// Mount Olympus

/** The mountain, its marble stairs with gold edges, and statues of the gods along the way. Returns torch spots. */
function olympus(b: Batch): Array<{ x: number; y: number; z: number }> {
  const { x: ox, z: oz, r, h, top } = OLYMPUS;
  const mountain = flat(
    lathe(
      [
        [r + 3, -1],
        [r, 0],
        [top + (r - top) * 0.5, h * 0.5],
        [top + 0.5, h],
        [0, h],
      ],
      40,
    ),
  );
  b.add(mountain, 0x9a9890, { x: ox, y: 0, z: oz });
  // Snow on the upper slopes, in drifts.
  for (let k = 0; k < 26; k++) {
    const a = (k / 26) * Math.PI * 2;
    if (Math.abs(Math.cos(a) + 1) < 0.05) continue; // the stairs, on the north face
    const d = top + 2 + hash(k, 1, 90) * 10;
    b.add(G.rock, C.snow, { x: ox + Math.sin(a) * d, y: olympusSlope(d) + 0.2, z: oz + Math.cos(a) * d }, { y: a }, { x: 2.2, y: 0.7, z: 3 });
  }
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + 0.2;
    if (Math.abs(Math.cos(a) + 1) < 0.08) continue;
    const d = top + 14 + hash(k, 2, 90) * 18;
    b.add(G.rock, 0x8a8880, { x: ox + Math.sin(a) * d, y: olympusSlope(d) + 0.3, z: oz + Math.cos(a) * d }, { y: a }, { x: 1.8, y: 1.0, z: 2.6 });
  }
  // A ring of marble round the summit.
  b.add(G.cyl, C.marbleShade, { x: ox, y: h - 0.2, z: oz }, {}, { x: top + 0.3, y: 0.4, z: top + 0.3 });

  const torches: Array<{ x: number; y: number; z: number }> = [];
  let i = 0;
  for (let d = top; d < r; d += OLYMPUS_STEP, i++) {
    const topY = olympusStepY(d + OLYMPUS_STEP / 2);
    const z = oz - d - OLYMPUS_STEP / 2;
    b.add(G.box, i % 2 ? C.marble : C.marbleShade, { x: ox, y: topY - 0.75, z }, {}, { x: OLYMPUS_STAIR_HALF * 2, y: 1.5, z: OLYMPUS_STEP });
    b.add(G.box, C.gold, { x: ox, y: topY - 0.04, z: z - OLYMPUS_STEP / 2 + 0.06 }, {}, { x: OLYMPUS_STAIR_HALF * 2 + 0.02, y: 0.08, z: 0.12 });
    if (i % 6 === 3) {
      for (const side of [-1, 1]) {
        const tx = ox + side * (OLYMPUS_STAIR_HALF + 0.4);
        const ty = olympusSlope(d + OLYMPUS_STEP / 2);
        b.add(G.fluted, C.marble, { x: tx, y: ty + 1.0, z }, {}, { x: 0.16, y: 2.0, z: 0.16 });
        b.add(G.dome, C.gold, { x: tx, y: ty + 2.1, z }, { x: Math.PI }, { x: 0.3, y: 0.18, z: 0.3 });
        torches.push({ x: tx, y: ty + 2.1, z });
      }
    }
  }
  // A marble arch at the foot, gold on top, so the way up can be seen from town.
  const fz = oz - r - 1;
  for (const side of [-1, 1]) column(b, ox + side * 3.2, fz, 6, 0.5);
  b.add(G.box, C.marble, { x: ox, y: 6.3, z: fz }, {}, { x: 8, y: 0.6, z: 1.4 });
  b.add(prism(8.2, 1.4, 1.5), C.gold, { x: ox, y: 6.6, z: fz });
  b.add(boltGeometry(), C.gold, { x: ox, y: 6.75, z: fz - 0.8 }, { z: 0.15 }, 1.3);
  // A path out to Zeus's gate from the city.
  const gateZ = ZEUS_RING.z - ZEUS_RING.r - ZEUS_RING.thick;
  b.add(G.box, C.dirt, { x: ox, y: 0.02, z: (BOUNDS.z1 - 2 + gateZ) / 2 }, {}, { x: 4.5, y: 0.03, z: gateZ - BOUNDS.z1 + 2 });
  return torches;
}

export interface BackWall {
  group: THREE.Group;
  blocks: THREE.InstancedMesh;
  /** Each block's place, in the colosseum's own frame. */
  homes: THREE.Vector3[];
}

/** Stone blocks filling the gap in a colosseum's back wall, in its own frame so they can be knocked outward. */
function backWall(L: ArenaLook): BackWall {
  const homes: THREE.Vector3[] = [];
  const size = 1.2;
  const half = GATE_HALF + 1.4;
  for (let y = size / 2; y < WALL_H; y += size) {
    for (let x = -half + size / 2; x < half; x += size) homes.push(new THREE.Vector3(x, y, -(L.r + L.thick / 2)));
  }
  const blocks = new THREE.InstancedMesh(G.box, toon(0xffffff), homes.length);
  const c = new THREE.Color();
  const m = new THREE.Matrix4();
  homes.forEach((p, i) => {
    m.compose(p, new THREE.Quaternion(), new THREE.Vector3(size, size, L.thick + 0.4));
    blocks.setMatrixAt(i, m);
    blocks.setColorAt(i, c.setHex(i % 3 === 0 ? L.stone : L.light));
  });
  blocks.castShadow = blocks.receiveShadow = true;
  blocks.frustumCulled = false;
  const group = new THREE.Group();
  group.position.set(L.x, L.y ?? 0, L.z);
  group.rotation.y = L.yaw;
  group.add(blocks);
  return { group, blocks, homes };
}

/** Olympia, on the summit: a marble square, a great monument with a shut door, and the angels' houses round it. */
function olympia(b: Batch): void {
  const { x: ox, z: oz, h, top } = OLYMPUS;
  b.setFrame(0, 0, 0, h);
  b.add(G.cyl, C.plaza, { x: ox, y: 0.03, z: oz }, {}, { x: top - 0.6, y: 0.06, z: top - 0.6 });
  for (const ring of [9, 15]) b.add(new THREE.TorusGeometry(1, 0.08, 3, 64), C.gold, { x: ox, y: 0.07, z: oz }, { x: Math.PI / 2 }, { x: ring, y: ring, z: 1 });

  // The monument: three marble steps, a hall ringed by columns, a gold roof, and a great door that will not open.
  const { x: mx, z: mz, w, d } = MONUMENT;
  for (let k = 0; k < 3; k++) b.add(G.box, k % 2 ? C.marbleShade : C.marble, { x: mx, y: 0.3 + k * 0.6, z: mz }, {}, { x: w + 4 - k * 1.4, y: 0.6, z: d + 4 - k * 1.4 });
  const floor = 1.8;
  b.add(G.box, C.marble, { x: mx, y: floor + 4.5, z: mz }, {}, { x: w - 3, y: 9, z: d - 3 });
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    for (const side of [-1, 1]) {
      column(b, mx + side * (w / 2 - 0.4), mz - d / 2 + 0.4 + t * (d - 0.8), 9, 0.42);
      // Leave the middle of the front row open, in front of the door.
      if (i > 0 && i < 4 && !(side < 0 && i === 2)) column(b, mx - w / 2 + 0.4 + t * (w - 0.8), mz + side * (d / 2 - 0.4), 9, 0.42);
    }
  }
  b.setFrame(0, 0, 0, h + floor);
  b.add(G.box, C.marble, { x: mx, y: 9.3, z: mz }, {}, { x: w + 0.6, y: 0.8, z: d + 0.6 });
  b.add(prism(w + 1, 3.2, d + 0.8), C.gold, { x: mx, y: 9.7, z: mz }, { y: Math.PI / 2 });
  b.add(boltGeometry(), C.gold, { x: mx, y: 10.2, z: mz - d / 2 - 0.5 }, { z: 0.15 }, 2.2);
  // The door: two tall leaves in a gold frame, studded, closed. No lock — it is shut by something else.
  const dz = mz - d / 2 + 1.45;
  b.add(G.box, C.gold, { x: mx, y: 3.4, z: dz }, {}, { x: 4.4, y: 6.8, z: 0.2 });
  for (const side of [-1, 1]) {
    b.add(G.box, 0x8a5a22, { x: mx + side * 0.95, y: 3.1, z: dz - 0.08 }, {}, { x: 1.8, y: 6.0, z: 0.14 });
    for (let k = 0; k < 4; k++) b.add(G.blob, C.gold, { x: mx + side * 0.95, y: 1.0 + k * 1.4, z: dz - 0.18 }, {}, 0.11);
  }
  b.add(G.halfDisc, C.gold, { x: mx, y: 6.8, z: dz - 0.05 }, { x: Math.PI / 2 }, { x: 2.2, y: 0.2, z: 2.2 });
  b.setFrame(0, 0, 0, h);

  for (const hs of olympiaHouses()) house(b, hs.x, hs.z, hs.w, hs.d, hs.yaw, hs.dome);
  // Cypresses and olives between the houses.
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.26;
    if (Math.cos(a) < -0.9) continue;
    const r = 13 + (k % 2) * 13;
    if (r > top - 2) continue;
    const tx = ox + Math.sin(a) * r;
    const tz = oz + Math.cos(a) * r;
    if (k % 3 === 0) olive(b, tx, tz, 0.8, a);
    else cypress(b, tx, tz, 0.8);
  }
  b.setFrame();
}

/** A belt of cloud round Olympus's middle, white and unlit like the sky's. */
function olympusClouds(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const puff = new THREE.IcosahedronGeometry(1, 1);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    if (Math.abs(Math.cos(a) + 1) < 0.1) continue; // clear of the stairs
    const d = OLYMPUS.top + 18 + hash(k, 3, 91) * 6;
    const m = new THREE.Mesh(puff, mat);
    m.position.set(OLYMPUS.x + Math.sin(a) * d, olympusSlope(d) + 3 + hash(k, 4, 91) * 4, OLYMPUS.z + Math.cos(a) * d);
    m.scale.set(6 + hash(k, 5, 91) * 4, 2.5, 4 + hash(k, 6, 91) * 3);
    m.rotation.y = a;
    g.add(m);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Portals and Tartarus

export interface HellStairs {
  /** The step blocks and their glowing green edges, one instance per step. */
  steps: THREE.InstancedMesh;
  edges: THREE.InstancedMesh;
  /** Each step's middle along x, and its top. */
  xs: number[];
  tops: number[];
}

/** Place step `i` of the last staircase: `drop` metres below where it belongs, tipped by `tip`. */
export function placeStep(stairs: HellStairs, i: number, drop = 0, tip = 0): void {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tip * 0.7, 0, tip));
  const x = stairs.xs[i]!;
  const top = stairs.tops[i]! - drop;
  m.compose(new THREE.Vector3(x, top - 1, TARTARUS.z), q, new THREE.Vector3(STAIRS.run, 2, STAIRS.half * 2));
  stairs.steps.setMatrixAt(i, m);
  m.compose(new THREE.Vector3(x + STAIRS.run / 2 - 0.05, top - 0.03, TARTARUS.z), q, new THREE.Vector3(0.06, 0.06, STAIRS.half * 2 + 0.02));
  stairs.edges.setMatrixAt(i, m);
  stairs.steps.instanceMatrix.needsUpdate = true;
  stairs.edges.instanceMatrix.needsUpdate = true;
}

function hellStairs(): HellStairs {
  const xs: number[] = [];
  const tops: number[] = [];
  for (let sx = STAIRS.x0; sx < STAIRS.x1; sx += STAIRS.run) {
    xs.push(sx + STAIRS.run / 2);
    tops.push(stairStepY(sx + STAIRS.run / 2));
  }
  const steps = new THREE.InstancedMesh(G.box, toon(0xffffff), xs.length);
  const edges = new THREE.InstancedMesh(G.box, new THREE.MeshBasicMaterial({ color: 0x5fe08a }), xs.length);
  const c = new THREE.Color();
  xs.forEach((_, i) => steps.setColorAt(i, c.setHex(i % 2 ? 0x4a3e48 : 0x3e343c)));
  steps.castShadow = steps.receiveShadow = true;
  // They move, so the bounds three.js works out at the start are no good for culling.
  steps.frustumCulled = edges.frustumCulled = false;
  const stairs = { steps, edges, xs, tops };
  xs.forEach((_, i) => placeStep(stairs, i));
  return stairs;
}

/** A ring of black stone standing on its edge, with a swirl of purple light inside. The swirl is `children[1]`. */
function portal(x: number, y: number, z: number, yaw: number): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.28, 10, 32), toon(0x2a2030, { emissive: 0x200a30 }));
  ring.castShadow = true;
  g.add(ring);
  const swirl = new THREE.Group();
  const glow = new THREE.MeshBasicMaterial({ color: 0x9a4aff, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  swirl.add(new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), glow));
  const arm = new THREE.MeshBasicMaterial({ color: 0xe0c8ff, side: THREE.DoubleSide });
  for (let k = 0; k < 4; k++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3 + k * 0.25, 0.4 + k * 0.25, 24, 1, k * 1.7, 2.2), arm);
    m.position.z = 0.01;
    swirl.add(m);
  }
  g.add(swirl);
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.8), toon(0x2a2030));
    foot.position.set(side * 1.3, -1.45, 0);
    g.add(foot);
  }
  g.position.set(x, y + 1.7, z);
  g.rotation.y = yaw;
  return g;
}

/** Tartarus's rock: the island you land on, the staircase up, the crag under the colosseum, and Hades's throne. Returns where the green fires burn. */
function tartarusFloor(b: Batch): Array<{ x: number; y: number; z: number }> {
  const { x, y, z, r } = TARTARUS;
  const fires: Array<{ x: number; y: number; z: number }> = [];
  // The crag the colosseum stands on, tapering down into the dark.
  const outer = r + HADES_RING.thick + 1;
  b.add(G.cyl, 0x2a2228, { x, y: y - 0.6, z }, {}, { x: outer, y: 1.2, z: outer });
  b.add(G.cone, 0x1e181c, { x, y: y - 14, z }, { x: Math.PI }, { x: outer, y: 26, z: outer });

  // The islands: slabs of black rock with ragged rims and the same taper beneath.
  ISLANDS.forEach((isl, n) => {
    b.add(G.cyl, 0x2e2428, { x: isl.x, y: LOW_Y - 0.6, z: isl.z }, { y: 0.2 + n }, { x: isl.r + 0.4, y: 1.2, z: isl.r + 0.4 });
    // The taper hangs from just under the slab, however deep it goes.
    const under = 14 + isl.r;
    b.add(G.cone, 0x1e181c, { x: isl.x, y: LOW_Y - 1 - under / 2, z: isl.z }, { x: Math.PI, y: n }, { x: isl.r + 0.4, y: under, z: isl.r + 0.4 });
    const stones = Math.round(isl.r * 1.1);
    for (let k = 0; k < stones; k++) {
      const a = (k / stones) * Math.PI * 2;
      const rx = isl.x + Math.sin(a) * isl.r;
      const rz = isl.z + Math.cos(a) * isl.r;
      // Leave a gap wherever a bridge or the stairs come in.
      const gaps = [...BRIDGES.flatMap(([p, q]) => (p === n ? [ISLANDS[q]!] : q === n ? [ISLANDS[p]!] : [])), ...(n === 0 ? [{ x: STAIRS.x1, z: TARTARUS.z }] : [])];
      if (gaps.some((g) => Math.abs(Math.atan2(g.x - isl.x, g.z - isl.z) - a + Math.PI * 4) % (Math.PI * 2) < 0.35 || Math.abs(Math.atan2(g.x - isl.x, g.z - isl.z) - a + Math.PI * 4) % (Math.PI * 2) > Math.PI * 2 - 0.35)) continue;
      b.add(G.rock, 0x3a3038, { x: rx, y: LOW_Y + 0.2, z: rz }, { y: a }, 0.8 + hash(k, n, 83) * 0.6);
    }
  });
  // Bridges of rock slabs, sagging a little, with nothing either side.
  for (const [p, q] of BRIDGES) {
    const a = ISLANDS[p]!;
    const c = ISLANDS[q]!;
    const len = Math.hypot(c.x - a.x, c.z - a.z);
    const yaw = Math.atan2(c.x - a.x, c.z - a.z);
    const slabs = Math.round(len / 1.4);
    for (let k = 0; k <= slabs; k++) {
      const t = k / slabs;
      b.add(G.box, k % 2 ? 0x3e343c : 0x4a3e48, { x: a.x + (c.x - a.x) * t, y: LOW_Y - 0.35, z: a.z + (c.z - a.z) * t }, { y: yaw + (hash(k, p, 84) - 0.5) * 0.08 }, { x: HELL_BRIDGE * 2, y: 0.7, z: 1.3 });
    }
  }
  // Broken columns and green fires on the island.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.6;
    const isl = ISLANDS[k % ISLANDS.length]!;
    const cx = isl.x + Math.sin(a) * (isl.r - 3);
    const cz = isl.z + Math.cos(a) * (isl.r - 3);
    const h = 2 + hash(k, 2, 83) * 4;
    b.add(G.fluted, 0x3a3038, { x: cx, y: LOW_Y + h / 2, z: cz }, { z: (hash(k, 3, 83) - 0.5) * 0.15 }, { x: 0.5, y: h, z: 0.5 });
    if (k % 2 === 0) {
      b.add(G.dome, C.iron, { x: cx, y: LOW_Y + h + 0.2, z: cz }, { x: Math.PI }, { x: 0.5, y: 0.3, z: 0.5 });
      fires.push({ x: cx, y: LOW_Y + h + 0.2, z: cz });
    }
  }

  // Pillars under the staircase; the steps themselves are `hellStairs`, so they can break.
  const run = STAIRS.run;
  let i = 0;
  for (let sx = STAIRS.x0; sx < STAIRS.x1; sx += run, i++) {
    const top = stairStepY(sx + run / 2);
    if (i % 6 === 3) {
      for (const side of [-1, 1]) b.add(G.cone, 0x2a2228, { x: sx + run / 2, y: top - 4, z: z + side * (STAIRS.half - 0.4) }, { x: Math.PI }, { x: 0.5, y: 4, z: 0.5 });
    }
  }

  // His throne, at the far side of the sand from the gate.
  const tx = x - r + 3;
  b.add(G.box, 0x1a1420, { x: tx, y: y + 0.6, z }, {}, { x: 2.4, y: 1.2, z: 3 });
  b.add(G.box, 0x1a1420, { x: tx - 1.0, y: y + 2.8, z }, {}, { x: 0.5, y: 4.4, z: 3 });
  for (const side of [-1, 1]) {
    b.add(G.box, 0x3a1a4a, { x: tx, y: y + 1.6, z: z + side * 1.4 }, {}, { x: 2.2, y: 0.3, z: 0.3 });
    b.add(G.blob, 0xe9e1c9, { x: tx - 1.0, y: y + 5.2, z: z + side * 1.2 }, {}, { x: 0.32, y: 0.3, z: 0.34 });
  }
  return fires;
}

/** The fire far below the floor of Tartarus, and rocks hanging in the dark. */
function tartarus(): THREE.Group {
  const g = new THREE.Group();
  const sea = new THREE.Mesh(new THREE.CircleGeometry(160, 48), new THREE.MeshBasicMaterial({ color: 0x8a1e08, fog: false }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(ISLAND.x, LOW_Y - 30, TARTARUS.z);
  g.add(sea);
  const rock = toon(0x241c20);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const d = TARTARUS.r + 30 + hash(k, 2, 81) * 40;
    const rx = ISLAND.x + Math.sin(a) * d;
    const rz = TARTARUS.z + Math.cos(a) * d;
    // Hanging rock, but never in the way of the path.
    if (ISLANDS.some((i) => Math.hypot(rx - i.x, rz - i.z) < i.r + 12) || Math.hypot(rx - TARTARUS.x, rz - TARTARUS.z) < TARTARUS.r + 12) continue;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), rock);
    m.position.set(rx, TARTARUS.y - 8 + hash(k, 3, 81) * 20, rz);
    m.scale.set(2 + hash(k, 4, 81) * 4, 2 + hash(k, 5, 81) * 3, 2 + hash(k, 6, 81) * 4);
    m.rotation.set(k, k * 2, 0);
    g.add(m);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Sky, ground and grass

function sky(): THREE.Mesh {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(SKY_TOP) }, horizon: { value: new THREE.Color(HORIZON) } },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
      void main() { float h = clamp(vDir.y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0); }`,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 12), m);
  s.renderOrder = -1;
  s.frustumCulled = false;
  s.name = "sky";
  return s;
}

/** The meadow, mottled by a value hash so it is never one flat green. */
function ground(): THREE.Mesh {
  const size = 700;
  const seg = 175;
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -75);
  const pos = g.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Color(C.grassDark);
  const b = new THREE.Color(C.grass);
  const c = new THREE.Color(C.grassLight);
  const tmp = new THREE.Color();
  const sand = new THREE.Color(0xe6d29a);
  const sandWet = new THREE.Color(0xb8a77a);
  const ash = new THREE.Color(0x6a5c54);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = smoothNoise(x / 18, z / 18) * 0.7 + smoothNoise(x / 5, z / 5) * 0.3;
    tmp.copy(n < 0.5 ? a : b).lerp(n < 0.5 ? b : c, n < 0.5 ? n * 2 : (n - 0.5) * 2);
    // Sand down to the sea, and a beaten-earth square round Poseidon's colosseum.
    const beach = Math.min(1, Math.max(0, (x - (SHORE_X - 14)) / 6));
    if (beach > 0) tmp.lerp(x > SHORE_X + 1 ? sandWet : sand, beach);
    else if (inVillage(x, z, 21)) tmp.lerp(sand, 0.55);
    const fromVolcano = dist(x, z, VOLCANO.x, VOLCANO.z);
    if (fromVolcano < VOLCANO.r + 14) tmp.lerp(ash, Math.min(1, (VOLCANO.r + 14 - fromVolcano) / 14));
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    // Rolling hills past the edge of the world, flat where anyone walks, easing down to the shore and under the sea.
    const out = Math.min(outside(x, z), 60);
    const coast = Math.min(1, Math.max(0, (SHORE_X - 4 - x) / 24));
    const fromOlympus = dist(x, z, OLYMPUS.x, OLYMPUS.z);
    const clear = Math.min(1, Math.max(0, (fromVolcano - VOLCANO.r - 4) / 20)) * Math.min(1, Math.max(0, (fromOlympus - OLYMPUS.r - 4) / 20));
    const y = out * 0.25 * smoothNoise(x / 30, z / 30) * coast * clear;
    pos.setY(i, x > SHORE_X - 2 ? -Math.min(3, (x - SHORE_X + 2) * 0.3) : y);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mat = toon(0xffffff, { rim: 0 });
  mat.vertexColors = true;
  return new THREE.Mesh(g, mat);
}

function smoothNoise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const v = (i: number, j: number): number => hash(x0 + i, z0 + j, 9);
  return v(0, 0) * (1 - sx) * (1 - sz) + v(1, 0) * sx * (1 - sz) + v(0, 1) * (1 - sx) * sz + v(1, 1) * sx * sz;
}

/** Tufts of grass that lean in the wind, all one draw. */
function grassField(): { mesh: THREE.InstancedMesh; material: THREE.ShaderMaterial } {
  // Three crossed blades.
  const blade = (angle: number): number[] => {
    const c = Math.cos(angle) * 0.14;
    const s = Math.sin(angle) * 0.14;
    return [-c, 0, -s, c, 0, s, 0, 0.55, 0];
  };
  const verts = [...blade(0), ...blade(Math.PI / 3), ...blade((2 * Math.PI) / 3)];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));

  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 },
      base: { value: new THREE.Color(C.grassDark) },
      tip: { value: new THREE.Color(0xc6e87a) },
      fogColor: { value: new THREE.Color(HORIZON) },
      fogNear: { value: 40 },
      fogFar: { value: 200 },
    },
    vertexShader: `
      uniform float time;
      varying float vH;
      varying float vDepth;
      void main() {
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float h = position.y / 0.55;
        world.x += sin(time * 1.8 + world.x * 0.25 + world.z * 0.18) * 0.16 * h;
        world.z += cos(time * 1.3 + world.x * 0.2) * 0.06 * h;
        vec4 view = viewMatrix * world;
        vH = h;
        vDepth = -view.z;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform vec3 base; uniform vec3 tip; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      varying float vH; varying float vDepth;
      void main() {
        vec3 c = mix(base, tip, vH);
        gl_FragColor = vec4(mix(c, fogColor, smoothstep(fogNear, fogFar, vDepth)), 1.0);
        #include <colorspace_fragment>
      }`,
  });

  const spots: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let z = BOUNDS.z0; z < BOUNDS.z1; z += 1.6) {
    for (let x = BOUNDS.x0; x < SHORE_X; x += 1.6) {
      const ix = Math.round(x * 10);
      const iz = Math.round(z * 10);
      if (hash(ix, iz, 5) > 0.55) continue;
      const px = x + (hash(ix, iz, 6) - 0.5) * 1.5;
      const pz = z + (hash(ix, iz, 7) - 0.5) * 1.5;
      if (dist(px, pz, CITY.x, CITY.z) < PLAZA_R + 1) continue;
      if (nearRoad(px, pz, 0.4)) continue;
      if (nearColosseum(px, pz, 0.5)) continue;
      if (!inRegions(px, pz) || inVillage(px, pz, 21) || px > SHORE_X - 13) continue;
      const s = 0.7 + hash(ix, iz, 8) * 0.8;
      q.setFromAxisAngle(up, hash(ix, iz, 10) * Math.PI);
      m.compose(new THREE.Vector3(px, 0, pz), q, new THREE.Vector3(s, s, s));
      spots.push(m.clone());
    }
  }
  const mesh = new THREE.InstancedMesh(g, material, spots.length);
  spots.forEach((s, i) => mesh.setMatrixAt(i, s));
  mesh.frustumCulled = false;
  return { mesh, material };
}

/** Far peaks in their own haze: fogged like the rest they would vanish into the sky. */
function mountains(): THREE.Group {
  const b = new Batch();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + hash(i, 0, 20) * 0.2;
    const r = 250 + hash(i, 1, 20) * 60;
    const x = Math.sin(a) * r;
    const z = -75 + Math.cos(a) * r;
    if (x > SHORE_X - 40) continue;
    const h = 45 + hash(i, 2, 20) * 50;
    const w = 60 + hash(i, 3, 20) * 50;
    b.add(G.cone, C.mountain, { x, y: h / 2 - 5, z }, { y: a }, { x: w, y: h, z: w });
    b.add(G.cone, C.snow, { x, y: h - 5 - h * 0.12, z }, { y: a }, { x: w * 0.26, y: h * 0.25, z: w * 0.26 });
  }
  return b.build({ fog: false, shadows: false });
}


const flameGeo = new THREE.ConeGeometry(1, 1, 7);
function flame(root: THREE.Group, x: number, y: number, z: number, size: number, color = 0xff8a1e, core = 0xffe066): THREE.Mesh {
  const outer = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
  outer.position.set(x, y + size * 0.6, z);
  outer.scale.set(size * 0.55, size * 1.3, size * 0.55);
  const inner = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: core }));
  inner.scale.set(0.5, 0.6, 0.5);
  inner.position.y = -0.15;
  outer.add(inner);
  outer.userData.size = size;
  root.add(outer);
  return outer;
}

function portcullis(L: ArenaLook): THREE.Group {
  const g = new THREE.Group();
  const iron = new THREE.MeshToonMaterial({ color: C.iron });
  const z = L.r + L.thick / 2;
  for (let x = -GATE_HALF + 0.3; x <= GATE_HALF - 0.2; x += 0.75) {
    const bar = new THREE.Mesh(G.box, iron);
    bar.scale.set(0.14, 5.6, 0.14);
    bar.position.set(x, 2.8, z);
    g.add(bar);
  }
  for (const y of [1.2, 3.0, 4.8]) {
    const bar = new THREE.Mesh(G.box, iron);
    bar.scale.set(GATE_HALF * 2, 0.14, 0.14);
    bar.position.set(0, y, z);
    g.add(bar);
  }
  // Stood in the gate's frame inside a group of its own, so `position.y` still raises and lowers it.
  const frame = new THREE.Group();
  frame.position.set(L.x, L.y ?? 0, L.z);
  frame.rotation.y = L.yaw;
  frame.add(g);
  const lift = new THREE.Group();
  lift.add(frame);
  lift.position.y = 6; // raised
  return lift;
}

function cloudLayer(): THREE.Group {
  const g = new THREE.Group();
  // Unlit and unfogged: a cloud is a shape against the sky, not a solid in the sun.
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 });
  const puff = new THREE.IcosahedronGeometry(1, 2);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 16; i++) {
    const puffs = 3 + Math.floor(hash(i, 0, 30) * 3);
    const parts: THREE.BufferGeometry[] = [];
    for (let p = 0; p < puffs; p++) {
      const s = 6 + hash(i, p, 31) * 6;
      m.compose(
        new THREE.Vector3(p * 7 - puffs * 3.5, hash(i, p, 32) * 3, hash(i, p, 33) * 6),
        new THREE.Quaternion(),
        new THREE.Vector3(s * 1.3, s * 0.7, s),
      );
      parts.push(puff.clone().applyMatrix4(m));
    }
    const cloud = new THREE.Mesh(mergeGeometries(parts)!, mat);
    cloud.position.set((hash(i, 1, 34) - 0.5) * 500, 110 + hash(i, 2, 34) * 40, -75 + (hash(i, 3, 34) - 0.5) * 500);
    g.add(cloud);
  }
  return g;
}
