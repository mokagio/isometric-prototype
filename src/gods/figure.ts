import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Kit, Slot } from "./armor";
import { toon } from "./toon";

/**
 * Every person in the game is the same doll — hero, bandit, skeleton, soldier, smith,
 * god — turned on a lathe rather than stacked from boxes, facing +z, with
 * joints at the hips, knees, shoulders and elbows. What differs is the paint
 * and the build.
 */
export interface Build {
  /** Flesh, or the bare bones of the road's dead. */
  body: "flesh" | "bone";
  skin: number;
  hair: number | null;
  hairStyle: "short" | "long" | "bald";
  beard: number | null;
  /** A headband in this colour, worn under no helmet. */
  band: number | null;
  tunic: number | null;
  sandals: number;
  eyes: number;
  /** Glowing eyes, for the dead and the divine. */
  eyeGlow: boolean;
  /** How heavily built: 1 is the hero. */
  bulk: number;
  shield: { rim: number; face: number; emblem: number; sign: "star" | "lambda" | "spear" } | null;
  weapon: "sword" | "hammer" | "trident" | "bident";
  blade: number;
  cape: number | null;
}

export const HERO_BUILD: Build = {
  body: "flesh",
  skin: 0xf1c27d,
  hair: 0x7a4421,
  hairStyle: "short",
  beard: null,
  band: 0x2f6fb5,
  tunic: 0x2f6fb5,
  sandals: 0x7a4e2a,
  eyes: 0x24324a,
  eyeGlow: false,
  bulk: 1,
  shield: { rim: 0xb07a35, face: 0xeee4cc, emblem: 0x2f6fb5, sign: "star" },
  weapon: "sword",
  blade: 0xdfe8f0,
  cape: null,
};

export const SKELETON_BUILD: Build = {
  body: "bone",
  skin: 0xe9e1c9,
  hair: null,
  hairStyle: "bald",
  beard: null,
  band: null,
  tunic: null,
  sandals: 0xe9e1c9,
  eyes: 0xff4a2a,
  eyeGlow: true,
  bulk: 1,
  shield: null,
  weapon: "sword",
  blade: 0x8f7a63,
  cape: null,
};

/** A skeleton of charred bone with fire in its eyes, climbed out of the lava under Tartarus. */
export const LAVA_SKELETON_BUILD: Build = {
  ...SKELETON_BUILD,
  skin: 0x3a2620,
  sandals: 0x3a2620,
  eyes: 0xffa21e,
  blade: 0xff6a1e,
};

export const BANDIT_BUILD: Build = {
  body: "flesh",
  skin: 0xc98e5c,
  hair: 0x2a1c12,
  hairStyle: "long",
  beard: 0x2a1c12,
  band: 0x7a1f1a,
  tunic: 0x6b5a3a,
  sandals: 0x3b2a1a,
  eyes: 0x1b1b2a,
  eyeGlow: false,
  bulk: 0.95,
  shield: { rim: 0x4a3420, face: 0x8a6a44, emblem: 0x7a1f1a, sign: "spear" },
  weapon: "sword",
  blade: 0x9a8a72,
  cape: 0x4a3a2a,
};

export const SPARTAN_BUILD: Build = {
  body: "flesh",
  skin: 0xd9a066,
  hair: 0x2b1d14,
  hairStyle: "long",
  beard: 0x2b1d14,
  band: null,
  tunic: 0xa3241e,
  sandals: 0x5a3a22,
  eyes: 0x1b1b2a,
  eyeGlow: false,
  bulk: 1.05,
  shield: { rim: 0xc8913a, face: 0xc8913a, emblem: 0xa3241e, sign: "lambda" },
  weapon: "sword",
  blade: 0xd0d6dc,
  cape: 0xa3241e,
};

export const ARES_BUILD: Build = {
  body: "flesh",
  skin: 0xb8784a,
  hair: 0x1a0d08,
  hairStyle: "long",
  beard: 0x1a0d08,
  band: null,
  tunic: 0x3a0d0d,
  sandals: 0x2a1410,
  eyes: 0xff3a1a,
  eyeGlow: true,
  bulk: 1.2,
  shield: { rim: 0xe2b23c, face: 0x7d1612, emblem: 0xe2b23c, sign: "spear" },
  weapon: "sword",
  blade: 0xc9ced6,
  cape: 0x7d1612,
};

export const SMITH_BUILD: Build = {
  body: "flesh",
  skin: 0xc68a5a,
  hair: 0x5a4a3e,
  hairStyle: "bald",
  beard: 0x5a4a3e,
  band: null,
  tunic: 0x6b4a2e,
  sandals: 0x3f2a1a,
  eyes: 0x1b1b2a,
  eyeGlow: false,
  bulk: 1.25,
  shield: null,
  weapon: "hammer",
  blade: 0x55585e,
  cape: null,
};

