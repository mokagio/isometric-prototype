import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * What a part is made of, rather than what colour it is: the geometry is
 * merged and baked once, and a figure is repainted by looking each vertex's
 * role up in a palette. That is what lets one pooled figure be a walker on one
 * frame and a runner on the next without being rebuilt.
 */
export const ROLES = { skin: 0, shirt: 1, legs: 2, hair: 3, dark: 4, eye: 5 } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export interface FigurePalette {
  skin: number;
  shirt: number;
  legs: number;
  hair: number;
  /** Boots, belt, gloves and the strap. */
  dark?: number;
  eye?: number;
  gun?: number;
}

/** Worn by everyone who has not said otherwise. */
export const DEFAULT_DARK = 0x24252b;
export const DEFAULT_EYE = 0xf1ece0;

/**
 * A person. Everything stands on `group.position`, which is the body's feet,
 * and the whole figure is modelled `MODEL_HEIGHT` tall then scaled to whatever
 * the body actually is.
 *
 * Six meshes, not one per box: each part that moves on its own — the two legs,
 * the two arms, the torso and the head — is a merged geometry carrying a
 * colour per vertex. Thirty zombies at eighteen boxes each would otherwise be
 * five hundred draw calls for a handful of people.
 */
export interface Figure {
  group: THREE.Group;
  legLeft: THREE.Mesh;
  legRight: THREE.Mesh;
  armFront: THREE.Object3D;
  armBack: THREE.Object3D;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  /** The stand-in gun, swapped out for the real model once it has loaded. */
  gun: THREE.Mesh | null;
  materials: THREE.MeshLambertMaterial[];
  /** Every merged part, with the role of each of its vertices. */
  parts: Part[];
}

interface Part {
  mesh: THREE.Mesh;
  roles: Uint8Array;
}

/** Where the stand-in gun hangs off the hand, in the arm's own space. */
const GRIP = { x: 0.24, y: -0.5, z: 0 };

export const MODEL_HEIGHT = 1.7;

/** One box of a part, positioned in that part's own space. */
interface Brick {
  size: [number, number, number];
  at: [number, number, number];
  role: Role;
}

/**
 * The figure, brick by brick, in the part's own space — the origin of a limb
 * is the joint it swings about, so a leg hangs below zero and an arm with it.
 */
const TORSO_BRICKS: Brick[] = [
  { size: [0.56, 0.42, 0.36], at: [0, 0.12, 0], role: ROLES.shirt }, // chest
  { size: [0.5, 0.16, 0.34], at: [0, -0.17, 0], role: ROLES.shirt }, // waist, tucked in
  { size: [0.54, 0.08, 0.37], at: [0, -0.29, 0], role: ROLES.dark }, // belt
  { size: [0.34, 0.06, 0.38], at: [0, 0.27, 0], role: ROLES.shirt }, // collar, clear of the jaw
  { size: [0.11, 0.5, 0.03], at: [-0.1, 0.08, 0.19], role: ROLES.dark }, // strap across the chest
];

const HEAD_BRICKS: Brick[] = [
  { size: [0.46, 0.44, 0.44], at: [0, 0, 0], role: ROLES.skin },
  { size: [0.06, 0.14, 0.12], at: [-0.25, -0.02, 0], role: ROLES.skin }, // ears, for the silhouette
  { size: [0.06, 0.14, 0.12], at: [0.25, -0.02, 0], role: ROLES.skin },
  { size: [0.48, 0.12, 0.46], at: [0, 0.18, 0], role: ROLES.hair }, // cap
  // Down the back, but only the top half of it: a figure walking away is the
  // back of its head, and hair all the way down leaves it with no head at all.
  { size: [0.48, 0.16, 0.1], at: [0, 0.07, -0.19], role: ROLES.hair },
  { size: [0.48, 0.07, 0.1], at: [0, 0.12, 0.19], role: ROLES.hair }, // fringe over the brow
  { size: [0.09, 0.09, 0.04], at: [-0.11, 0.0, 0.225], role: ROLES.eye },
  { size: [0.09, 0.09, 0.04], at: [0.11, 0.0, 0.225], role: ROLES.eye },
  { size: [0.13, 0.04, 0.03], at: [0, -0.15, 0.225], role: ROLES.dark }, // mouth
];

const LEG_BRICKS: Brick[] = [
  { size: [0.22, 0.5, 0.3], at: [0, -0.25, 0], role: ROLES.legs },
  { size: [0.26, 0.12, 0.34], at: [0, -0.56, 0.02], role: ROLES.dark }, // boot, toe forward
];

const ARM_BRICKS: Brick[] = [
  { size: [0.18, 0.26, 0.18], at: [0, -0.13, 0], role: ROLES.shirt }, // sleeve
  { size: [0.16, 0.18, 0.16], at: [0, -0.35, 0], role: ROLES.skin }, // forearm
  { size: [0.18, 0.1, 0.18], at: [0, -0.49, 0], role: ROLES.dark }, // glove
];

