import * as THREE from "three";
import type { Kit, Slot } from "./armor";
import { toon } from "./toon";

/**
 * Every person in the game is the same doll — hero, skeleton, soldier, god —
 * built from capsules and boxes facing +z, with pivots at the hips and
 * shoulders so it can walk and swing. What differs is the paint and the build.
 */
export interface Build {
  skin: number;
  hair: number | null;
  tunic: number | null;
  boots: number;
  eyes: number;
  /** Glowing eyes, for the dead and the divine. */
  eyeGlow: boolean;
  limb: number;
  torso: number;
  shield: { rim: number; face: number; boss: number } | null;
  blade: number;
  cape: number | null;
}

export const HERO_BUILD: Build = {
  skin: 0xf1c27d,
  hair: 0x6b3e1f,
  tunic: 0x2f6fb5,
  boots: 0x5a3a22,
  eyes: 0x1b1b2a,
  eyeGlow: false,
  limb: 0.095,
  torso: 0.26,
  shield: { rim: 0x9c6b2f, face: 0xcfd8e3, boss: 0x2f6fb5 },
  blade: 0xdfe8f0,
  cape: null,
};

export const SKELETON_BUILD: Build = {
  skin: 0xe9e1c9,
  hair: null,
  tunic: null,
  boots: 0xe9e1c9,
  eyes: 0xff4a2a,
  eyeGlow: true,
  limb: 0.055,
  torso: 0.17,
  shield: null,
  blade: 0x8f7a63,
  cape: null,
};

export const SPARTAN_BUILD: Build = {
  skin: 0xd9a066,
  hair: 0x2b1d14,
  tunic: 0xa3241e,
  boots: 0x5a3a22,
  eyes: 0x1b1b2a,
  eyeGlow: false,
  limb: 0.095,
  torso: 0.26,
  shield: { rim: 0xc8913a, face: 0xc8913a, boss: 0xa3241e },
  blade: 0xd0d6dc,
  cape: 0xa3241e,
};

export const ARES_BUILD: Build = {
  skin: 0xb8784a,
  hair: 0x1a0d08,
  tunic: 0x3a0d0d,
  boots: 0x2a1410,
  eyes: 0xff3a1a,
  eyeGlow: true,
  limb: 0.11,
  torso: 0.3,
  shield: { rim: 0xe2b23c, face: 0x7d1612, boss: 0xe2b23c },
  blade: 0xc9ced6,
  cape: 0x7d1612,
};

export const SMITH_BUILD: Build = {
  skin: 0xc68a5a,
  hair: 0x3a2a1e,
  tunic: 0x6b4a2e,
  boots: 0x3f2a1a,
  eyes: 0x1b1b2a,
  eyeGlow: false,
  limb: 0.11,
  torso: 0.3,
  shield: null,
  blade: 0x55585e,
  cape: null,
};

/** The paint for each kit: the metal, its trim, and the crest. */
export const KIT_PAINT: Record<Exclude<Kit, "none">, { metal: number; trim: number; crest: number }> = {
  bronze: { metal: 0xc8913a, trim: 0x8a5a22, crest: 0x2f6fb5 },
  ares: { metal: 0x8e1b16, trim: 0xe8b83e, crest: 0x1a0a08 },
};