export const POSEIDON_BUILD: Build = {
  body: "flesh",
  skin: 0x8fc4c0,
  hair: 0xe8f2f2,
  hairStyle: "long",
  beard: 0xe8f2f2,
  band: null,
  tunic: 0x1f4f9a,
  sandals: 0x2a3f5a,
  eyes: 0x3fe0ff,
  eyeGlow: true,
  bulk: 1.25,
  shield: null,
  weapon: "trident",
  blade: 0xe8b83e,
  cape: 0x2a7fa8,
};

export const HADES_BUILD: Build = {
  body: "flesh",
  skin: 0xb8c0cc,
  hair: 0x10161a,
  hairStyle: "long",
  beard: 0x10161a,
  band: null,
  tunic: 0x1a1420,
  sandals: 0x101014,
  eyes: 0x5fff8a,
  eyeGlow: true,
  bulk: 1.25,
  shield: null,
  weapon: "bident",
  blade: 0x5fe08a,
  cape: 0x3a1a4a,
};

export const FISHER_BUILD: Build = {
  body: "flesh",
  skin: 0xc98a58,
  hair: 0x4a3a2e,
  hairStyle: "short",
  beard: 0x6a5a4a,
  band: null,
  tunic: 0xe6dcc4,
  sandals: 0x5a3a22,
  eyes: 0x1b1b2a,
  eyeGlow: false,
  bulk: 1.05,
  shield: null,
  weapon: "trident",
  blade: 0x9aa4ac,
  cape: null,
};

/** The paint for each kit: the metal, its trim, and the crest. */
export const KIT_PAINT: Record<Exclude<Kit, "none">, { metal: number; trim: number; crest: number }> = {
  bronze: { metal: 0xc8913a, trim: 0x8a5a22, crest: 0x2f6fb5 },
  ares: { metal: 0x8e1b16, trim: 0xe8b83e, crest: 0x1a0a08 },
  poseidon: { metal: 0x2f9a92, trim: 0xe8b83e, crest: 0xf2f8f8 },
  hades: { metal: 0x2a2430, trim: 0x5fe08a, crest: 0x5fe08a },
};

export interface Figure {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  sword: THREE.Group;
  shield: THREE.Group | null;
  cape: THREE.Group | null;
  slash: THREE.Mesh;
  /** The armour pieces per slot. */
  armor: Record<Slot, THREE.Mesh[]>;
  /** Whatever a helmet hides: hair and headband. */
  hairline: THREE.Mesh[];
  metal: THREE.MeshToonMaterial;
  trim: THREE.MeshToonMaterial;
  crest: THREE.MeshToonMaterial;
  /** Every material it owns, so a blow can flash it and death can fade it. */
  mats: THREE.MeshToonMaterial[];
  /** Materials that glow on their own, and what with, so a flash can hand it back. */
  glow: Array<{ mat: THREE.MeshToonMaterial; color: number }>;
  walk: number;
  kit: Kit | null;
}

// ---------------------------------------------------------------------------
// Shapes

const V = (x: number, y: number): THREE.Vector2 => new THREE.Vector2(x, y);

/** A solid of revolution through `[radius, height]` pairs, bottom to top. */
function lathe(profile: Array<[number, number]>, segments = 16): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => V(Math.max(r, 0.0001), y)),
    segments,
  );
}

/** A limb hanging down from its joint: rounded at both ends, narrowing toward the far one. */
function taper(len: number, r1: number, r2: number): THREE.BufferGeometry {
  return lathe(
    [
      [0, -len - r2 * 0.9],
      [r2 * 0.75, -len - r2 * 0.6],
      [r2, -len],
      [(r1 + r2) * 0.52, -len * 0.5],
      [r1, -r1 * 0.2],
      [r1 * 0.75, r1 * 0.5],
      [0, r1 * 0.8],
    ],
    14,
  );
}

const SPHERE = new THREE.SphereGeometry(1, 20, 14);
const HALF = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const TORUS = new THREE.TorusGeometry(1, 0.12, 8, 24);
const CONE = new THREE.ConeGeometry(1, 1, 8);

/** A pleated skirt: a flared tube whose hem ripples into folds. */
function pleats(top: number, bottom: number, height: number, folds: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(top, bottom, height, folds * 4, 3, true);
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const depth = 0.5 - y / height; // 0 at the waist, 1 at the hem
    const k = 1 + Math.cos(a * folds) * 0.07 * depth;
    p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** The xiphos: a leaf-shaped Greek blade, widest two-thirds of the way up. */
function xiphos(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.04, 0);
  s.quadraticCurveTo(-0.06, 0.45, -0.05, 0.6);
  s.lineTo(0, 0.86);
  s.lineTo(0.05, 0.6);
  s.quadraticCurveTo(0.06, 0.45, 0.04, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -0.006);
  return g;
}

