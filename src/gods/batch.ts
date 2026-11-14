import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { toon } from "./toon";

/** Map tiles, in metres: what is off screen or outside the sun's shadow box is skipped a tile at a time. */
const TILE = 60;

/**
 * Scenery that never moves, merged into one vertex-coloured mesh per map
 * tile. A colosseum is hundreds of shapes in dozens of colours, and a phone
 * draws a few big meshes far faster than hundreds of small ones.
 */
export class Batch {
  private parts = new Map<string, THREE.BufferGeometry[]>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly c = new THREE.Color();
  private frame: THREE.Matrix4 | null = null;
  private readonly w = new THREE.Vector3();

  /** Draw what follows as if `(x, z)` were the origin and +z pointed along `yaw`; no arguments goes back to world space. */
  setFrame(x?: number, z?: number, yaw = 0): void {
    this.frame = x === undefined || z === undefined ? null : new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
  }

  add(
    geometry: THREE.BufferGeometry,
    color: number,
    at: { x: number; y: number; z: number },
    rot: { x?: number; y?: number; z?: number } = {},
    scale: number | { x: number; y: number; z: number } = 1,
  ): void {
    // Merging needs every piece to carry the same attributes, so strip to
    // position and normal, unindexed, and paint the colour on.
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    this.c.setHex(color);
    const n = g.attributes.position!.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([this.c.r, this.c.g, this.c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    this.e.set(rot.x ?? 0, rot.y ?? 0, rot.z ?? 0);
    this.q.setFromEuler(this.e);
    if (typeof scale === "number") this.s.set(scale, scale, scale);
    else this.s.set(scale.x, scale.y, scale.z);
    this.p.set(at.x, at.y, at.z);
    this.m.compose(this.p, this.q, this.s);
    g = g.applyMatrix4(this.m);
    this.w.set(at.x, at.y, at.z);
    if (this.frame) {
      g = g.applyMatrix4(this.frame);
      this.w.applyMatrix4(this.frame);
    }
    const key = `${Math.floor(this.w.x / TILE)}|${Math.floor(this.w.z / TILE)}`;
    const list = this.parts.get(key) ?? [];
    list.push(g);
    this.parts.set(key, list);
  }

  build(opts: { fog?: boolean; shadows?: boolean } = {}): THREE.Group {
    const material = toon(0xffffff);
    material.vertexColors = true;
    material.fog = opts.fog ?? true;
    const group = new THREE.Group();
    for (const list of this.parts.values()) {
      const merged = mergeGeometries(list);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.matrixAutoUpdate = false;
      mesh.castShadow = opts.shadows ?? true;
      mesh.receiveShadow = opts.shadows ?? true;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
    this.parts.clear();
    return group;
  }
}
