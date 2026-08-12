import * as THREE from "three";
import { AIR, specOf } from "./blocks";
import { buildAtlas, tileUv } from "./textures";
import type { World } from "./world";

/** Columns rebuilt together when a block inside them changes. */
export const CHUNK_WIDTH = 32;

/**
 * How much light each face keeps. The camera is a few degrees off dead-on, so
 * tops and one side are always in view: giving them fixed levels rather than
 * leaving it to the lamp is what makes every block read as a box.
 */
export const FACE_SHADE = { front: 1, top: 1.16, side: 0.74, bottom: 0.5 };

/**
 * Corner shading, darkest first. A cell walled in on both sides of a corner is
 * fully occluded; one open side is brighter, and a free corner brightest.
 */
export const CORNER_SHADE = [0.62, 0.76, 0.89, 1];

/** How far behind the playable slab the room walls sit. */
const BACK_Z = -1;
/** What is left of a back wall's colour, so a room reads as unlit depth. */
const BACK_SHADE = 0.42;

export interface City {
  group: THREE.Group;
  /** Rebuilds whatever chunks the world says have changed. */
  update(world: World): void;
  dispose(): void;
}

interface Chunk {
  solid: THREE.Mesh;
  glow: THREE.Mesh;
}

export function buildCity(world: World): City {
  const atlas = buildAtlas();
  const solidMaterial = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
  // Blocks that are their own light source: no lamp, no shading, just the tile.
  const glowMaterial = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true });

  const group = new THREE.Group();
  const chunkCount = Math.ceil(world.width / CHUNK_WIDTH);
  const chunks: Chunk[] = [];

  for (let index = 0; index < chunkCount; index++) {
    const solid = new THREE.Mesh(new THREE.BufferGeometry(), solidMaterial);
    const glow = new THREE.Mesh(new THREE.BufferGeometry(), glowMaterial);
    solid.frustumCulled = false;
    glow.frustumCulled = false;
    chunks.push({ solid, glow });
    group.add(solid, glow);
    rebuild(world, chunks, index);
  }
  world.dirty.length = 0;

  return {
    group,
    update(changed) {
      if (changed.dirty.length === 0) return;
      const stale = new Set<number>();
      for (const cell of changed.dirty) {
        const x = cell % changed.width;
        stale.add(Math.floor(x / CHUNK_WIDTH));
        // A block on a seam changes the corner shading of the cell next door.
        if (x % CHUNK_WIDTH === 0) stale.add(Math.floor((x - 1) / CHUNK_WIDTH));
        if (x % CHUNK_WIDTH === CHUNK_WIDTH - 1) stale.add(Math.floor((x + 1) / CHUNK_WIDTH));
      }
      changed.dirty.length = 0;
      for (const index of stale) {
        if (index >= 0 && index < chunks.length) rebuild(changed, chunks, index);
      }
    },
    dispose() {
      for (const chunk of chunks) {
        chunk.solid.geometry.dispose();
        chunk.glow.geometry.dispose();
      }
      solidMaterial.dispose();
      glowMaterial.dispose();
      atlas.dispose();
    },
  };
}

/** One mesh under construction: positions, normals, uvs and shading. */
class Mesher {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly colours: number[] = [];

  /**
   * A quad, wound anticlockwise from the first corner. Each corner carries its
   * own brightness, which is where the corner shading lands.
   */
  quad(
    corners: readonly [number, number, number][],
    normal: readonly [number, number, number],
    block: number,
    shades: readonly number[],
  ): void {
    const { u0, v0, u1, v1 } = tileUv(block);
    const uv: [number, number][] = [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ];
    for (const index of [0, 1, 2, 0, 2, 3]) {
      const corner = corners[index] as [number, number, number];
      const texel = uv[index] as [number, number];
      const shade = shades[index] ?? 1;
      this.positions.push(corner[0], corner[1], corner[2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.uvs.push(texel[0], texel[1]);
      this.colours.push(shade, shade, shade);
    }
  }

  toGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colours, 3));
    return geometry;
  }
}