function emblem(sign: "star" | "lambda" | "spear"): THREE.BufferGeometry {
  const s = new THREE.Shape();
  if (sign === "lambda") {
    s.moveTo(-0.17, -0.16);
    s.lineTo(-0.02, 0.18);
    s.lineTo(0.02, 0.18);
    s.lineTo(0.17, -0.16);
    s.lineTo(0.11, -0.16);
    s.lineTo(0, 0.08);
    s.lineTo(-0.11, -0.16);
  } else if (sign === "spear") {
    s.moveTo(0, 0.22);
    s.lineTo(0.06, 0.08);
    s.lineTo(0.02, 0.06);
    s.lineTo(0.02, -0.2);
    s.lineTo(-0.02, -0.2);
    s.lineTo(-0.02, 0.06);
    s.lineTo(-0.06, 0.08);
  } else {
    // A sixteen-ray sun, as on Macedonian shields.
    const rays = 16;
    for (let i = 0; i <= rays * 2; i++) {
      const a = (i / (rays * 2)) * Math.PI * 2;
      const r = i % 2 ? 0.08 : 0.2;
      if (i === 0) s.moveTo(Math.sin(a) * r, Math.cos(a) * r);
      else s.lineTo(Math.sin(a) * r, Math.cos(a) * r);
    }
  }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: false });
}

function part(g: THREE.BufferGeometry, mat: THREE.Material, s: [number, number, number], p: [number, number, number] = [0, 0, 0], r: [number, number, number] = [0, 0, 0], tag = ""): THREE.Mesh {
  const m = new THREE.Mesh(g, mat);
  m.scale.set(...s);
  m.position.set(...p);
  m.rotation.set(...r);
  if (tag) m.userData.tag = tag;
  return m;
}

/**
 * Merge each joint's meshes so it draws once: every plain colour is baked
 * into vertex colours on one shared material, and only the materials that
 * change at run time — armour paint, glowing eyes — keep meshes of their own,
 * one per armour slot so each piece still shows or hides alone. A figure is
 * a hundred shapes; a phone wants a handful of draws.
 */
function consolidate(group: THREE.Object3D, base: THREE.MeshToonMaterial, special: Set<THREE.Material>): void {
  const buckets = new Map<string, THREE.Mesh[]>();
  for (const c of group.children) {
    if (!(c instanceof THREE.Mesh) || c.userData.keep) continue;
    const m = c.material as THREE.Material;
    const key = `${special.has(m) ? m.uuid : "base"}|${c.userData.tag ?? ""}`;
    const list = buckets.get(key) ?? [];
    list.push(c);
    buckets.set(key, list);
  }
  for (const [key, list] of buckets) {
    const plain = key.startsWith("base|");
    const geos = list.map((m) => {
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
      if (plain) {
        const c = (m.material as THREE.MeshToonMaterial).color;
        const n = g.attributes.position!.count;
        const colors = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
        g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      }
      return g.applyMatrix4(m.matrix);
    });
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    const first = list[0]!;
    const mesh = new THREE.Mesh(merged, plain ? base : first.material);
    mesh.userData.tag = first.userData.tag;
    for (const m of list) group.remove(m);
    group.add(mesh);
  }
  for (const c of group.children) if (!(c instanceof THREE.Mesh)) consolidate(c, base, special);
}

// ---------------------------------------------------------------------------
// The doll

