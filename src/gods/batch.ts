import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { toonShared } from "./toon";

/**
 * Scenery that never moves, merged into one mesh per colour. A colosseum is
 * hundreds of boxes, and a phone draws one big mesh far faster than hundreds
 * of small ones.
 */
export class Batch {
  private parts = new Map<number, THREE.BufferGeometry[]>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();

  add(
    geometry: THREE.BufferGeometry,
    color: number,
    at: { x: number; y: number; z: number },
    rot: { x?: number; y?: number; z?: number } = {},
    scale: number | { x: number; y: number; z: number } = 1,
  ): void {
    // Merging needs every piece to carry the same attributes, so strip to
    // position and normal, unindexed.
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    this.e.set(rot.x ?? 0, rot.y ?? 0, rot.z ?? 0);
    this.q.setFromEuler(this.e);
    if (typeof scale === "number") this.s.set(scale, scale, scale);
    else this.s.set(scale.x, scale.y, scale.z);
    this.p.set(at.x, at.y, at.z);
    this.m.compose(this.p, this.q, this.s);
    g = g.applyMatrix4(this.m);
    const list = this.parts.get(color) ?? [];
    list.push(g);
    this.parts.set(color, list);
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    for (const [color, list] of this.parts) {
      const merged = mergeGeometries(list);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, toonShared(color));
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      for (const g of list) g.dispose();
    }
    this.parts.clear();
    return group;
  }
}