function rebuild(world: World, chunks: Chunk[], index: number): void {
  const chunk = chunks[index];
  if (!chunk) return;
  const solid = new Mesher();
  const glow = new Mesher();
  const from = index * CHUNK_WIDTH;
  const to = Math.min(from + CHUNK_WIDTH, world.width);

  for (let x = from; x < to; x++) {
    for (let y = 0; y < world.height; y++) {
      const block = world.get(x, y);
      // A back wall shows wherever nothing solid covers it — through a
      // doorway, a broken window, or past a lamp post.
      if (!world.isOpaque(x, y)) emitBackWall(world, solid, x, y);
      if (block === AIR) continue;
      const shape = specOf(block);
      emitBlock(world, shape.glows ? glow : solid, x, y, block, shape.slim);
    }
  }

  chunk.solid.geometry.dispose();
  chunk.glow.geometry.dispose();
  chunk.solid.geometry = solid.toGeometry();
  chunk.glow.geometry = glow.toGeometry();
}

/** The room behind an opening, drawn dim and flat one layer back. */
function emitBackWall(world: World, mesher: Mesher, x: number, y: number): void {
  const block = world.getBack(x, y);
  if (block === AIR) return;
  const shade = BACK_SHADE * jitter(x, y);
  mesher.quad(
    [
      [x, y, BACK_Z],
      [x + 1, y, BACK_Z],
      [x + 1, y + 1, BACK_Z],
      [x, y + 1, BACK_Z],
    ],
    [0, 0, 1],
    block,
    [shade, shade, shade, shade],
  );
}

function emitBlock(
  world: World,
  mesher: Mesher,
  x: number,
  y: number,
  block: number,
  slim: number,
): void {
  const tint = jitter(x, y);
  const x0 = x + slim;
  const x1 = x + 1 - slim;
  // The slab runs from z 0 back to -1; the front face is the one at z 0.
  const z0 = -1 + slim;
  const z1 = 0 - slim;

  // Front. Never culled — nothing in this world stands in front of anything.
  mesher.quad(
    [
      [x0, y, z1],
      [x1, y, z1],
      [x1, y + 1, z1],
      [x0, y + 1, z1],
    ],
    [0, 0, 1],
    block,
    frontShades(world, x, y, slim > 0).map((shade) => shade * FACE_SHADE.front * tint),
  );

  const flat = (shade: number): number[] => [shade, shade, shade, shade];

  if (slim > 0 || !world.isOpaque(x, y + 1)) {
    mesher.quad(
      [
        [x0, y + 1, z1],
        [x1, y + 1, z1],
        [x1, y + 1, z0],
        [x0, y + 1, z0],
      ],
      [0, 1, 0],
      block,
      flat(FACE_SHADE.top * tint),
    );
  }
  if (slim > 0 || !world.isOpaque(x, y - 1)) {
    mesher.quad(
      [
        [x0, y, z0],
        [x1, y, z0],
        [x1, y, z1],
        [x0, y, z1],
      ],
      [0, -1, 0],
      block,
      flat(FACE_SHADE.bottom * tint),
    );
  }
  if (slim > 0 || !world.isOpaque(x + 1, y)) {
    mesher.quad(
      [
        [x1, y, z1],
        [x1, y, z0],
        [x1, y + 1, z0],
        [x1, y + 1, z1],
      ],
      [1, 0, 0],
      block,
      flat(FACE_SHADE.side * tint),
    );
  }
  if (slim > 0 || !world.isOpaque(x - 1, y)) {
    mesher.quad(
      [
        [x0, y, z0],
        [x0, y, z1],
        [x0, y + 1, z1],
        [x0, y + 1, z0],
      ],
      [-1, 0, 0],
      block,
      flat(FACE_SHADE.side * tint),
    );
  }
}

/**
 * Corner shading for the front face, worked out from the eight cells around
 * it. Nothing can stand in front of a block here, so the usual trick of
 * darkening a face by what occludes it has nothing to work with — this reads
 * the neighbourhood in the plane instead, which draws a bright rim along every
 * silhouette and sinks the middle of a wall back.
 */
function frontShades(world: World, x: number, y: number, slim: boolean): number[] {
  if (slim) return [1, 1, 1, 1];
  const at = (dx: number, dy: number): number => (world.isOpaque(x + dx, y + dy) ? 1 : 0);
  const corner = (dx: number, dy: number): number => {
    const side1 = at(dx, 0);
    const side2 = at(0, dy);
    const diagonal = at(dx, dy);
    const level = side1 === 1 && side2 === 1 ? 0 : 3 - (side1 + side2 + diagonal);
    return CORNER_SHADE[level] ?? 1;
  };
  // Wound to match the quad: bottom-left, bottom-right, top-right, top-left.
  return [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
}

/** A little per-cell noise, so a long wall is not one flat slab of colour. */
function jitter(x: number, y: number): number {
  const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return 0.93 + (hash - Math.floor(hash)) * 0.14;
}