export function buildFigure(b: Build): Figure {
  const mats: THREE.MeshToonMaterial[] = [];
  const mat = (color: number, emissive = 0, double = false): THREE.MeshToonMaterial => {
    const m = toon(color, { emissive });
    if (double) m.side = THREE.DoubleSide;
    mats.push(m);
    return m;
  };
  const bone = b.body === "bone";
  const k = b.bulk;
  const skin = mat(b.skin);
  const dark = mat(0x2a1a12);
  const sandal = mat(b.sandals);
  const metal = mat(KIT_PAINT.bronze.metal);
  const trim = mat(KIT_PAINT.bronze.trim);
  const crest = mat(KIT_PAINT.bronze.crest, 0, true);
  const leather = mat(0x6b4429);
  const cloth = b.tunic === null ? null : mat(b.tunic, 0, true);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // --- Legs, with a knee joint so the stride bends.
  const hips = 0.93;
  const hipL = new THREE.Group();
  const hipR = new THREE.Group();
  const kneeL = new THREE.Group();
  const kneeR = new THREE.Group();
  hipL.position.set(0.12 * k, hips, 0);
  hipR.position.set(-0.12 * k, hips, 0);
  for (const [hip, knee] of [
    [hipL, kneeL],
    [hipR, kneeR],
  ] as const) {
    knee.position.y = -0.43;
    if (bone) {
      hip.add(part(CYL, skin, [0.028, 0.4, 0.028], [0, -0.2, 0]));
      knee.add(part(SPHERE, skin, [0.05, 0.05, 0.05]));
      knee.add(part(CYL, skin, [0.024, 0.4, 0.024], [0, -0.2, 0]));
      knee.add(part(BOX, skin, [0.08, 0.04, 0.18], [0, -0.42, 0.04]));
    } else {
      hip.add(part(taper(0.43, 0.105 * k, 0.075 * k), skin, [1, 1, 1]));
      knee.add(part(taper(0.38, 0.072 * k, 0.05 * k), skin, [1, 1, 1]));
      // Sandal: sole, toe cap and the straps winding up the ankle.
      knee.add(part(SPHERE, sandal, [0.065 * k, 0.03, 0.13 * k], [0, -0.43, 0.04]));
      knee.add(part(SPHERE, skin, [0.055 * k, 0.04, 0.09 * k], [0, -0.41, 0.07]));
      for (let i = 0; i < 3; i++) {
        knee.add(part(TORUS, sandal, [0.058 * k, 0.058 * k, 0.6], [0, -0.38 + i * 0.07, 0], [Math.PI / 2, 0, 0]));
      }
    }
    hip.add(knee);
    body.add(hip);
  }

  // --- Torso: waist, chest, shoulders, turned on a lathe and flattened front to back.
  const torsoMat = bone ? skin : (cloth ?? skin);
  if (bone) {
    // Spine, ribs and pelvis.
    for (let i = 0; i < 7; i++) body.add(part(CYL, skin, [0.035, 0.05, 0.035], [0, 0.98 + i * 0.075, -0.04]));
    for (let i = 0; i < 4; i++) {
      const w = 0.17 - Math.abs(i - 1.2) * 0.02;
      body.add(part(TORUS, skin, [w, w * 0.8, 0.35], [0, 1.2 + i * 0.075, 0.0], [Math.PI / 2, 0, 0]));
    }
    body.add(part(TORUS, skin, [0.12, 0.08, 0.9], [0, 0.97, 0], [Math.PI / 2, 0, 0]));
    body.add(part(SPHERE, skin, [0.06, 0.06, 0.06], [0.2, 1.47, 0]));
    body.add(part(SPHERE, skin, [0.06, 0.06, 0.06], [-0.2, 1.47, 0]));
  } else {
    const torso = lathe(
      [
        [0.0, 0.88],
        [0.19, 0.9],
        [0.2, 1.0],
        [0.21, 1.12],
        [0.245, 1.3],
        [0.25, 1.42],
        [0.2, 1.52],
        [0.08, 1.58],
        [0.0, 1.6],
      ],
      18,
    );
    body.add(part(torso, torsoMat, [k, 1, 0.72 * k]));
    if (cloth) {
      body.add(part(pleats(0.21 * k, 0.3 * k, 0.4, 14), cloth, [1, 1, 0.82], [0, 0.82, 0]));
      // A belt with a bronze buckle, and the sash over one shoulder.
      body.add(part(TORUS, leather, [0.215 * k, 0.158 * k, 0.9], [0, 1.02, 0], [Math.PI / 2, 0, 0]));
      body.add(part(BOX, mat(0xd8a843), [0.06, 0.05, 0.02], [0, 1.02, 0.16 * k]));
      // Bare arms out of the chiton: shoulder skin where the cloth ends.
      body.add(part(SPHERE, skin, [0.07, 0.04, 0.06], [0, 1.53, 0.06]));
    }
    body.add(part(CYL, skin, [0.065, 0.12, 0.065], [0, 1.6, 0]));
  }

  // --- Head.
  const head = new THREE.Group();
  head.position.set(0, 1.64, 0);
  const hairline: THREE.Mesh[] = [];
  if (bone) {
    head.add(part(SPHERE, skin, [0.16, 0.17, 0.18], [0, 0.14, 0]));
    head.add(part(BOX, skin, [0.16, 0.06, 0.12], [0, 0.0, 0.05]));
  } else {
    head.add(part(SPHERE, skin, [0.165, 0.19, 0.18], [0, 0.13, 0]));
    head.add(part(SPHERE, skin, [0.12, 0.09, 0.12], [0, 0.03, 0.04]));
    head.add(part(SPHERE, skin, [0.025, 0.045, 0.03], [0, 0.11, 0.185], [-0.3, 0, 0]));
    head.add(part(SPHERE, skin, [0.03, 0.045, 0.02], [0.165, 0.12, 0.0]));
    head.add(part(SPHERE, skin, [0.03, 0.045, 0.02], [-0.165, 0.12, 0.0]));
    // Brows and mouth.
    head.add(part(BOX, dark, [0.06, 0.014, 0.02], [0.065, 0.2, 0.165], [0, 0, -0.12]));
    head.add(part(BOX, dark, [0.06, 0.014, 0.02], [-0.065, 0.2, 0.165], [0, 0, 0.12]));
    head.add(part(BOX, mat(0x8a3a2a), [0.05, 0.012, 0.01], [0, 0.04, 0.165]));
  }
  // Eyes: whites and irises for the living, embers for the dead and the god.
  const eyeMat = mat(b.eyes, b.eyeGlow ? b.eyes : 0);
  const glow = b.eyeGlow ? [{ mat: eyeMat, color: b.eyes }] : [];
  if (b.eyeGlow) {
    if (bone) {
      head.add(part(SPHERE, dark, [0.045, 0.05, 0.03], [0.06, 0.14, 0.15]));
      head.add(part(SPHERE, dark, [0.045, 0.05, 0.03], [-0.06, 0.14, 0.15]));
    }
    head.add(part(SPHERE, eyeMat, [0.026, 0.03, 0.015], [0.06, 0.14, 0.168]));
    head.add(part(SPHERE, eyeMat, [0.026, 0.03, 0.015], [-0.06, 0.14, 0.168]));
  } else {
    const white = mat(0xf8f4ec);
    head.add(part(SPHERE, white, [0.035, 0.032, 0.015], [0.062, 0.14, 0.163]));
    head.add(part(SPHERE, white, [0.035, 0.032, 0.015], [-0.062, 0.14, 0.163]));
    head.add(part(SPHERE, eyeMat, [0.02, 0.024, 0.01], [0.062, 0.14, 0.174]));
    head.add(part(SPHERE, eyeMat, [0.02, 0.024, 0.01], [-0.062, 0.14, 0.174]));
  }
  if (b.hair !== null) {
    const hairMat = mat(b.hair);
    if (b.hairStyle !== "bald") {
      const cap = part(HALF, hairMat, [0.178, 0.17, 0.19], [0, 0.17, -0.01], [-0.15, 0, 0], "hair");
      head.add(cap);
      hairline.push(cap);
      // A fringe of curls along the brow.
      for (let i = -2; i <= 2; i++) {
        const curl = part(SPHERE, hairMat, [0.045, 0.04, 0.04], [i * 0.055, 0.24, 0.13 - Math.abs(i) * 0.02], [0, 0, 0], "hair");
        head.add(curl);
        hairline.push(curl);
      }
      if (b.hairStyle === "long") head.add(part(SPHERE, hairMat, [0.17, 0.2, 0.1], [0, 0.03, -0.12]));
    } else {
      head.add(part(SPHERE, hairMat, [0.17, 0.1, 0.16], [0, 0.08, -0.06]));
    }
    if (b.beard !== null) {
      const beard = mat(b.beard);
      head.add(part(SPHERE, beard, [0.13, 0.12, 0.1], [0, -0.01, 0.1]));
      head.add(part(SPHERE, beard, [0.07, 0.03, 0.03], [0, 0.07, 0.175]));
    }
  }
  if (b.band !== null) {
    const band = part(TORUS, mat(b.band), [0.172, 0.182, 0.32], [0, 0.2, 0.0], [Math.PI / 2 - 0.2, 0, 0], "hair");
    head.add(band);
    hairline.push(band);
  }
  body.add(head);

  // --- Arms, with elbows. L is the figure's own left, which facing +z is +x.
  const shoulder = 1.48;
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  const elbowL = new THREE.Group();
  const elbowR = new THREE.Group();
  armL.position.set(0.27 * k, shoulder, 0);
  armR.position.set(-0.27 * k, shoulder, 0);
  for (const [arm, elbow] of [
    [armL, elbowL],
    [armR, elbowR],
  ] as const) {
    elbow.position.y = -0.3;
    if (bone) {
      arm.add(part(CYL, skin, [0.022, 0.28, 0.022], [0, -0.14, 0]));
      elbow.add(part(SPHERE, skin, [0.035, 0.035, 0.035]));
      elbow.add(part(CYL, skin, [0.02, 0.26, 0.02], [0, -0.13, 0]));
    } else {
      arm.add(part(taper(0.3, 0.08 * k, 0.062 * k), skin, [1, 1, 1]));
      elbow.add(part(taper(0.26, 0.06 * k, 0.045 * k), skin, [1, 1, 1]));
    }
    // A fist.
    elbow.add(part(SPHERE, skin, [0.055 * k, 0.065 * k, 0.06 * k], [0, -0.32, 0.01]));
    arm.add(elbow);
    body.add(arm);
  }

  // --- The weapon, in the right fist and pointing forward along the swing.
  const sword = new THREE.Group();
  sword.position.set(0, -0.32, 0.01);
  sword.rotation.x = Math.PI / 2;
  if (b.weapon === "sword") {
    const blade = part(xiphos(), mat(b.blade), [1, 1, 1], [0, 0.1, 0]);
    sword.add(blade);
    sword.add(part(BOX, mat(0xb88a2e), [0.18, 0.035, 0.05], [0, 0.09, 0]));
    sword.add(part(CYL, leather, [0.024, 0.15, 0.024], [0, 0.0, 0]));
    sword.add(part(SPHERE, mat(0xb88a2e), [0.035, 0.035, 0.035], [0, -0.09, 0]));
  } else if (b.weapon === "trident" || b.weapon === "bident") {
    // A long shaft held near the middle, a crossbar and barbed prongs: three for the sea, two for the dead.
    const metal = mat(b.blade);
    sword.add(part(CYL, mat(b.weapon === "bident" ? 0x1a1418 : 0x7a5232), [0.022, 1.9, 0.022], [0, 0.35, 0]));
    sword.add(part(BOX, metal, [0.34, 0.04, 0.04], [0, 1.3, 0]));
    for (const x of b.weapon === "bident" ? [-0.13, 0.13] : [-0.15, 0, 0.15]) {
      sword.add(part(CYL, metal, [0.018, x === 0 ? 0.42 : 0.32, 0.018], [x, x === 0 ? 1.51 : 1.46, 0]));
      sword.add(part(CONE, metal, [0.04, 0.12, 0.04], [x, x === 0 ? 1.77 : 1.67, 0]));
    }
  } else {
    sword.add(part(CYL, leather, [0.025, 0.45, 0.025], [0, 0.15, 0]));
    sword.add(part(BOX, mat(b.blade), [0.2, 0.1, 0.1], [0, 0.38, 0]));
  }
  elbowR.add(sword);

  // --- The aspis hangs off the body, not the arm, so it can swing round in front to block.
  let shield: THREE.Group | null = null;
  if (b.shield) {
    shield = new THREE.Group();
    const s = b.shield;
    const face = new THREE.Group();
    // Dished like the real thing: a shallow bowl with a broad, flat rim.
    const bowl = lathe(
      [
        [0, 0.07],
        [0.2, 0.06],
        [0.33, 0.03],
        [0.36, 0.0],
        [0.0001, -0.005],
      ],
      28,
    );
    bowl.rotateX(Math.PI / 2);
    face.add(part(bowl, mat(s.face), [1, 1, 1]));
    const rim = new THREE.TorusGeometry(0.38, 0.03, 8, 32);
    face.add(part(rim, mat(s.rim), [1, 1, 1], [0, 0, 0]));
    face.add(part(emblem(s.sign), mat(s.emblem), [1, 1, 1], [0, 0, 0.065]));
    shield.add(face);
    body.add(shield);
  }

  // --- A cape in two hinged panels, so it can billow.
  let cape: THREE.Group | null = null;
  if (b.cape !== null) {
    const capeMat = mat(b.cape, 0, true);
    cape = new THREE.Group();
    cape.position.set(0, 1.55, -0.17 * k);
    const upper = new THREE.BoxGeometry(0.5 * k, 0.55, 0.025, 4, 1, 1);
    upper.translate(0, -0.27, 0);
    cape.add(part(upper, capeMat, [1, 1, 1]));
    const lower = new THREE.Group();
    lower.position.y = -0.54;
    const lowerGeo = new THREE.BoxGeometry(0.56 * k, 0.6, 0.025, 4, 1, 1);
    lowerGeo.translate(0, -0.3, 0);
    lower.add(part(lowerGeo, capeMat, [1, 1, 1]));
    cape.add(lower);
    // Clasps at the shoulders.
    body.add(part(SPHERE, mat(0xd8a843), [0.04, 0.04, 0.02], [0.17 * k, 1.53, -0.12]));
    body.add(part(SPHERE, mat(0xd8a843), [0.04, 0.04, 0.02], [-0.17 * k, 1.53, -0.12]));
    body.add(cape);
  }

  // --- Armour, tagged by slot so each piece shows and hides on its own.
  const helmetBowl = lathe(
    [
      [0.0, 0.33],
      [0.08, 0.32],
      [0.16, 0.27],
      [0.2, 0.18],
      [0.205, 0.08],
      [0.2, -0.04],
      [0.19, -0.05],
    ],
    20,
  );
  // Corinthian: a bowl with a T of open face cut out — cheek guards hang either
  // side of the nose guard.
  head.add(part(helmetBowl, metal, [1, 1, 1.05], [0, 0.0, -0.01], [0, 0, 0], "helmet"));
  head.add(part(BOX, metal, [0.08, 0.17, 0.04], [0.085, 0.04, 0.17], [0, 0.25, 0], "helmet"));
  head.add(part(BOX, metal, [0.08, 0.17, 0.04], [-0.085, 0.04, 0.17], [0, -0.25, 0], "helmet"));
  head.add(part(BOX, metal, [0.03, 0.09, 0.03], [0, 0.12, 0.2], [0, 0, 0], "helmet"));
  head.add(part(TORUS, trim, [0.205, 0.215, 0.6], [0, 0.2, -0.01], [Math.PI / 2, 0, 0], "helmet"));
  // A horsehair crest sweeping from brow to nape.
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 0.95 - Math.PI * 0.05;
    head.add(
      part(BOX, crest, [0.055, 0.11, 0.07], [0, 0.24 + Math.sin(a) * 0.17, Math.cos(a) * 0.22], [-a + Math.PI / 2, 0, 0], "helmet"),
    );
  }
  head.add(part(CYL, trim, [0.02, 0.06, 0.02], [0, 0.35, 0], [0, 0, 0], "helmet"));

  // Muscled cuirass, a skirt of leather strips under it, and shoulder plates.
  if (!bone) {
    const cuirass = lathe(
      [
        [0.205, 0.96],
        [0.225, 1.1],
        [0.26, 1.3],
        [0.265, 1.42],
        [0.22, 1.52],
        [0.12, 1.57],
      ],
      18,
    );
    body.add(part(cuirass, metal, [k, 1, 0.76 * k], [0, 0, 0], [0, 0, 0], "chest"));
    body.add(part(TORUS, trim, [0.225 * k, 0.17 * k, 0.6], [0, 0.97, 0], [Math.PI / 2, 0, 0], "chest"));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      body.add(
        part(BOX, leather, [0.075, 0.2, 0.02], [Math.sin(a) * 0.215 * k, 0.86, Math.cos(a) * 0.17 * k], [0, a, 0], "chest"),
      );
    }
    for (const side of [1, -1]) {
      body.add(part(HALF, trim, [0.12 * k, 0.07, 0.13 * k], [side * 0.25 * k, 1.47, 0], [0, 0, -side * 0.5], "chest"));
    }
  }
  for (const elbow of [elbowL, elbowR]) {
    elbow.add(part(taper(0.16, 0.068 * k, 0.06 * k), metal, [1, 1, 1], [0, -0.06, 0], [0, 0, 0], "arms"));
  }
  for (const knee of [kneeL, kneeR]) {
    knee.add(part(taper(0.3, 0.082 * k, 0.062 * k), metal, [1, 1, 1], [0, -0.03, 0.006], [0, 0, 0], "legs"));
    knee.add(part(SPHERE, trim, [0.07 * k, 0.06, 0.06 * k], [0, 0.01, 0.04], [0, 0, 0], "legs"));
  }

  // The flash of a swing: an arc of white in front, shown only mid-slash.
  const slash = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 2.3, 32, 1, -0.2, Math.PI * 0.9),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  slash.rotation.x = -Math.PI / 2;
  slash.position.y = 1.2;
  slash.visible = false;
  slash.userData.keep = true;
  root.add(slash);

  // Everything plain draws through one vertex-coloured material; what changes at run time keeps its own.
  const base = toon(0xffffff);
  base.vertexColors = true;
  base.side = THREE.DoubleSide;
  const special = new Set<THREE.Material>([metal, trim, crest, ...glow.map((g) => g.mat)]);
  consolidate(root, base, special);
  const live = [base, ...mats.filter((m) => special.has(m))];

  const armor: Record<Slot, THREE.Mesh[]> = { helmet: [], chest: [], arms: [], legs: [] };
  const hair: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = o !== slash;
    const tag = o.userData.tag as string | undefined;
    if (tag === "helmet" || tag === "chest" || tag === "arms" || tag === "legs") armor[tag].push(o);
    if (tag === "hair") hair.push(o);
  });
  void hairline;

  const fig: Figure = {
    root,
    body,
    head,
    hipL,
    hipR,
    kneeL,
    kneeR,
    armL,
    armR,
    elbowL,
    elbowR,
    sword,
    shield,
    cape,
    slash,
    armor,
    hairline: hair,
    metal,
    trim,
    crest,
    mats: live,
    glow,
    walk: 0,
    kit: null,
  };
  wearKit(fig, { helmet: "none", chest: "none", arms: "none", legs: "none" });
  return fig;
}

