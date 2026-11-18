import * as THREE from "three";
import { toon } from "../gods/toon";
import type { Theme } from "./ladder";
import { at, BARRIER, locate, mulberry, offset, STEP, type Track } from "./track";

export interface Palette {
  sky: number;
  ground: number;
  road: number;
  crowns: number[];
  trunk: number;
  /** What grows: round crowns, pines, or cacti. */
  flora: "round" | "pine" | "cactus";
}

export const PALETTES: Record<Theme, Palette> = {
  meadow: { sky: 0x9fd6f5, ground: 0x78c052, road: 0x55575f, crowns: [0x3f9a3a, 0x4fae44, 0x2f8a3a], trunk: 0x7a5230, flora: "round" },
  desert: { sky: 0xf5dcae, ground: 0xe6bd72, road: 0x6a5f58, crowns: [0x5a9a4a, 0x4a8a44], trunk: 0x5a9a4a, flora: "cactus" },
  snow: { sky: 0xd4e6f5, ground: 0xeef4fa, road: 0x5a5e6a, crowns: [0x2f6a4a, 0x3a7a52], trunk: 0x6a4a30, flora: "pine" },
  autumn: { sky: 0xf2d6b4, ground: 0xa6b24c, road: 0x58555a, crowns: [0xe0782a, 0xc8462a, 0xf0b030, 0xd85a20], trunk: 0x6a4428, flora: "round" },
};

const KERB = 1.3;
const WALL_H = 0.9;

/** Everything that stands still on a course, in one group to drop when the race is over. */
export function buildCourse(t: Track, theme: Theme, title: string): THREE.Group {
  const pal = PALETTES[theme];
  const root = new THREE.Group();
  const flat = (color: number): THREE.Material => toon(color, { rim: 0 });

  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 48).rotateX(-Math.PI / 2), flat(pal.ground));
  ground.receiveShadow = true;
  root.add(ground);

  root.add(ribbon(t, -t.width / 2, t.width / 2, 0.02, () => pal.road));
  // Kerbs in stripes two samples long, red and white.
  const kerbColor = (i: number): number => (Math.floor(i / 2) % 2 === 0 ? 0xd8382c : 0xf4f1e8);
  root.add(ribbon(t, t.width / 2, t.width / 2 + KERB, 0.03, kerbColor));
  root.add(ribbon(t, -t.width / 2 - KERB, -t.width / 2, 0.03, kerbColor));
  root.add(dashes(t));
  root.add(walls(t));
  root.add(startLine(t));
  root.add(gantry(t, title));
  root.add(grandstand(t));
  root.add(flora(t, pal));
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== ground) {
      o.receiveShadow = true;
    }
  });
  return root;
}

