import * as THREE from "three";
import { Batch } from "./batch";
import { toon } from "./toon";
import { dist } from "./bearing";
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
  road: 0xd8c08a,
  plaza: 0xd9d2bf,
  plazaDark: 0xc4bba4,
  wall: 0xf3ecdc,
  roofRed: 0xc8643c,
  roofBlue: 0x3e78c4,
  door: 0x6b4429,
  window: 0x2d5f9e,
  stone: 0xd8cbb0,
  stoneDark: 0xa99b80,
  marble: 0xeae5d8,
  trunk: 0x7a5232,
  leaf: 0x4f9a3a,
  leafLight: 0x6db84a,
  leafDark: 0x3c7d33,
  rock: 0x9a9890,
  sandstone: 0xd29b72,
  sandstoneDark: 0xa86f4f,
  arena: 0xdcb87e,
  arch: 0x5a3426,
  banner: 0x9b1c18,
  gold: 0xe8b83e,
  iron: 0x4a4a52,
  water: 0x5fb4e0,
  wood: 0x8a5a34,
  mountain: 0x8fb0cc,
  snow: 0xf4f7fb,
};

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  pyramid: new THREE.ConeGeometry(1, 1, 4),
  cone: new THREE.ConeGeometry(1, 1, 8),
  dome: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  crown: flat(new THREE.IcosahedronGeometry(1, 0)),
  rock: flat(new THREE.DodecahedronGeometry(1, 0)),
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
  root.add(ground());
  const grass = grassField();
  root.add(grass.mesh);

  const batch = new Batch();
  city(batch);
  road(batch);
  forest(batch);
  const flames: THREE.Mesh[] = [];
  colosseum(batch);
  root.add(batch.build());
  root.add(mountains());

  // The forge glows at the blacksmith's.
  const forge = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.25, 1.3), new THREE.MeshBasicMaterial({ color: 0xff7a1e }));
  forge.position.set(BLACKSMITH.x + 2.6, 1.05, BLACKSMITH.z - 1.8);
  root.add(forge);
  flames.push(flame(root, BLACKSMITH.x + 2.6, 1.15, BLACKSMITH.z - 1.8, 0.5));

  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 2.0, 0.1, 24),
    new THREE.MeshBasicMaterial({ color: C.water, transparent: true, opacity: 0.85 }),
  );
  water.position.set(0, 0.62, 0);
  root.add(water);

  for (const f of colosseumFlameSpots()) flames.push(flame(root, f.x, f.y, f.z, 0.7));

  const gate = portcullis();
  root.add(gate);
  const clouds = cloudLayer();
  root.add(clouds);
  return { root, gate, flames, clouds, grass: grass.material, water };
}

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

function city(b: Batch): void {
  // Plaza paving: rings of stone.
  for (let ring = 0; ring < 4; ring++) {
    b.add(G.cyl, ring % 2 ? C.plaza : C.plazaDark, { x: 0, y: 0.02 + ring * 0.002, z: 0 }, {}, {
      x: PLAZA_R - ring * 2.6,
      y: 0.04,
      z: PLAZA_R - ring * 2.6,
    });
  }
  // A paved lane out of the north gate to meet the road.
  b.add(G.box, C.plaza, { x: 0, y: 0.03, z: (CITY_GATE_Z - PLAZA_R) / 2 }, {}, { x: ROAD_HALF * 2, y: 0.05, z: -CITY_GATE_Z - PLAZA_R + 1 });

  // The fountain.
  b.add(G.cyl, C.marble, { x: 0, y: 0.3, z: 0 }, {}, { x: 2.4, y: 0.6, z: 2.4 });
  b.add(G.cyl, C.marble, { x: 0, y: 1.1, z: 0 }, {}, { x: 0.35, y: 1.6, z: 0.35 });
  b.add(G.cyl, C.marble, { x: 0, y: 1.9, z: 0 }, {}, { x: 0.9, y: 0.18, z: 0.9 });

  for (const h of houses()) house(b, h.x, h.z, h.w, h.d, h.yaw, h.dome);

  // City gate: two columns and a lintel.
  for (const sx of [-4.5, 4.5]) column(b, sx, CITY_GATE_Z, 5.2, 0.7);
  b.add(G.box, C.marble, { x: 0, y: 5.6, z: CITY_GATE_Z }, {}, { x: 11, y: 0.8, z: 1.4 });
  b.add(G.pyramid, C.roofRed, { x: 0, y: 6.4, z: CITY_GATE_Z }, { y: Math.PI / 4 }, { x: 7.5, y: 0.9, z: 1.2 });

  smithy(b);
}