export function wearKit(fig: Figure, armor: Record<Slot, Kit>): void {
  for (const slot of Object.keys(fig.armor) as Slot[]) {
    for (const m of fig.armor[slot]) m.visible = armor[slot] !== "none";
  }
  // A helmet over the hair, not through it.
  for (const m of fig.hairline) m.visible = armor.helmet === "none";
  // One paint for the whole figure: the god's if any piece is the god's.
  const kits = Object.values(armor);
  const kit: Kit = kits.includes("hades") ? "hades" : kits.includes("poseidon") ? "poseidon" : kits.includes("ares") ? "ares" : kits.includes("bronze") ? "bronze" : "none";
  if (kit !== "none") {
    const paint = KIT_PAINT[kit];
    fig.metal.color.setHex(paint.metal);
    fig.trim.color.setHex(paint.trim);
    fig.crest.color.setHex(paint.crest);
  }
  fig.kit = kit;
}

export interface Pose {
  /** Ground speed, which sets the stride. */
  speed: number;
  /** 0..1 through a swing, or -1. */
  swing: number;
  /** 0..1, how far the shield is up. */
  block: number;
  /** Seconds since falling, or -1. */
  fallen: number;
  /** 0..1, arms raised overhead. */
  raise: number;
  /** A sway for standing dizzy. */
  daze: number;
}