/** A strip along the loop between two lateral offsets, painted per sample. */
function ribbon(t: Track, from: number, to: number, y: number, color: (i: number) => number): THREE.Mesh {
  const n = t.xs.length;
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a0 = offset(t, i * STEP, from);
    const a1 = offset(t, i * STEP, to);
    const b0 = offset(t, (i + 1) * STEP, from);
    const b1 = offset(t, (i + 1) * STEP, to);
    // Wound so the face looks up, whichever side of the centreline the strip is on.
    pos.push(a0.x, y, a0.z, b0.x, y, b0.z, a1.x, y, a1.z, a1.x, y, a1.z, b0.x, y, b0.z, b1.x, y, b1.z);
    c.setHex(color(i));
    for (let v = 0; v < 6; v++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = toon(0xffffff, { rim: 0 });
  m.vertexColors = true;
  m.side = THREE.DoubleSide;
  return new THREE.Mesh(g, m);
}

function dashes(t: Track): THREE.Mesh {
  const pos: number[] = [];
  const w = 0.25;
  for (let s = 0; s < t.length; s += 8) {
    const a0 = offset(t, s, -w);
    const a1 = offset(t, s, w);
    const b0 = offset(t, s + 3.5, -w);
    const b1 = offset(t, s + 3.5, w);
    const y = 0.035;
    pos.push(a0.x, y, a0.z, b0.x, y, b0.z, a1.x, y, a1.z, a1.x, y, a1.z, b0.x, y, b0.z, b1.x, y, b1.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const m = toon(0xf4f1e8, { rim: 0 });
  m.side = THREE.DoubleSide;
  return new THREE.Mesh(g, m);
}

/** Tyre walls on both sides, at the barrier: striped so the speed reads past them. */
function walls(t: Track): THREE.Mesh {
  const n = t.xs.length;
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const a = offset(t, i * STEP, BARRIER * side);
      const b = offset(t, (i + 1) * STEP, BARRIER * side);
      const ai = offset(t, i * STEP, (BARRIER + 0.6) * side);
      const bi = offset(t, (i + 1) * STEP, (BARRIER + 0.6) * side);
      // Inner face, and the top.
      pos.push(a.x, 0, a.z, b.x, 0, b.z, a.x, WALL_H, a.z, a.x, WALL_H, a.z, b.x, 0, b.z, b.x, WALL_H, b.z);
      pos.push(a.x, WALL_H, a.z, b.x, WALL_H, b.z, ai.x, WALL_H, ai.z, ai.x, WALL_H, ai.z, b.x, WALL_H, b.z, bi.x, WALL_H, bi.z);
      c.setHex(Math.floor(i / 3) % 2 === 0 ? 0xf4f1e8 : side < 0 ? 0x2f7fd8 : 0xd8382c);
      for (let v = 0; v < 12; v++) col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = toon(0xffffff, { rim: 0.2 });
  m.vertexColors = true;
  m.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  return mesh;
}

function checker(cols: number, rows: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = cols * 8;
  c.height = rows * 8;
  const g = c.getContext("2d")!;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      g.fillStyle = (x + y) % 2 === 0 ? "#f4f1e8" : "#1c1c22";
      g.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function startLine(t: Track): THREE.Mesh {
  const p = at(t, 0);
  const g = new THREE.PlaneGeometry(t.width, 2).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: checker(13, 2) }));
  m.position.set(p.x, 0.04, p.z);
  m.rotation.y = Math.atan2(p.tx, p.tz);
  return m;
}

function gantry(t: Track, title: string): THREE.Group {
  const p = at(t, 0);
  const g = new THREE.Group();
  g.position.set(p.x, 0, p.z);
  g.rotation.y = Math.atan2(p.tx, p.tz);
  const post = new THREE.CylinderGeometry(0.35, 0.35, 7, 10);
  const span = t.width / 2 + KERB + 0.8;
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(post, toon(0x3a3a44));
    m.position.set(side * span, 3.5, 0);
    m.castShadow = true;
    g.add(m);
  }
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#d8382c";
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = "#f4f1e8";
  ctx.font = "italic 800 54px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title.toUpperCase(), 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + 0.8, 1.6, 0.4), [
    toon(0xd8382c),
    toon(0xd8382c),
    toon(0xd8382c),
    toon(0xd8382c),
    new THREE.MeshBasicMaterial({ map: tex }),
    new THREE.MeshBasicMaterial({ map: tex }),
  ]);
  banner.position.y = 6.6;
  banner.castShadow = true;
  g.add(banner);
  return g;
}

/** A stand of cheering colour beside the start, outside the left-hand wall. */
function grandstand(t: Track): THREE.Group {
  const g = new THREE.Group();
  const s = 14;
  const p = offset(t, s, -(BARRIER + 7));
  g.position.set(p.x, 0, p.z);
  g.rotation.y = Math.atan2(at(t, s).tx, at(t, s).tz);
  const length = 30;
  for (let row = 0; row < 4; row++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8 + row * 0.8, length), toon(row % 2 ? 0xc8c2b8 : 0xb0aaa0));
    step.position.set(-row * 2.2, (0.8 + row * 0.8) / 2, 0);
    step.castShadow = true;
    g.add(step);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, length + 2), toon(0x2f7fd8));
  roof.position.set(-3.3, 6.2, 0);
  roof.castShadow = true;
  g.add(roof);
  const crowd = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 8, 6), toon(0xffffff), 4 * 36);
  const rand = mulberry(t.seed);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const shirts = [0xd8382c, 0xf2c230, 0x2f7fd8, 0x4cae4f, 0xf07a22, 0x8a4fd0, 0xf4f1e8];
  let i = 0;
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k < 36; k++) {
      m.makeTranslation(-row * 2.2 + (rand() - 0.5) * 0.6, 0.8 + row * 0.8 + 0.4, -length / 2 + 0.6 + k * (length / 36));
      crowd.setMatrixAt(i, m);
      crowd.setColorAt(i, c.setHex(shirts[Math.floor(rand() * shirts.length)]!));
      i++;
    }
  }
  crowd.name = "crowd";
  g.add(crowd);
  return g;
}