function house(b: Batch, x: number, z: number, w: number, d: number, yaw: number, dome: boolean): void {
  const h = 3.4;
  b.add(G.box, C.wall, { x, y: h / 2, z }, {}, { x: w, y: h, z: d });
  if (dome) {
    b.add(G.box, C.wall, { x, y: h + 0.2, z }, {}, { x: w * 0.7, y: 0.4, z: d * 0.7 });
    b.add(G.dome, C.roofBlue, { x, y: h + 0.4, z }, {}, Math.min(w, d) * 0.38);
  } else {
    b.add(G.pyramid, C.roofRed, { x, y: h + 0.9, z }, { y: Math.PI / 4 }, { x: w * 0.78, y: 1.8, z: d * 0.78 });
  }
  // Door and windows on the face toward the plaza.
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const half = Math.abs(fx) > 0.5 ? w / 2 : d / 2;
  const across = { x: Math.abs(fz), z: Math.abs(fx) };
  const at = (side: number, y: number): { x: number; y: number; z: number } => ({
    x: x + fx * (half + 0.02) + across.x * side,
    y,
    z: z + fz * (half + 0.02) + across.z * side,
  });
  b.add(G.box, C.door, at(0, 1.0), { y: yaw }, { x: 1.0, y: 2.0, z: 0.1 });
  b.add(G.box, C.window, at(-1.6, 2.2), { y: yaw }, { x: 0.7, y: 0.7, z: 0.1 });
  b.add(G.box, C.window, at(1.6, 2.2), { y: yaw }, { x: 0.7, y: 0.7, z: 0.1 });
}

function column(b: Batch, x: number, z: number, height: number, r: number, color = C.marble): void {
  b.add(G.box, color, { x, y: 0.15, z }, {}, { x: r * 2.6, y: 0.3, z: r * 2.6 });
  b.add(G.cyl, color, { x, y: height / 2, z }, {}, { x: r, y: height, z: r });
  b.add(G.box, color, { x, y: height + 0.15, z }, {}, { x: r * 2.6, y: 0.3, z: r * 2.6 });
}