const REST: Pose = { speed: 0, swing: -1, block: 0, fallen: -1, raise: 0, daze: 0 };

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ease = (t: number): number => t * t * (3 - 2 * t);

export function poseFigure(fig: Figure, dt: number, p: Partial<Pose>): void {
  const pose = { ...REST, ...p };
  const stride = Math.min(1, pose.speed / 6);
  fig.walk += dt * (4 + pose.speed * 1.6);
  const phase = Math.sin(fig.walk);
  const swingLeg = phase * 0.7 * stride;
  fig.hipL.rotation.x = swingLeg;
  fig.hipR.rotation.x = -swingLeg;
  // The trailing leg's knee folds as it swings through.
  fig.kneeL.rotation.x = Math.max(0, Math.cos(fig.walk)) * 1.1 * stride + 0.05;
  fig.kneeR.rotation.x = Math.max(0, -Math.cos(fig.walk)) * 1.1 * stride + 0.05;
  const breathe = Math.sin(performance.now() / 600) * 0.008 * (1 - stride);
  fig.body.position.y = Math.abs(Math.cos(fig.walk)) * 0.06 * stride + breathe;
  fig.body.rotation.x = stride * 0.1;
  fig.head.rotation.x = -stride * 0.08;

  // Left arm swings opposite the right leg, unless it is holding the shield up.
  fig.armL.rotation.set(lerp(-swingLeg * 0.8, -1.25, pose.block), 0, lerp(0.1, -0.3, pose.block));
  fig.elbowL.rotation.x = lerp(-0.25 - stride * 0.3, -0.9, pose.block);
  let rx = swingLeg * 0.8;
  let rz = -0.1;
  let ex = -0.25 - stride * 0.3;
  let twist = 0;
  if (pose.swing >= 0) {
    // Up and back, then a hard slash across and down.
    const s = pose.swing;
    if (s < 0.38) {
      const t = ease(s / 0.38);
      rx = lerp(-0.3, -2.6, t);
      rz = lerp(-0.1, -0.6, t);
      ex = lerp(-0.3, -1.1, t);
      twist = lerp(0, 0.5, t);
    } else if (s < 0.62) {
      const t = ease((s - 0.38) / 0.24);
      rx = lerp(-2.6, -0.9, t);
      rz = lerp(-0.6, 0.9, t);
      ex = lerp(-1.1, -0.05, t);
      twist = lerp(0.5, -0.55, t);
    } else {
      const t = ease((s - 0.62) / 0.38);
      rx = lerp(-0.9, -0.3, t);
      rz = lerp(0.9, -0.1, t);
      ex = lerp(-0.05, -0.3, t);
      twist = lerp(-0.55, 0, t);
    }
  }
  if (pose.raise > 0) {
    rx = lerp(rx, -3.0, pose.raise);
    ex = lerp(ex, -0.2, pose.raise);
    fig.armL.rotation.x = lerp(fig.armL.rotation.x, -2.6, pose.raise);
  }
  fig.armR.rotation.set(rx, 0, rz);
  fig.elbowR.rotation.x = ex;
  fig.body.rotation.y = twist;

  // The slash flash: brightest at the moment the blade crosses.
  const slashMat = fig.slash.material as THREE.MeshBasicMaterial;
  if (pose.swing >= 0.36 && pose.swing < 0.75) {
    const t = (pose.swing - 0.36) / 0.39;
    fig.slash.visible = true;
    slashMat.opacity = 0.55 * (1 - t);
    fig.slash.rotation.z = lerp(0.9, -0.5, t);
  } else {
    fig.slash.visible = false;
  }

  if (fig.shield) {
    // Resting on the left side, or swung round in front of the chest.
    fig.shield.position.set(lerp(0.4, 0.1, pose.block), lerp(1.08, 1.28, pose.block), lerp(0.0, 0.46, pose.block));
    fig.shield.rotation.set(0, lerp(Math.PI / 2, 0, pose.block), 0);
  }
  if (fig.cape) {
    const flutter = Math.sin(performance.now() / 160) * 0.06 * (0.3 + stride);
    fig.cape.rotation.x = -0.06 - stride * 0.45 + flutter;
    const lower = fig.cape.children[1];
    if (lower) lower.rotation.x = -stride * 0.35 - flutter * 1.5;
  }

  fig.root.rotation.z = Math.sin(performance.now() / 180) * 0.08 * pose.daze;
  if (pose.fallen >= 0) {
    const t = Math.min(1, pose.fallen / 0.5);
    fig.body.rotation.x = lerp(0, -Math.PI / 2, ease(t));
    fig.body.position.y = lerp(0, 0.25, ease(t));
  }
}

/** A blow lands: the whole figure lights up for a moment. Zero puts it back. */
export function flash(fig: Figure, amount: number, color = 0xffffff): void {
  for (const m of fig.mats) {
    if (amount > 0) m.emissive.setHex(color).multiplyScalar(amount);
    else m.emissive.setHex(0);
  }
  if (amount <= 0) for (const g of fig.glow) g.mat.emissive.setHex(g.color);
}

export function fade(fig: Figure, opacity: number): void {
  for (const m of fig.mats) {
    m.transparent = opacity < 1;
    m.opacity = opacity;
  }
}