function flora(t: Track, pal: Palette): THREE.Group {
  const g = new THREE.Group();
  const rand = mulberry(t.seed * 3 + 1);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < t.xs.length; i++) {
    minX = Math.min(minX, t.xs[i]!);
    maxX = Math.max(maxX, t.xs[i]!);
    minZ = Math.min(minZ, t.zs[i]!);
    maxZ = Math.max(maxZ, t.zs[i]!);
  }
  const margin = 90;
  const spots: Array<{ x: number; z: number; size: number; tint: number }> = [];
  for (let tries = 0; tries < 900 && spots.length < 260; tries++) {
    const x = minX - margin + rand() * (maxX - minX + margin * 2);
    const z = minZ - margin + rand() * (maxZ - minZ + margin * 2);
    if (Math.abs(locate(t, x, z).lateral) < BARRIER + 4) continue;
    spots.push({ x, z, size: 0.8 + rand() * 0.7, tint: Math.floor(rand() * pal.crowns.length) });
  }
  const trunkGeo = pal.flora === "cactus" ? new THREE.CylinderGeometry(0.55, 0.6, 4, 8) : new THREE.CylinderGeometry(0.3, 0.42, 2.2, 6);
  const crownGeo =
    pal.flora === "pine"
      ? new THREE.ConeGeometry(2.1, 5.2, 7)
      : pal.flora === "cactus"
        ? new THREE.CylinderGeometry(0.4, 0.4, 1.8, 8)
        : new THREE.IcosahedronGeometry(2.1, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, toon(pal.trunk), spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, toon(0xffffff), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const c = new THREE.Color();
  spots.forEach((p, i) => {
    sc.setScalar(p.size);
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.x * 13.7);
    const trunkH = pal.flora === "cactus" ? 4 : 2.2;
    m.compose(v.set(p.x, (trunkH / 2) * p.size, p.z), q, sc);
    trunks.setMatrixAt(i, m);
    if (pal.flora === "cactus") {
      // An arm, stood up beside the trunk.
      m.compose(v.set(p.x + 0.9 * p.size, 2.6 * p.size, p.z), q, sc);
    } else {
      const lift = pal.flora === "pine" ? 4.4 : 3.6;
      m.compose(v.set(p.x, lift * p.size, p.z), q, sc);
    }
    crowns.setMatrixAt(i, m);
    crowns.setColorAt(i, c.setHex(pal.crowns[p.tint]!));
  });
  trunks.castShadow = crowns.castShadow = true;
  g.add(trunks, crowns);
  return g;
}

// ---------------------------------------------------------------------------
// Karts

export interface KartModel {
  root: THREE.Group;
  /** Turned with the steering and leaned into corners. */
  body: THREE.Group;
  wheels: THREE.Mesh[];
  frontWheels: THREE.Group[];
  flame: THREE.Mesh;
}

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.4, 14).rotateZ(Math.PI / 2);

export function buildKart(color: number, helmet: number): KartModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = toon(color);
  const dark = toon(0x25252b);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(1.5, 0.35, 2.5), paint, 0, 0.42, 0);
  const nose = add(new THREE.BoxGeometry(1.2, 0.3, 0.9), paint, 0, 0.55, 1.35);
  nose.rotation.x = 0.25;
  add(new THREE.BoxGeometry(1.7, 0.18, 0.5), dark, 0, 0.45, 1.75);
  add(new THREE.BoxGeometry(1.0, 0.5, 0.8), dark, 0, 0.75, -0.55);
  add(new THREE.BoxGeometry(1.8, 0.12, 0.45), paint, 0, 1.25, -1.25);
  add(new THREE.BoxGeometry(0.12, 0.6, 0.3), dark, -0.6, 0.95, -1.25);
  add(new THREE.BoxGeometry(0.12, 0.6, 0.3), dark, 0.6, 0.95, -1.25);
  // The driver: a body and a round helmet with a visor.
  add(new THREE.CylinderGeometry(0.34, 0.4, 0.75, 10), toon(0xf4f1e8), 0, 1.0, -0.15);
  add(new THREE.SphereGeometry(0.42, 14, 10), toon(helmet), 0, 1.6, -0.1);
  add(new THREE.BoxGeometry(0.62, 0.18, 0.2), toon(0x1c1c22, { rim: 0.6 }), 0, 1.62, 0.25);
  add(new THREE.TorusGeometry(0.28, 0.06, 6, 14), dark, 0, 1.05, 0.55).rotation.x = -0.9;

  const wheels: THREE.Mesh[] = [];
  const frontWheels: THREE.Group[] = [];
  for (const [x, z, front] of [
    [-0.9, 0.95, true],
    [0.9, 0.95, true],
    [-0.95, -0.85, false],
    [0.95, -0.85, false],
  ] as const) {
    const hub = new THREE.Group();
    hub.position.set(x, 0.42, z);
    root.add(hub);
    const w = add(wheelGeo, dark, 0, 0, 0, hub);
    if (!front) w.scale.set(1.15, 1.08, 1.08);
    wheels.push(w);
    if (front) frontWheels.push(hub);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 1.4, 10).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.85 }),
  );
  flame.position.set(0, 0.6, -1.9);
  flame.visible = false;
  root.add(flame);
  return { root, body, wheels, frontWheels, flame };
}