function smithy(b: Batch): void {
  const { x, z } = BLACKSMITH;
  // Counter facing the plaza (west), forge behind it.
  b.add(G.box, C.wood, { x: x + 0.3, y: 0.55, z }, {}, { x: 0.9, y: 1.1, z: 4.6 });
  b.add(G.box, C.stone, { x: x + 2.6, y: 0.5, z: z - 1.8 }, {}, { x: 1.8, y: 1.0, z: 1.8 });
  // Anvil.
  b.add(G.box, C.iron, { x: x + 2.4, y: 0.45, z: z + 1.4 }, {}, { x: 0.4, y: 0.9, z: 0.4 });
  b.add(G.box, C.iron, { x: x + 2.4, y: 0.95, z: z + 1.4 }, {}, { x: 0.5, y: 0.22, z: 1.0 });
  // Posts and a striped awning.
  for (const [dx, dz] of [
    [-0.2, -2.8],
    [-0.2, 2.8],
    [3.6, -2.8],
    [3.6, 2.8],
  ] as const) {
    b.add(G.box, C.wood, { x: x + dx, y: 1.6, z: z + dz }, {}, { x: 0.22, y: 3.2, z: 0.22 });
  }
  for (let i = 0; i < 6; i++) {
    b.add(G.box, i % 2 ? 0xf4ead2 : C.banner, { x: x + 1.7, y: 3.3, z: z - 2.75 + i * 1.1 }, { z: 0.18 }, { x: 4.6, y: 0.12, z: 1.1 });
  }
  // A bronze helmet and breastplate on a stand: what is for sale.
  b.add(G.box, C.wood, { x: x - 1.2, y: 0.8, z: z + 3.4 }, {}, { x: 0.12, y: 1.6, z: 0.12 });
  b.add(G.dome, 0xc8913a, { x: x - 1.2, y: 1.6, z: z + 3.4 }, {}, 0.32);
  b.add(G.box, 0x2f6fb5, { x: x - 1.2, y: 2.0, z: z + 3.4 }, {}, { x: 0.08, y: 0.25, z: 0.55 });
  b.add(G.cyl, 0xc8913a, { x: x - 1.2, y: 1.1, z: z + 3.4 }, {}, { x: 0.36, y: 0.6, z: 0.26 });
}

function road(b: Batch): void {
  // Flagstones, staggered, so the road has a texture rather than a stripe.
  for (let z = ROAD_START; z > ROAD_END; z -= 1.3) {
    const iz = Math.round(z * 10);
    const row = Math.round(z / 1.3) % 2 ? 0.6 : 0;
    for (let x = -ROAD_HALF + row; x < ROAD_HALF; x += 1.25) {
      const ix = Math.round(x * 10);
      const shade = hash(ix, iz, 11) > 0.5 ? C.road : 0xcbb07a;
      b.add(G.box, shade, { x: x + 0.6, y: 0.03, z }, { y: (hash(ix, iz, 12) - 0.5) * 0.1 }, { x: 1.15, y: 0.06, z: 1.2 });
    }
  }
  // Columns along the way, some standing, some broken.
  for (let z = ROAD_START - 8; z > ROAD_END + 6; z -= 14) {
    for (const side of [-1, 1]) {
      const iz = Math.round(z);
      const broken = hash(iz, side, 13) > 0.55;
      const height = broken ? 1.2 + hash(iz, side, 14) * 1.5 : 4.2;
      const x = side * (ROAD_HALF + 1.6);
      b.add(G.box, C.marble, { x, y: 0.15, z }, {}, { x: 1.6, y: 0.3, z: 1.6 });
      b.add(G.cyl, C.marble, { x, y: height / 2, z }, {}, { x: 0.5, y: height, z: 0.5 });
      if (!broken) b.add(G.box, C.marble, { x, y: height + 0.15, z }, {}, { x: 1.4, y: 0.3, z: 1.4 });
      else b.add(G.cyl, C.marble, { x: x + side * 1.4, y: 0.45, z: z + 0.6 }, { z: Math.PI / 2, y: 0.4 }, { x: 0.5, y: 1.5, z: 0.5 });
    }
  }
  // Each camp: a ring of stones and a dead campfire, so you can see where the bones lie.
  for (const camp of CAMPS) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      b.add(G.rock, C.rock, { x: camp.x + Math.sin(a) * 4.5, y: 0.2, z: camp.z + Math.cos(a) * 4.5 }, { y: a }, 0.45 + (i % 3) * 0.15);
    }
    b.add(G.cyl6, 0x3a3a3a, { x: camp.x, y: 0.06, z: camp.z }, {}, { x: 0.9, y: 0.12, z: 0.9 });
    b.add(G.box, 0xe9e1c9, { x: camp.x + 1.4, y: 0.08, z: camp.z + 0.5 }, { y: 0.7 }, { x: 0.8, y: 0.1, z: 0.12 });
    b.add(G.box, 0xe9e1c9, { x: camp.x - 1.1, y: 0.08, z: camp.z - 0.8 }, { y: -0.4 }, { x: 0.6, y: 0.1, z: 0.12 });
  }
}

