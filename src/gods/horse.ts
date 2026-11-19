import * as THREE from "three";
import { consolidate, type Figure } from "./figure";
import { toon } from "./toon";

/** A soldier's horse, turned from the same primitives as the doll, facing +z with its hooves on y = 0. */
export interface Horse {
  root: THREE.Group;
  /** Everything above the ground: what bobs at the gallop and tips over when the horse goes down. */
  body: THREE.Group;
  /** Shoulders, then hips: each holds a knee. */
  legs: Array<{ hip: THREE.Group; knee: THREE.Group; front: boolean; side: number }>;
  neck: THREE.Group;
  tail: THREE.Group;
  /** Where a rider's root goes, on top of the saddle. */
  seat: THREE.Group;
  mats: THREE.MeshToonMaterial[];
  stride: number;
}

export const COATS = [0x7a4a2a, 0xb8b2a8, 0x3a2c22, 0x9a6a3a, 0xe8e2d8];

const SPHERE = new THREE.SphereGeometry(1, 16, 12);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const TAPER = new THREE.CylinderGeometry(0.75, 1, 1, 10);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CONE = new THREE.ConeGeometry(1, 1, 6);

const HIP_Y = 1.04;
const SADDLE_Y = 1.8;

export function buildHorse(coat: number, cloth: number, trim: number): Horse {
  const mat = (color: number): THREE.MeshToonMaterial => toon(color);
  const hide = mat(coat);
  const muzzle = mat(new THREE.Color(coat).multiplyScalar(0.7).getHex());
  const dark = mat(0x1e1814);
  const hoof = mat(0x2a2420);
  const blanket = mat(cloth);
  const bronze = mat(trim);
  const leather = mat(0x4a2e1c);
  const add = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, s: [number, number, number], p: [number, number, number], r: [number, number, number] = [0, 0, 0]): THREE.Mesh => {
    const mesh = new THREE.Mesh(g, m);
    mesh.scale.set(...s);
    mesh.position.set(...p);
    mesh.rotation.set(...r);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Barrel, chest and rump.
  add(body, SPHERE, hide, [0.4, 0.42, 0.85], [0, 1.36, 0]);
  add(body, SPHERE, hide, [0.38, 0.44, 0.42], [0, 1.4, 0.55]);
  add(body, SPHERE, hide, [0.4, 0.44, 0.44], [0, 1.42, -0.58]);

  // The neck leans forward from the withers, and carries the head.
  const neck = new THREE.Group();
  neck.position.set(0, 1.55, 0.72);
  neck.rotation.x = 0.6;
  body.add(neck);
  add(neck, TAPER, hide, [0.17, 0.85, 0.24], [0, 0.38, 0]);
  add(neck, BOX, dark, [0.06, 0.8, 0.14], [0, 0.4, -0.18]);
  const head = new THREE.Group();
  head.position.set(0, 0.8, 0.02);
  head.rotation.x = 1.05;
  neck.add(head);
  add(head, TAPER, hide, [0.13, 0.6, 0.18], [0, 0.22, 0.02]);
  add(head, SPHERE, muzzle, [0.12, 0.08, 0.15], [0, 0.5, 0.03]);
  for (const side of [-1, 1]) {
    add(head, CONE, hide, [0.04, 0.14, 0.04], [side * 0.07, -0.02, -0.12], [-1.1, 0, side * 0.2]);
    add(head, SPHERE, dark, [0.025, 0.025, 0.025], [side * 0.12, 0.12, 0.08]);
  }
  // A bridle in the rider's leather.
  add(head, CYL, leather, [0.145, 0.03, 0.195], [0, 0.32, 0.02]);

  const tail = new THREE.Group();
  tail.position.set(0, 1.55, -0.98);
  tail.rotation.x = 0.35;
  body.add(tail);
  add(tail, TAPER, dark, [0.08, 0.8, 0.1], [0, -0.38, 0], [Math.PI, 0, 0]);

  // Saddle and the blanket under it, in the army's colours.
  add(body, BOX, blanket, [0.86, 0.05, 0.8], [0, 1.74, -0.02]);
  for (const side of [-1, 1]) {
    add(body, BOX, blanket, [0.04, 0.42, 0.8], [side * 0.42, 1.52, -0.02]);
    add(body, BOX, bronze, [0.045, 0.05, 0.82], [side * 0.43, 1.31, -0.02]);
  }
  add(body, BOX, leather, [0.4, 0.1, 0.5], [0, 1.8, -0.02]);

  const legs: Horse["legs"] = [];
  for (const front of [true, false]) {
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.22, HIP_Y + 0.25, front ? 0.62 : -0.62);
      body.add(hip);
      add(hip, TAPER, hide, [0.1, 0.62, 0.12], [0, -0.31, 0], [Math.PI, 0, 0]);
      const knee = new THREE.Group();
      knee.position.set(0, -0.62, 0);
      hip.add(knee);
      add(knee, CYL, hide, [0.055, 0.58, 0.055], [0, -0.29, 0]);
      add(knee, CYL, hoof, [0.075, 0.09, 0.08], [0, -0.62, 0.01]);
      legs.push({ hip, knee, front, side });
    }
  }

  const seat = new THREE.Group();
  seat.position.set(0, SADDLE_Y, -0.05);
  body.add(seat);

  // One draw per joint: the colours bake into a material of the horse's own, so a blow still lights only this horse.
  const base = toon(0xffffff);
  base.vertexColors = true;
  consolidate(root, base);
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { root, body, legs, neck, tail, seat, mats: [base], stride: 0 };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ease = (t: number): number => t * t * (3 - 2 * t);

