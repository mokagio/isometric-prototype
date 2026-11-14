import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Batch } from "./batch";
import { dist } from "./bearing";
import { ARES_BUILD, buildFigure, HERO_BUILD, poseFigure, wearKit, type Build } from "./figure";
import { godKit } from "./armor";
import { toon } from "./toon";
import {
  ARENA_R,
  BLACKSMITH,
  BOUNDS,
  CAMPS,
  CITY,
  CITY_GATE_Z,
  COLOSSEUM,
  GATE_HALF,
  hash,
  houses,
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
  colosseum(batch);
  root.add(batch.build());
  root.add(mountains());

  // The hero of the city, in marble, sword raised over the fountain.
  root.add(statue(HERO_BUILD, 0xeee9dd, { x: 0, y: 1.55, z: 0 }, Math.PI, 0.95));
  // Ares in bronze, outside his own gate.
  root.add(statue(ARES_BUILD, 0x9c6a3a, { x: COLOSSEUM.x + GATE_HALF + 7, y: 1.6, z: COLOSSEUM.z + ARENA_R + WALL_THICK + 4 }, 0.4, 1.6));

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

  const gate = portcullis();
  root.add(gate);
  const clouds = cloudLayer();
  root.add(clouds);
  return { root, gate, flames, clouds, grass: grass.material, water };
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
    for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 2.3) {
      const ix = Math.round(x * 7);
      const iz = Math.round(z * 7);
      // Patches rather than an even sprinkle.
      if (hash(Math.floor(x / 14), Math.floor(z / 14), 40) > 0.45 || hash(ix, iz, 41) > 0.5) continue;
      const px = x + (hash(ix, iz, 42) - 0.5) * 2;
      const pz = z + (hash(ix, iz, 43) - 0.5) * 2;
      if (dist(px, pz, CITY.x, CITY.z) < CITY.r || nearRoad(px, pz, 0.5) || nearColosseum(px, pz, 1)) continue;
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
// The colosseum: an arcade of two storeys outside, tiers of seats inside, a
// podium wall round the sand, and Ares's red hung everywhere.

const SEGMENTS = 44;
const WALL_H = 10.5;
const PODIUM = 2.6;
const TIERS = 5;

function colosseum(b: Batch): void {
  const { x: cx, z: cz } = COLOSSEUM;
  const outer = ARENA_R + WALL_THICK;
  const span = ((2 * Math.PI * outer) / SEGMENTS) * 1.005;
  const facade = arcade(span, WALL_H, [
    { x: 0, w: span * 0.56, bottom: 0, top: 4.4 },
    { x: 0, w: span * 0.5, bottom: 5.4, top: 9.0 },
  ], 0.5);
  const innerSpan = ((2 * Math.PI * ARENA_R) / SEGMENTS) * 1.01;

  b.add(G.cyl, C.arena, { x: cx, y: 0.03, z: cz }, {}, { x: ARENA_R + 0.5, y: 0.06, z: ARENA_R + 0.5 });
  // Rake marks in the sand.
  for (let r = 4; r < ARENA_R - 1; r += 3.2) {
    b.add(new THREE.TorusGeometry(1, 0.012, 3, 64), 0xcfae78, { x: cx, y: 0.065, z: cz }, { x: Math.PI / 2 }, { x: r, y: r, z: 1 });
  }

  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const sx = Math.sin(a);
    const sz = Math.cos(a);
    // The gate faces +z, down the road.
    if (Math.abs(sx * (ARENA_R + WALL_THICK / 2)) < GATE_HALF + span / 2 && sz > 0) continue;
    const at = (r: number, y: number): { x: number; y: number; z: number } => ({ x: cx + sx * r, y, z: cz + sz * r });
    const shade = i % 2 ? C.sandstone : C.sandstoneLight;

    // Outside: the arcade, with half-columns between the arches and a cornice per storey.
    b.add(facade, shade, at(outer - 0.25, 0), { y: a });
    b.add(G.box, C.arch, at(outer - 0.9, WALL_H / 2), { y: a }, { x: span, y: WALL_H, z: 0.3 });
    b.add(G.cyl, C.sandstoneDark, at(outer + 0.05, 4.9), { y: a }, { x: span * 1.0, y: 0.3, z: 0.25 });
    b.add(G.box, C.sandstoneDark, at(outer + 0.02, 4.85), { y: a }, { x: span, y: 0.35, z: 0.4 });
    b.add(G.box, C.sandstoneDark, at(outer + 0.02, WALL_H), { y: a }, { x: span, y: 0.4, z: 0.5 });
    const edge = a + Math.PI / SEGMENTS;
    const ex = cx + Math.sin(edge) * (outer + 0.1);
    const ez = cz + Math.cos(edge) * (outer + 0.1);
    b.add(G.fluted, C.sandstoneLight, { x: ex, y: 2.2, z: ez }, {}, { x: 0.28, y: 4.4, z: 0.28 });
    b.add(G.fluted, C.sandstoneLight, { x: ex, y: 7.2, z: ez }, {}, { x: 0.25, y: 3.6, z: 0.25 });
    // Every other bay carries a mast for an awning, with a pennant.
    if (i % 2 === 0) {
      b.add(G.cyl8, C.wood, at(outer - 0.2, WALL_H + 1.6), {}, { x: 0.07, y: 3.2, z: 0.07 });
      b.add(G.box, C.banner, at(outer - 0.2, WALL_H + 2.6), { y: a + Math.PI / 2 }, { x: 0.9, y: 0.5, z: 0.03 });
    }

    // Inside: a podium wall round the sand, and tiers rising back to the arcade.
    b.add(G.box, C.sandstoneLight, at(ARENA_R + 0.3, PODIUM / 2), { y: a }, { x: innerSpan, y: PODIUM, z: 0.6 });
    b.add(G.box, C.marble, at(ARENA_R + 0.25, PODIUM + 0.1), { y: a }, { x: innerSpan, y: 0.2, z: 0.75 });
    const depth = (WALL_THICK - 1.0) / TIERS;
    for (let t = 0; t < TIERS; t++) {
      const r0 = ARENA_R + 0.6 + t * depth;
      const y = PODIUM + (t + 1) * ((WALL_H - PODIUM - 0.6) / TIERS);
      const midR = (r0 + outer - 0.9) / 2;
      const arc = ((2 * Math.PI * midR) / SEGMENTS) * 1.02;
      b.add(G.box, t % 2 ? C.marbleShade : C.marble, at(midR, y / 2), { y: a }, { x: arc, y, z: outer - 0.9 - r0 });
    }
    // Ares's colours: a red hanging with a gold boss on every fourth bay of the podium.
    if (i % 4 === 2) {
      b.add(G.box, C.banner, at(ARENA_R - 0.02, PODIUM / 2 + 0.2), { y: a }, { x: innerSpan * 0.55, y: PODIUM - 0.2, z: 0.05 });
      b.add(G.cyl, C.gold, at(ARENA_R - 0.06, PODIUM / 2 + 0.4), { y: a, x: Math.PI / 2 }, { x: 0.32, y: 0.04, z: 0.32 });
      b.add(G.box, C.gold, at(ARENA_R - 0.05, 0.38), { y: a }, { x: innerSpan * 0.55, y: 0.1, z: 0.06 });
    }
  }

  // The gate: an arch flanked by towers, Ares's banners either side.
  const gz = cz + ARENA_R + WALL_THICK / 2;
  const gateWall = arcade(GATE_HALF * 2 + 3.2, WALL_H + 1.5, [{ x: 0, w: GATE_HALF * 2, bottom: 0, top: 6 + GATE_HALF }], WALL_THICK + 0.6);
  b.add(gateWall, C.sandstoneLight, { x: cx, y: 0, z: gz });
  b.add(G.box, C.gold, { x: cx, y: 6.1 + GATE_HALF, z: gz + WALL_THICK / 2 + 0.32 }, {}, { x: 0.7, y: 0.9, z: 0.1 });
  for (const side of [-1, 1]) {
    const tx = cx + side * (GATE_HALF + 2.4);
    b.add(G.box, C.sandstoneDark, { x: tx, y: (WALL_H + 3) / 2, z: gz }, {}, { x: 2.4, y: WALL_H + 3, z: WALL_THICK + 1.6 });
    b.add(G.box, C.sandstone, { x: tx, y: WALL_H + 3.2, z: gz }, {}, { x: 2.8, y: 0.4, z: WALL_THICK + 2 });
    for (let m = -1; m <= 1; m++) b.add(G.box, C.sandstoneDark, { x: tx + m * 0.9, y: WALL_H + 3.75, z: gz + WALL_THICK / 2 + 0.6 }, {}, { x: 0.5, y: 0.7, z: 0.5 });
    b.add(G.box, C.banner, { x: tx, y: 6.8, z: gz + WALL_THICK / 2 + 0.85 }, {}, { x: 1.7, y: 6.4, z: 0.06 });
    b.add(G.box, C.gold, { x: tx, y: 9.8, z: gz + WALL_THICK / 2 + 0.88 }, {}, { x: 1.7, y: 0.18, z: 0.08 });
    // A gold spear-and-shield device on each banner.
    b.add(G.cyl, C.gold, { x: tx, y: 7.6, z: gz + WALL_THICK / 2 + 0.9 }, { x: Math.PI / 2 }, { x: 0.5, y: 0.05, z: 0.5 });
    b.add(G.box, C.banner, { x: tx, y: 7.6, z: gz + WALL_THICK / 2 + 0.94 }, { z: Math.PI / 4 }, { x: 0.1, y: 1.3, z: 0.04 });
    b.add(prism(1.7, 0.6, 0.06), C.banner, { x: tx, y: 3.6, z: gz + WALL_THICK / 2 + 0.85 }, { z: Math.PI });
  }

  // Braziers round the floor: tripod legs and a bowl.
  for (const f of colosseumFlameSpots()) {
    for (let l = 0; l < 3; l++) {
      const a = (l / 3) * Math.PI * 2;
      b.add(G.cyl8, C.iron, { x: f.x + Math.sin(a) * 0.25, y: 0.8, z: f.z + Math.cos(a) * 0.25 }, { x: Math.cos(a) * 0.2, z: -Math.sin(a) * 0.2 }, { x: 0.05, y: 1.7, z: 0.05 });
    }
    b.add(G.dome, C.iron, { x: f.x, y: 1.95, z: f.z }, { x: Math.PI }, { x: 0.6, y: 0.35, z: 0.6 });
    b.add(G.cyl, 0xb88a2e, { x: f.x, y: 1.95, z: f.z }, {}, { x: 0.62, y: 0.06, z: 0.62 });
  }
  // Spears stuck in the sand, and a fallen shield or two.
  for (let i = 0; i < 10; i++) {
    const a = hash(i, 3, 21) * Math.PI * 2;
    const r = 6 + hash(i, 4, 21) * 10;
    const x = cx + Math.sin(a) * r;
    const z = cz + Math.cos(a) * r;
    b.add(G.cyl8, C.wood, { x, y: 0.9, z }, { x: 0.25, z: 0.2 }, { x: 0.035, y: 2, z: 0.035 });
    b.add(G.cone, C.iron, { x: x + 0.05, y: 1.95, z: z + 0.22 }, { x: 0.25, z: 0.2 }, { x: 0.07, y: 0.32, z: 0.07 });
    if (i % 3 === 0) b.add(G.cyl, 0xc8913a, { x: x + 1.2, y: 0.08, z: z - 0.6 }, { x: 0.12, z: 0.1 }, { x: 0.4, y: 0.06, z: 0.4 });
  }
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
  const seg = 140;
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -75);
  const pos = g.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Color(C.grassDark);
  const b = new THREE.Color(C.grass);
  const c = new THREE.Color(C.grassLight);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = smoothNoise(x / 18, z / 18) * 0.7 + smoothNoise(x / 5, z / 5) * 0.3;
    tmp.copy(n < 0.5 ? a : b).lerp(n < 0.5 ? b : c, n < 0.5 ? n * 2 : (n - 0.5) * 2);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    // Rolling hills past the edge of the world; flat where anyone walks.
    const out = Math.max(0, Math.max(BOUNDS.x0 - x, x - BOUNDS.x1, BOUNDS.z0 - z, z - BOUNDS.z1));
    pos.setY(i, Math.min(out, 60) * 0.25 * smoothNoise(x / 30, z / 30));
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
    for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 1.6) {
      const ix = Math.round(x * 10);
      const iz = Math.round(z * 10);
      if (hash(ix, iz, 5) > 0.55) continue;
      const px = x + (hash(ix, iz, 6) - 0.5) * 1.5;
      const pz = z + (hash(ix, iz, 7) - 0.5) * 1.5;
      if (dist(px, pz, CITY.x, CITY.z) < PLAZA_R + 1) continue;
      if (nearRoad(px, pz, 0.4)) continue;
      if (nearColosseum(px, pz, 0.5)) continue;
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
    const h = 45 + hash(i, 2, 20) * 50;
    const w = 60 + hash(i, 3, 20) * 50;
    b.add(G.cone, C.mountain, { x, y: h / 2 - 5, z }, { y: a }, { x: w, y: h, z: w });
    b.add(G.cone, C.snow, { x, y: h - 5 - h * 0.12, z }, { y: a }, { x: w * 0.26, y: h * 0.25, z: w * 0.26 });
  }
  return b.build({ fog: false, shadows: false });
}