function forest(b: Batch): void {
  const tones = [C.leaf, C.leafLight, C.leafDark];
  for (const t of trees()) {
    const ix = Math.round(t.x * 10);
    const iz = Math.round(t.z * 10);
    const s = t.size;
    b.add(G.cyl6, C.trunk, { x: t.x, y: 1.2 * s, z: t.z }, {}, { x: 0.32 * s, y: 2.4 * s, z: 0.32 * s });
    const tone = tones[Math.floor(hash(ix, iz, 15) * tones.length)] ?? C.leaf;
    const pine = hash(ix, iz, 16) > 0.7;
    if (pine) {
      b.add(G.cone, C.leafDark, { x: t.x, y: 3.2 * s, z: t.z }, {}, { x: 1.6 * s, y: 3.2 * s, z: 1.6 * s });
      b.add(G.cone, C.leafDark, { x: t.x, y: 4.6 * s, z: t.z }, {}, { x: 1.1 * s, y: 2.4 * s, z: 1.1 * s });
    } else {
      b.add(G.crown, tone, { x: t.x, y: 3.3 * s, z: t.z }, { y: hash(ix, iz, 17) * 3 }, { x: 1.9 * s, y: 1.6 * s, z: 1.9 * s });
      b.add(G.crown, tone, { x: t.x + 0.7 * s, y: 2.8 * s, z: t.z + 0.3 * s }, { y: 1 }, 1.1 * s);
    }
    if (hash(ix, iz, 18) > 0.8) b.add(G.rock, C.rock, { x: t.x + 1.5, y: 0.25, z: t.z - 1 }, { y: hash(ix, iz, 19) * 3 }, 0.6);
  }
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
  const g = b.build();
  for (const m of g.children) ((m as THREE.Mesh).material as THREE.MeshToonMaterial).fog = false;
  return g;
}

const SEGMENTS = 44;
const WALL_H = 9;

