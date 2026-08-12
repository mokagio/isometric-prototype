import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import paletteUrl from "./assets/guns/rifle_A.png?url";
import rifleUrl from "./assets/guns/rifle_A.obj?url";

/**
 * The model is 3.2 voxels long. This is what one of those voxels is worth in
 * world blocks, which puts the rifle at just under a block — a shade bigger
 * than life, the way a held weapon is drawn in a side-scroller.
 */
export const RIFLE_SCALE = 0.3;
/**
 * MagicaVoxel exports a gun two voxels thick, which all but disappears at
 * this camera. Fattening it along z alone costs nothing from the front and
 * gives it the heft of the arm holding it.
 */
export const RIFLE_DEPTH = 4;

/** Centre of the model's own bounding box, so it can be hung off the hand. */
const MODEL_CENTRE = new THREE.Vector3(0.1, 1.8, 0);

/**
 * Where the rifle sits inside the arm, and how far it has to be turned back.
 *
 * The arm hangs along its own -y and is swung to the aim, so a child of it
 * inherits that swing: the model's barrel runs along +x, which a quarter turn
 * would leave pointing over the shoulder. Undoing exactly that quarter turn
 * leaves the barrel on the aim, whatever the aim is.
 */
export const RIFLE_MOUNT = { x: 0, y: -0.6, z: 0 };
export const RIFLE_SPIN = -Math.PI / 2;

let pending: Promise<THREE.Mesh> | null = null;

/**
 * Loads the rifle once and hands out clones. The palette is a 256x1 strip
 * with one texel per colour, so it has to be sampled nearest — filtered, every
 * voxel takes on a blend of its neighbours in the palette rather than its
 * own colour.
 */
export function loadRifle(): Promise<THREE.Mesh> {
  pending ??= build();
  return pending;
}

async function build(): Promise<THREE.Mesh> {
  const palette = await new THREE.TextureLoader().loadAsync(paletteUrl);
  palette.magFilter = THREE.NearestFilter;
  palette.minFilter = THREE.NearestFilter;
  palette.generateMipmaps = false;
  palette.colorSpace = THREE.SRGBColorSpace;

  const group = await new OBJLoader().loadAsync(rifleUrl);
  const source = group.children.find((child) => child instanceof THREE.Mesh);
  if (!(source instanceof THREE.Mesh)) throw new Error("the rifle has no mesh in it");

  const geometry = source.geometry.clone();
  geometry.translate(-MODEL_CENTRE.x, -MODEL_CENTRE.y, -MODEL_CENTRE.z);
  geometry.scale(RIFLE_SCALE, RIFLE_SCALE, RIFLE_SCALE * RIFLE_DEPTH);
  geometry.computeVertexNormals();

  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map: palette }));
}
