import * as THREE from "three";

export interface FigurePalette {
  skin: number;
  shirt: number;
  legs: number;
  hair: number;
  gun?: number;
}

/**
 * A person, built out of seven boxes. Everything stands on `group.position`,
 * which is the body's feet, and the whole figure is modelled 1.7 blocks tall
 * then scaled to whatever the body actually is.
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
}

/** Where the stand-in gun hangs off the hand, in the arm's own space. */
const GRIP = { x: 0.24, y: -0.5, z: 0 };

const MODEL_HEIGHT = 1.7;

function box(
  width: number,
  height: number,
  depth: number,
  colour: number,
  materials: THREE.MeshLambertMaterial[],
): THREE.Mesh {
  const material = new THREE.MeshLambertMaterial({ color: colour });
  materials.push(material);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  return mesh;
}

export function buildFigure(palette: FigurePalette, height: number): Figure {
  const materials: THREE.MeshLambertMaterial[] = [];
  const group = new THREE.Group();
  const scale = height / MODEL_HEIGHT;
  group.scale.setScalar(scale);

  const legLeft = box(0.22, 0.62, 0.3, palette.legs, materials);
  const legRight = box(0.22, 0.62, 0.3, palette.legs, materials);
  // Hinged at the hip: the geometry hangs below its own origin so a rotation
  // swings the foot rather than pivoting about the knee.
  legLeft.geometry.translate(0, -0.31, 0);
  legRight.geometry.translate(0, -0.31, 0);
  legLeft.position.set(-0.14, 0.62, 0);
  legRight.position.set(0.14, 0.62, 0);

  const torso = box(0.56, 0.66, 0.36, palette.shirt, materials);
  torso.position.set(0, 0.95, 0);

  const head = box(0.46, 0.44, 0.44, palette.skin, materials);
  head.position.set(0, 1.5, 0);

  const hair = box(0.48, 0.12, 0.46, palette.hair, materials);
  hair.position.set(0, 1.68, 0);

  const armFront = new THREE.Group();
  armFront.position.set(0, 1.18, 0.22);
  const armFrontMesh = box(0.18, 0.52, 0.18, palette.shirt, materials);
  armFrontMesh.geometry.translate(0, -0.26, 0);
  armFront.add(armFrontMesh);

  const armBack = new THREE.Group();
  armBack.position.set(0, 1.18, -0.22);
  const armBackMesh = box(0.18, 0.52, 0.18, palette.shirt, materials);
  armBackMesh.geometry.translate(0, -0.26, 0);
  armBack.add(armBackMesh);

  let gun: THREE.Mesh | null = null;
  if (palette.gun !== undefined) {
    gun = box(0.62, 0.16, 0.16, palette.gun, materials);
    gun.geometry.translate(GRIP.x, GRIP.y, GRIP.z);
    armFront.add(gun);
  }

  group.add(legLeft, legRight, torso, head, hair, armFront, armBack);
  return { group, legLeft, legRight, armFront, armBack, torso, head, gun, materials };
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