function colosseum(b: Batch): void {
  const { x: cx, z: cz } = COLOSSEUM;
  // Sand floor.
  b.add(G.cyl, C.arena, { x: cx, y: 0.03, z: cz }, {}, { x: ARENA_R + 0.5, y: 0.06, z: ARENA_R + 0.5 });
  const mid = ARENA_R + WALL_THICK / 2;
  const span = ((2 * Math.PI * mid) / SEGMENTS) * 1.02;
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const sx = Math.sin(a);
    const sz = Math.cos(a);
    // The gate faces +z, down the road.
    const gap = Math.abs(sx * mid) < GATE_HALF + span / 2 && sz > 0;
    if (gap) continue;
    const at = (r: number, y: number): { x: number; y: number; z: number } => ({ x: cx + sx * r, y, z: cz + sz * r });
    const shade = i % 2 ? C.sandstone : 0xcf9670;
    b.add(G.box, shade, at(mid, WALL_H / 2), { y: a }, { x: span, y: WALL_H, z: WALL_THICK });
    b.add(G.box, C.sandstoneDark, at(mid, WALL_H + 0.25), { y: a }, { x: span, y: 0.5, z: WALL_THICK + 0.4 });
    // Every other segment carries a merlon on the outer lip.
    if (i % 2 === 0) b.add(G.box, shade, at(mid + WALL_THICK / 2 - 0.3, WALL_H + 1.0), { y: a }, { x: span * 0.6, y: 1.0, z: 0.6 });
    // Two tiers of dark arches, inside and out.
    for (const face of [ARENA_R - 0.03, ARENA_R + WALL_THICK + 0.03]) {
      b.add(G.box, C.arch, at(face, 1.9), { y: a }, { x: span * 0.5, y: 3.2, z: 0.12 });
      b.add(G.box, C.arch, at(face, 6.1), { y: a }, { x: span * 0.42, y: 2.4, z: 0.12 });
      b.add(G.box, C.sandstoneDark, at(face, 4.4), { y: a }, { x: span, y: 0.35, z: 0.3 });
    }
    // Ares's colours: red banners round the inside.
    if (i % 4 === 2) {
      b.add(G.box, C.banner, at(ARENA_R - 0.15, 6.3), { y: a }, { x: span * 0.5, y: 4.4, z: 0.06 });
      b.add(G.box, C.gold, at(ARENA_R - 0.2, 7.0), { y: a }, { x: span * 0.18, y: 0.9, z: 0.06 });
      b.add(G.box, C.gold, at(ARENA_R - 0.2, 8.55), { y: a }, { x: span * 0.6, y: 0.18, z: 0.12 });
    }
  }
  // Gate towers and the lintel the portcullis drops from.
  const gz = cz + mid;
  for (const side of [-1, 1]) {
    const tx = cx + side * (GATE_HALF + 1.4);
    b.add(G.box, C.sandstoneDark, { x: tx, y: (WALL_H + 3) / 2, z: gz }, {}, { x: 2.8, y: WALL_H + 3, z: WALL_THICK + 1.5 });
    b.add(G.pyramid, C.banner, { x: tx, y: WALL_H + 4, z: gz }, { y: Math.PI / 4 }, { x: 2.4, y: 2, z: 2.4 });
    // Great banners of Ares either side of the way in.
    b.add(G.box, C.banner, { x: tx, y: 6.5, z: gz + WALL_THICK / 2 + 0.8 }, {}, { x: 1.8, y: 6, z: 0.08 });
    b.add(G.box, C.gold, { x: tx, y: 7.8, z: gz + WALL_THICK / 2 + 0.85 }, { z: Math.PI / 4 }, { x: 0.8, y: 0.8, z: 0.08 });
  }
  b.add(G.box, C.sandstoneDark, { x: cx, y: 7.3, z: gz }, {}, { x: GATE_HALF * 2 + 0.2, y: 3.4, z: WALL_THICK + 0.6 });
  // Braziers round the floor.
  for (const f of colosseumFlameSpots()) {
    b.add(G.cyl6, C.iron, { x: f.x, y: 0.8, z: f.z }, {}, { x: 0.2, y: 1.6, z: 0.2 });
    b.add(G.cyl, C.iron, { x: f.x, y: 1.7, z: f.z }, {}, { x: 0.65, y: 0.3, z: 0.65 });
  }
  // Spears stuck in the sand.
  for (let i = 0; i < 9; i++) {
    const a = hash(i, 3, 21) * Math.PI * 2;
    const r = 6 + hash(i, 4, 21) * 10;
    const x = cx + Math.sin(a) * r;
    const z = cz + Math.cos(a) * r;
    b.add(G.cyl6, C.wood, { x, y: 0.9, z }, { x: 0.25, z: 0.2 }, { x: 0.04, y: 2, z: 0.04 });
    b.add(G.cone, C.iron, { x: x + 0.05, y: 1.95, z: z + 0.22 }, { x: 0.25, z: 0.2 }, { x: 0.08, y: 0.3, z: 0.08 });
  }
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
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(hash(i, 0, 30) * 3);
    for (let p = 0; p < puffs; p++) {
      const m = new THREE.Mesh(puff, mat);
      const s = 6 + hash(i, p, 31) * 6;
      m.scale.set(s * 1.3, s * 0.7, s);
      m.position.set(p * 7 - puffs * 3.5, hash(i, p, 32) * 3, hash(i, p, 33) * 6);
      cloud.add(m);
    }
    cloud.position.set((hash(i, 1, 34) - 0.5) * 500, 110 + hash(i, 2, 34) * 40, -75 + (hash(i, 3, 34) - 0.5) * 500);
    g.add(cloud);
  }
  return g;
}