/** A walk, a gallop past a trot, or lying on its side `fallen` seconds after going down. */
export function poseHorse(h: Horse, dt: number, speed: number, fallen = -1): void {
  const gait = Math.min(1, speed / 5);
  h.stride += dt * (3 + speed * 1.7);
  for (const l of h.legs) {
    // A gallop moves the front pair together and the back pair together, half a beat apart.
    const phase = h.stride + (l.front ? 0 : Math.PI * 0.6) + (l.side > 0 ? 0.35 * gait : 0);
    const swing = Math.sin(phase) * lerp(0.05, 0.75, gait);
    l.hip.rotation.x = l.front ? -swing : swing;
    // Each lower leg folds back as its hoof comes forward off the ground.
    l.knee.rotation.x = l.front ? Math.max(0, Math.cos(phase)) * 1.3 * gait : -Math.max(0, -Math.cos(phase)) * 0.9 * gait;
  }
  const now = performance.now();
  h.body.position.y = Math.abs(Math.sin(h.stride)) * 0.12 * gait + Math.sin(now / 700) * 0.01;
  h.body.rotation.x = Math.sin(h.stride * 2) * 0.04 * gait;
  h.neck.rotation.x = 0.6 + Math.sin(h.stride) * 0.12 * gait + (1 - gait) * Math.sin(now / 900) * 0.05;
  h.tail.rotation.x = 0.35 + gait * 0.6;
  h.tail.rotation.z = Math.sin(now / 400) * 0.25 * (1 - gait);
  h.body.rotation.z = 0;
  if (fallen >= 0) {
    const t = ease(Math.min(1, fallen / 0.6));
    h.body.rotation.z = lerp(0, Math.PI / 2 * 0.92, t);
    h.body.position.y = lerp(0, 0.3, t);
    for (const l of h.legs) l.hip.rotation.x = lerp(l.hip.rotation.x, l.front ? -0.3 : 0.3, t);
  }
}

/** Astride, after `poseFigure`: thighs forward and apart, knees bent down the horse's sides. */
export function seatRider(fig: Figure): void {
  fig.hipL.rotation.set(-1.25, 0, 0.55);
  fig.hipR.rotation.set(-1.25, 0, -0.55);
  fig.kneeL.rotation.x = 1.35;
  fig.kneeR.rotation.x = 1.35;
  fig.body.position.y = 0;
}

/** The rider's root sits so its hips rest on the saddle. */
export const RIDER_DROP = -0.93;

export function lightHorse(h: Horse, amount: number, color = 0xffffff): void {
  for (const m of h.mats) {
    if (amount > 0) m.emissive.setHex(color).multiplyScalar(amount);
    else m.emissive.setHex(0);
  }
}

export function fadeHorse(h: Horse, opacity: number): void {
  for (const m of h.mats) {
    m.transparent = opacity < 1;
    m.opacity = opacity;
  }
}