export function colosseumFlameSpots(): Array<{ x: number; y: number; z: number }> {
  const out: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    out.push({ x: COLOSSEUM.x + Math.sin(a) * (ARENA_R - 3), y: 1.95, z: COLOSSEUM.z + Math.cos(a) * (ARENA_R - 3) });
  }
  // A pair outside the gate, to light the way in.
  const gz = COLOSSEUM.z + ARENA_R + WALL_THICK + 1.5;
  out.push({ x: COLOSSEUM.x - GATE_HALF - 2.5, y: 1.95, z: gz }, { x: COLOSSEUM.x + GATE_HALF + 2.5, y: 1.95, z: gz });
  return out;
}

const flameGeo = new THREE.ConeGeometry(1, 1, 7);
function flame(root: THREE.Group, x: number, y: number, z: number, size: number): THREE.Mesh {
  const outer = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xff8a1e, transparent: true, opacity: 0.9 }));
  outer.position.set(x, y + size * 0.6, z);
  outer.scale.set(size * 0.55, size * 1.3, size * 0.55);
  const inner = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xffe066 }));
  inner.scale.set(0.5, 0.6, 0.5);
  inner.position.y = -0.15;
  outer.add(inner);
  outer.userData.size = size;
  root.add(outer);
  return outer;
}

function portcullis(): THREE.Group {
  const g = new THREE.Group();
  const iron = new THREE.MeshToonMaterial({ color: C.iron });
  const z = COLOSSEUM.z + ARENA_R + WALL_THICK / 2;
  for (let x = -GATE_HALF + 0.3; x <= GATE_HALF - 0.2; x += 0.75) {
    const bar = new THREE.Mesh(G.box, iron);
    bar.scale.set(0.14, 5.6, 0.14);
    bar.position.set(COLOSSEUM.x + x, 2.8, z);
    g.add(bar);
  }
  for (const y of [1.2, 3.0, 4.8]) {
    const bar = new THREE.Mesh(G.box, iron);
    bar.scale.set(GATE_HALF * 2, 0.14, 0.14);
    bar.position.set(COLOSSEUM.x, y, z);
    g.add(bar);
  }
  g.position.y = 6; // raised
  return g;
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