/** Merges the bricks into one geometry, remembering what each vertex is made of. */
function buildPart(
  bricks: Brick[],
  palette: FigurePalette,
  materials: THREE.MeshLambertMaterial[],
): Part {
  const geometries: THREE.BufferGeometry[] = [];
  const roles: number[] = [];
  for (const brick of bricks) {
    const geometry = new THREE.BoxGeometry(...brick.size);
    geometry.translate(...brick.at);
    geometries.push(geometry);
    for (let i = 0; i < geometry.getAttribute("position").count; i++) roles.push(brick.role);
  }
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) throw new Error("a figure's bricks would not merge");

  // White, so the vertex colours come through as they were written.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  materials.push(material);
  const part: Part = { mesh: new THREE.Mesh(merged, material), roles: Uint8Array.from(roles) };
  merged.setAttribute("color", new THREE.Float32BufferAttribute(roles.length * 3, 3));
  paintPart(part, palette);
  return part;
}

const scratch = new THREE.Color();

function paintPart(part: Part, palette: FigurePalette): void {
  const hexes = hexPerRole(palette);
  const colour = part.mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
  for (let i = 0; i < part.roles.length; i++) {
    // setHex reads sRGB and holds linear, which is what a colour attribute wants.
    scratch.setHex(hexes[part.roles[i]!]!);
    colour.setXYZ(i, scratch.r, scratch.g, scratch.b);
  }
  colour.needsUpdate = true;
}

/** The palette flattened into role order, so painting is a lookup per vertex. */
function hexPerRole(palette: FigurePalette): number[] {
  const hexes: number[] = [];
  hexes[ROLES.skin] = palette.skin;
  hexes[ROLES.shirt] = palette.shirt;
  hexes[ROLES.legs] = palette.legs;
  hexes[ROLES.hair] = palette.hair;
  hexes[ROLES.dark] = palette.dark ?? DEFAULT_DARK;
  hexes[ROLES.eye] = palette.eye ?? DEFAULT_EYE;
  return hexes;
}

/** Repaints a figure in place, which is how a pooled body changes breed. */
export function paintFigure(figure: Figure, palette: FigurePalette): void {
  for (const part of figure.parts) paintPart(part, palette);
}

export function buildFigure(palette: FigurePalette, height: number): Figure {
  const materials: THREE.MeshLambertMaterial[] = [];
  const parts: Part[] = [];
  const group = new THREE.Group();
  group.scale.setScalar(height / MODEL_HEIGHT);

  const part = (bricks: Brick[]): THREE.Mesh => {
    const built = buildPart(bricks, palette, materials);
    parts.push(built);
    return built.mesh;
  };

  // Hinged at the hip: the bricks hang below their own origin so a rotation
  // swings the foot rather than pivoting about the knee.
  const legLeft = part(LEG_BRICKS);
  const legRight = part(LEG_BRICKS);
  legLeft.position.set(-0.14, 0.62, 0);
  legRight.position.set(0.14, 0.62, 0);

  const torso = part(TORSO_BRICKS);
  torso.position.set(0, 0.95, 0);

  const head = part(HEAD_BRICKS);
  head.position.set(0, 1.5, 0);

  const armFront = new THREE.Group();
  armFront.position.set(0, 1.18, 0.22);
  armFront.add(part(ARM_BRICKS));

  const armBack = new THREE.Group();
  armBack.position.set(0, 1.18, -0.22);
  armBack.add(part(ARM_BRICKS));

  let gun: THREE.Mesh | null = null;
  if (palette.gun !== undefined) {
    const material = new THREE.MeshLambertMaterial({ color: palette.gun });
    materials.push(material);
    const geometry = new THREE.BoxGeometry(0.62, 0.16, 0.16);
    geometry.translate(GRIP.x, GRIP.y, GRIP.z);
    gun = new THREE.Mesh(geometry, material);
    armFront.add(gun);
  }

  group.add(legLeft, legRight, torso, head, armFront, armBack);
  return { group, legLeft, legRight, armFront, armBack, torso, head, gun, materials, parts };
}

/** Swings the legs, and the free arm with them. */
export function animateWalk(figure: Figure, phase: number, airborne: boolean): void {
  const swing = airborne ? 0.5 : Math.sin(phase * Math.PI * 2) * 0.7;
  figure.legLeft.rotation.x = swing;
  figure.legRight.rotation.x = -swing;
  figure.armBack.rotation.x = -swing * 0.6;
}

export function tintFigure(figure: Figure, colour: number, amount: number): void {
  for (const material of figure.materials) {
    material.emissive.setHex(colour);
    material.emissiveIntensity = amount;
  }
}

export function disposeFigure(figure: Figure): void {
  figure.group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
  for (const material of figure.materials) material.dispose();
}