export interface Figure {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  sword: THREE.Group;
  shield: THREE.Group | null;
  cape: THREE.Mesh | null;
  slash: THREE.Mesh;
  /** The armour pieces per slot, and which materials paint them. */
  armor: Record<Slot, THREE.Mesh[]>;
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

const geo = {
  capsule: new THREE.CapsuleGeometry(1, 1, 4, 10),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  half: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cone: new THREE.CylinderGeometry(0.75, 1, 1, 14),
  disc: new THREE.CylinderGeometry(1, 1, 1, 20),
};

function part(g: THREE.BufferGeometry, mat: THREE.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(g, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

/** A capsule of radius `r` and straight length `len`, hanging down from its pivot. */
function limb(mat: THREE.Material, r: number, len: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
  m.position.y = -len / 2 - r * 0.3;
  return m;
}

export function buildFigure(b: Build): Figure {
  const mats: THREE.MeshToonMaterial[] = [];
  const mat = (color: number, emissive = 0): THREE.MeshToonMaterial => {
    const m = toon(color, { emissive });
    mats.push(m);
    return m;
  };
  const skin = mat(b.skin);
  const boots = mat(b.boots);
  const metal = mat(KIT_PAINT.bronze.metal);
  const trim = mat(KIT_PAINT.bronze.trim);
  const crest = mat(KIT_PAINT.bronze.crest);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Legs
  const hips = 0.92;
  const hipL = new THREE.Group();
  const hipR = new THREE.Group();
  hipL.position.set(0.15, hips, 0);
  hipR.position.set(-0.15, hips, 0);
  for (const hip of [hipL, hipR]) {
    hip.add(limb(skin, b.limb * 1.1, 0.62));
    hip.add(part(geo.box, boots, b.limb * 2.6, 0.16, b.limb * 3.6, 0, -0.84, 0.05));
    body.add(hip);
  }

  // Torso, and the skirt of the tunic over the hips
  const torsoMat = b.tunic === null ? skin : mat(b.tunic);
  body.add(part(geo.capsule, torsoMat, b.torso, 0.22, b.torso * 0.8, 0, 1.3, 0));
  if (b.tunic !== null) {
    body.add(part(geo.cone, torsoMat, b.torso * 1.2, 0.36, b.torso * 1.05, 0, 0.98, 0));
    body.add(part(geo.cyl, mat(0x4a3020), b.torso * 1.08, 0.07, b.torso * 0.9, 0, 1.12, 0));
  } else {
    // Ribs and a pelvis, since a skeleton has no tunic to hide them.
    for (let i = 0; i < 3; i++) body.add(part(geo.box, skin, b.torso * 2.6, 0.035, b.torso * 1.6, 0, 1.22 + i * 0.1, 0.02));
    body.add(part(geo.box, skin, 0.32, 0.1, 0.16, 0, 0.98, 0));
  }

  // Head
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0);
  head.add(part(geo.sphere, skin, 0.2, 0.21, 0.2, 0, 0.12, 0));
  if (b.hair !== null) head.add(part(geo.half, mat(b.hair), 0.215, 0.2, 0.215, 0, 0.15, -0.02));
  const eyeMat = mat(b.eyes, b.eyeGlow ? b.eyes : 0);
  const glow = b.eyeGlow ? [{ mat: eyeMat, color: b.eyes }] : [];
  head.add(part(geo.sphere, eyeMat, 0.035, 0.045, 0.02, 0.075, 0.13, 0.185));
  head.add(part(geo.sphere, eyeMat, 0.035, 0.045, 0.02, -0.075, 0.13, 0.185));
  body.add(head);

  // Arms: L is the figure's own left, which facing +z is +x.
  const shoulder = 1.47;
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(b.torso + 0.08, shoulder, 0);
  armR.position.set(-(b.torso + 0.08), shoulder, 0);
  for (const arm of [armL, armR]) {
    arm.add(limb(skin, b.limb, 0.48));
    arm.add(part(geo.sphere, skin, b.limb * 1.25, b.limb * 1.25, b.limb * 1.25, 0, -0.66, 0));
    body.add(arm);
  }

  // Sword in the right hand, pointing forward along the forearm's swing.
  const sword = new THREE.Group();
  sword.position.set(0, -0.66, 0);
  sword.rotation.x = Math.PI / 2;
  const bladeMat = mat(b.blade);
  sword.add(part(geo.box, bladeMat, 0.07, 0.82, 0.022, 0, 0.55, 0));
  sword.add(part(geo.box, mat(0x8a6a2a), 0.26, 0.05, 0.06, 0, 0.13, 0));
  sword.add(part(geo.cyl, mat(0x4a3020), 0.03, 0.18, 0.03, 0, 0.03, 0));
  armR.add(sword);

  // The shield hangs off the body, not the arm, so it can swing round to the front to block.
  let shield: THREE.Group | null = null;
  if (b.shield) {
    shield = new THREE.Group();
    const s = b.shield;
    const face = new THREE.Group();
    face.rotation.x = Math.PI / 2; // cylinder axis to +z: the face looks forward
    face.add(part(geo.disc, mat(s.rim), 0.4, 0.05, 0.4));
    face.add(part(geo.disc, mat(s.face), 0.33, 0.06, 0.33));
    face.add(part(geo.sphere, mat(s.boss), 0.09, 0.06, 0.09, 0, 0.04, 0));
    shield.add(face);
    body.add(shield);
  }

  let cape: THREE.Mesh | null = null;
  if (b.cape !== null) {
    const g = new THREE.BoxGeometry(0.58, 1.05, 0.04);
    g.translate(0, -0.52, 0); // hang from the top edge
    cape = new THREE.Mesh(g, mat(b.cape));
    cape.position.set(0, 1.55, -0.2);
    body.add(cape);
  }

  // Armour: hidden until a kit is put on.
  const armor: Record<Slot, THREE.Mesh[]> = { helmet: [], chest: [], arms: [], legs: [] };
  const helm = [
    part(geo.half, metal, 0.235, 0.24, 0.235, 0, 0.14, 0),
    part(geo.box, metal, 0.05, 0.16, 0.12, 0.2, 0.06, 0.08),
    part(geo.box, metal, 0.05, 0.16, 0.12, -0.2, 0.06, 0.08),
    part(geo.box, crest, 0.07, 0.16, 0.42, 0, 0.42, -0.02),
    part(geo.box, trim, 0.25, 0.04, 0.05, 0, 0.17, 0.215),
  ];
  for (const m of helm) head.add(m);
  armor.helmet.push(...helm);
  const chest = [
    part(geo.capsule, metal, b.torso + 0.035, 0.2, b.torso * 0.8 + 0.035, 0, 1.33, 0),
    part(geo.sphere, trim, 0.13, 0.09, 0.13, b.torso + 0.06, 1.5, 0),
    part(geo.sphere, trim, 0.13, 0.09, 0.13, -(b.torso + 0.06), 1.5, 0),
  ];
  for (const m of chest) body.add(m);
  armor.chest.push(...chest);
  for (const arm of [armL, armR]) {
    const bracer = part(geo.cyl, metal, b.limb * 1.35, 0.22, b.limb * 1.35, 0, -0.46, 0);
    arm.add(bracer);
    armor.arms.push(bracer);
  }
  for (const hip of [hipL, hipR]) {
    const greave = part(geo.cyl, metal, b.limb * 1.5, 0.3, b.limb * 1.5, 0, -0.55, 0.02);
    const knee = part(geo.sphere, trim, b.limb * 1.4, b.limb * 1.1, b.limb * 1.2, 0, -0.38, 0.05);
    hip.add(greave, knee);
    armor.legs.push(greave, knee);
  }

  // The flash of a swing: an arc of white in front, shown only mid-slash.
  const slashGeo = new THREE.RingGeometry(1.0, 2.3, 24, 1, -0.2, Math.PI * 0.9);
  const slash = new THREE.Mesh(
    slashGeo,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  slash.rotation.x = -Math.PI / 2;
  slash.position.y = 1.2;
  slash.visible = false;
  root.add(slash);

  const fig: Figure = {
    root,
    body,
    head,
    hipL,
    hipR,
    armL,
    armR,
    sword,
    shield,
    cape,
    slash,
    armor,
    metal,
    trim,
    crest,
    mats,
    glow,
    walk: 0,
    kit: null,
  };
  wearKit(fig, { helmet: "none", chest: "none", arms: "none", legs: "none" });
  return fig;
}

export function wearKit(fig: Figure, armor: Record<Slot, Kit>): void {
  for (const slot of Object.keys(fig.armor) as Slot[]) {
    const kit = armor[slot];
    for (const m of fig.armor[slot]) m.visible = kit !== "none";
  }
  // One paint for the whole figure: the god's if any piece is the god's.
  const kits = Object.values(armor);
  const kit: Kit = kits.includes("ares") ? "ares" : kits.includes("bronze") ? "bronze" : "none";
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
  const swingLeg = Math.sin(fig.walk) * 0.75 * stride;
  fig.hipL.rotation.x = swingLeg;
  fig.hipR.rotation.x = -swingLeg;
  fig.body.position.y = Math.abs(Math.cos(fig.walk)) * 0.07 * stride;
  fig.body.rotation.x = stride * 0.12;

  // Left arm swings opposite the right leg, unless it is holding the shield up.
  fig.armL.rotation.set(lerp(-swingLeg * 0.8, -1.35, pose.block), 0, lerp(0.12, -0.35, pose.block));
  let rx = swingLeg * 0.8;
  let rz = -0.12;
  let twist = 0;
  if (pose.swing >= 0) {
    // Up and back, then a hard slash across and down.
    const s = pose.swing;
    if (s < 0.38) {
      const k = ease(s / 0.38);
      rx = lerp(-0.3, -2.7, k);
      rz = lerp(-0.12, -0.6, k);
      twist = lerp(0, 0.5, k);
    } else if (s < 0.62) {
      const k = ease((s - 0.38) / 0.24);
      rx = lerp(-2.7, -0.9, k);
      rz = lerp(-0.6, 0.9, k);
      twist = lerp(0.5, -0.55, k);
    } else {
      const k = ease((s - 0.62) / 0.38);
      rx = lerp(-0.9, -0.3, k);
      rz = lerp(0.9, -0.12, k);
      twist = lerp(-0.55, 0, k);
    }
  }
  if (pose.raise > 0) {
    rx = lerp(rx, -3.0, pose.raise);
    fig.armL.rotation.x = lerp(fig.armL.rotation.x, -2.6, pose.raise);
  }
  fig.armR.rotation.set(rx, 0, rz);
  fig.body.rotation.y = twist;

  // The slash flash: brightest at the moment the blade crosses.
  const slashMat = fig.slash.material as THREE.MeshBasicMaterial;
  if (pose.swing >= 0.36 && pose.swing < 0.75) {
    const k = (pose.swing - 0.36) / 0.39;
    fig.slash.visible = true;
    slashMat.opacity = 0.55 * (1 - k);
    fig.slash.rotation.z = lerp(0.9, -0.5, k);
  } else {
    fig.slash.visible = false;
  }

  if (fig.shield) {
    // Resting on the left side, or swung round in front of the chest.
    fig.shield.position.set(lerp(0.42, 0.12, pose.block), lerp(1.05, 1.28, pose.block), lerp(0.02, 0.48, pose.block));
    fig.shield.rotation.set(0, lerp(Math.PI / 2, 0, pose.block), 0);
  }
  if (fig.cape) fig.cape.rotation.x = -0.08 - stride * 0.55 - Math.sin(fig.walk * 2) * 0.05 * stride;

  fig.root.rotation.z = Math.sin(performance.now() / 180) * 0.08 * pose.daze;
  if (pose.fallen >= 0) {
    const k = Math.min(1, pose.fallen / 0.5);
    fig.body.rotation.x = lerp(0, -Math.PI / 2, ease(k));
    fig.body.position.y = lerp(0, 0.25, ease(k));
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
