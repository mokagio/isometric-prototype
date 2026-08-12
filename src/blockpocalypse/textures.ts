import * as THREE from "three";
import { SPECS } from "./blocks";

/** Pixels down one side of a block's tile. */
export const TILE = 16;
export const ATLAS_COLUMNS = 8;

/**
 * The block atlas, painted rather than loaded: a pixel of surface detail on
 * every face is what separates a wall of bricks from a wall of one brown.
 * Tiles carry their own colour, so a mesh's vertex colours are pure shading.
 */
export function buildAtlas(): THREE.CanvasTexture {
  const rows = Math.ceil(SPECS.length / ATLAS_COLUMNS);
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_COLUMNS * TILE;
  canvas.height = rows * TILE;
  const context = canvas.getContext("2d");
  if (context) {
    context.imageSmoothingEnabled = false;
    SPECS.forEach((block, index) => {
      const ox = (index % ATLAS_COLUMNS) * TILE;
      const oy = Math.floor(index / ATLAS_COLUMNS) * TILE;
      // Clipped to its own tile. A running bond has to lay bricks that run off
      // both edges to come out seamless, and unclipped those strokes land on
      // whichever tiles happen to sit next door in the atlas.
      context.save();
      context.beginPath();
      context.rect(ox, oy, TILE, TILE);
      context.clip();
      const brush = new Brush(context, ox, oy, block.colour, index * 2654435761);
      (PAINTERS[block.name] ?? paintPlain)(brush);
      context.restore();
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Where a block's tile sits in the atlas, in UV space, inset off the seam. */
export function tileUv(block: number): { u0: number; v0: number; u1: number; v1: number } {
  const rows = Math.ceil(SPECS.length / ATLAS_COLUMNS);
  const column = block % ATLAS_COLUMNS;
  const row = Math.floor(block / ATLAS_COLUMNS);
  // Half a texel in from every edge, or nearest-neighbour sampling picks up
  // the tile next door along the shared boundary.
  const bleed = 0.5 / TILE;
  const u0 = (column + bleed) / ATLAS_COLUMNS;
  const u1 = (column + 1 - bleed) / ATLAS_COLUMNS;
  // Canvas rows run down, UV rows run up.
  const v1 = 1 - (row + bleed) / rows;
  const v0 = 1 - (row + 1 - bleed) / rows;
  return { u0, v0, u1, v1 };
}

/** Paints one tile, in tile-local pixels, in shades of the block's own colour. */
class Brush {
  private readonly context: CanvasRenderingContext2D;
  private readonly ox: number;
  private readonly oy: number;
  readonly colour: number;
  private seed: number;

  constructor(
    context: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    colour: number,
    seed: number,
  ) {
    this.context = context;
    this.ox = ox;
    this.oy = oy;
    this.colour = colour;
    this.seed = seed >>> 0;
  }

  /** Deterministic, so the atlas is identical on every machine and every run. */
  random(): number {
    this.seed = (Math.imul(this.seed ^ (this.seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return this.seed / 4294967296;
  }

  rect(x: number, y: number, w: number, h: number, shade: number, tint = this.colour): void {
    this.context.fillStyle = hex(shift(tint, shade));
    this.context.fillRect(this.ox + x, this.oy + y, w, h);
  }

  fill(shade = 0, tint = this.colour): void {
    this.rect(0, 0, TILE, TILE, shade, tint);
  }

  /** Scatters single pixels, which is most of what makes a surface look worn. */
  speckle(count: number, shade: number, tint = this.colour): void {
    for (let index = 0; index < count; index++) {
      const x = Math.floor(this.random() * TILE);
      const y = Math.floor(this.random() * TILE);
      this.rect(x, y, 1, 1, shade * (0.5 + this.random()), tint);
    }
  }
}

type Painter = (brush: Brush) => void;

function paintPlain(brush: Brush): void {
  brush.fill();
  brush.speckle(26, -0.12);
  brush.speckle(14, 0.1);
}

const PAINTERS: Record<string, Painter> = {
  air: () => {},

  asphalt(brush) {
    brush.fill();
    brush.speckle(40, -0.22);
    brush.speckle(26, 0.16);
    brush.rect(0, 0, TILE, 1, 0.12);
  },

  sidewalk(brush) {
    brush.fill();
    brush.speckle(22, -0.1);
    // Paving joints, one course to a tile.
    brush.rect(0, 7, TILE, 1, -0.3);
    brush.rect(8, 0, 1, 7, -0.3);
    brush.rect(3, 8, 1, 8, -0.3);
    brush.rect(0, 0, TILE, 1, 0.16);
  },

  concrete(brush) {
    brush.fill();
    brush.speckle(30, -0.1);
    brush.speckle(18, 0.08);
    brush.rect(0, 5, TILE, 1, -0.16);
    brush.rect(0, 6, TILE, 1, 0.08);
    brush.rect(11, 6, 1, 10, -0.14);
  },

  brick(brush) {
    brush.fill(-0.34); // mortar
    // Running bond: three courses, every other one offset by half a brick.
    for (let course = 0; course < 3; course++) {
      const y = course * 6 - 1;
      const offset = course % 2 === 0 ? 0 : -8;
      for (let brickIndex = -1; brickIndex < 3; brickIndex++) {
        const x = brickIndex * 16 + offset;
        brush.rect(x, y, 15, 5, 0.04 + brush.random() * 0.14 - 0.07);
      }
    }
    brush.speckle(14, -0.12);
  },

  bloodBrick(brush) {
    PAINTERS["brick"]?.(brush);
    brush.rect(4, 2, 3, 6, -0.28);
    brush.rect(10, 8, 2, 5, -0.24);
  },

  plank(brush) {
    brush.fill();
    // Boards run across, with a grain line and the odd knot.
    for (let board = 0; board < 3; board++) {
      const y = board * 6;
      brush.rect(0, y, TILE, 1, -0.32);
      brush.rect(0, y + 2, TILE, 1, 0.1);
      brush.rect(0, y + 4, TILE, 1, -0.1);
    }
    brush.rect(4, 8, 2, 2, -0.26);
    brush.rect(11, 1, 2, 2, -0.22);
  },

  crate(brush) {
    brush.fill();
    brush.rect(0, 0, TILE, 2, -0.28);
    brush.rect(0, 14, TILE, 2, -0.28);
    brush.rect(0, 0, 2, TILE, -0.28);
    brush.rect(14, 0, 2, TILE, -0.28);
    // Cross bracing.
    for (let step = 0; step < 12; step++) {
      brush.rect(2 + step, 2 + step, 1, 1, -0.2);
      brush.rect(13 - step, 2 + step, 1, 1, -0.2);
    }
    brush.speckle(12, 0.1);
  },

  steel(brush) {
    brush.fill();
    brush.rect(0, 0, TILE, 2, 0.16);
    brush.rect(0, 14, TILE, 2, -0.2);
    // Rivets down the flange.
    for (let index = 0; index < 4; index++) {
      brush.rect(2 + index * 4, 6, 2, 2, 0.2);
      brush.rect(2 + index * 4, 7, 2, 1, -0.18);
    }
    brush.speckle(10, -0.1);
  },

  vent(brush) {
    brush.fill(-0.06);
    for (let louvre = 0; louvre < 5; louvre++) {
      brush.rect(2, 2 + louvre * 3, 12, 1, -0.34);
      brush.rect(2, 3 + louvre * 3, 12, 1, 0.14);
    }
    brush.rect(0, 0, TILE, 1, 0.18);
  },

  glass(brush) {
    brush.fill(-0.05);
    // Frame and mullions, then a sheen across one pane.
    brush.rect(0, 0, TILE, 2, -0.45);
    brush.rect(0, 14, TILE, 2, -0.45);
    brush.rect(0, 0, 2, TILE, -0.45);
    brush.rect(14, 0, 2, TILE, -0.45);
    brush.rect(7, 0, 2, TILE, -0.4);
    brush.rect(0, 7, TILE, 2, -0.4);
    for (let step = 0; step < 5; step++) brush.rect(3 + step, 5 - step, 1, 1, 0.4);
  },

  windowLit(brush) {
    brush.fill(0.05);
    brush.rect(0, 0, TILE, 2, -0.5);
    brush.rect(0, 14, TILE, 2, -0.5);
    brush.rect(0, 0, 2, TILE, -0.5);
    brush.rect(14, 0, 2, TILE, -0.5);
    brush.rect(7, 0, 2, TILE, -0.45);
    brush.rect(0, 7, TILE, 2, -0.45);
    // Something in the room, throwing a shape onto the blind.
    brush.rect(3, 9, 3, 4, -0.3);
    brush.rect(10, 3, 3, 3, -0.22);
  },

  rubble(brush) {
    brush.fill(-0.1);
    for (let chunk = 0; chunk < 14; chunk++) {
      const x = Math.floor(brush.random() * 13);
      const y = Math.floor(brush.random() * 13);
      const size = 2 + Math.floor(brush.random() * 3);
      brush.rect(x, y, size, size, brush.random() * 0.4 - 0.2);
    }
    brush.speckle(20, -0.2);
  },

  dirt(brush) {
    brush.fill();
    brush.speckle(46, -0.2);
    brush.speckle(24, 0.14);
    for (let stone = 0; stone < 4; stone++) {
      brush.rect(
        Math.floor(brush.random() * 14),
        Math.floor(brush.random() * 14),
        2,
        2,
        0.16,
      );
    }
  },

  beacon(brush) {
    // A dark casing with a lit core, rather than a pattern: it has to read as
    // one landmark from across the street, not as decoration.
    brush.fill(-0.62);
    brush.rect(0, 0, TILE, 1, -0.3);
    brush.rect(0, 15, TILE, 1, -0.3);
    brush.rect(4, 2, 8, 12, 0.15);
    brush.rect(6, 3, 4, 10, 0.6);
  },

  helipad(brush) {
    brush.fill(-0.12);
    // Hazard stripes, painted on and scuffed.
    for (let step = -TILE; step < TILE; step += 6) {
      for (let along = 0; along < TILE; along++) {
        brush.rect(step + along, along, 3, 1, 0.24);
      }
    }
    brush.speckle(22, -0.24);
  },

  lampPost(brush) {
    brush.fill();
    brush.rect(0, 0, 4, TILE, 0.2);
    brush.rect(12, 0, 4, TILE, -0.24);
    brush.speckle(8, -0.14);
  },

  lampHead(brush) {
    brush.fill(0.1);
    brush.rect(0, 0, TILE, 3, -0.4);
    brush.rect(2, 4, 12, 10, 0.35);
    brush.rect(5, 6, 6, 6, 0.6);
  },

  carBody(brush) {
    brush.fill();
    brush.rect(0, 0, TILE, 3, 0.22);
    brush.rect(0, 12, TILE, 4, -0.26);
    brush.rect(0, 7, TILE, 1, -0.34);
    brush.speckle(18, -0.16);
    brush.rect(11, 2, 3, 3, 0.3);
  },

  carGlass(brush) {
    brush.fill();
    brush.rect(0, 0, TILE, 2, -0.4);
    brush.rect(0, 0, 2, TILE, -0.4);
    brush.rect(14, 0, 2, TILE, -0.4);
    for (let step = 0; step < 7; step++) brush.rect(4 + step, 11 - step, 2, 1, 0.35);
    brush.speckle(10, -0.2);
  },

  tyre(brush) {
    brush.fill();
    for (let tread = 0; tread < 8; tread++) brush.rect(0, tread * 2, TILE, 1, 0.35);
    brush.rect(4, 4, 8, 8, 0.5);
    brush.rect(6, 6, 4, 4, -0.1);
  },

  pipe(brush) {
    brush.fill();
    brush.rect(0, 0, 3, TILE, 0.26);
    brush.rect(13, 0, 3, TILE, -0.28);
    // A collar every so often along the run.
    brush.rect(0, 3, TILE, 2, -0.18);
    brush.rect(0, 12, TILE, 2, -0.18);
    brush.speckle(14, -0.18);
  },

  coin(brush) {
    brush.fill(-0.55);
    brush.rect(2, 1, 12, 14, 0.15);
    brush.rect(3, 2, 10, 12, 0.45);
    brush.rect(6, 4, 4, 8, -0.2);
    brush.rect(4, 3, 2, 3, 0.7);
  },

  laser(brush) {
    // A white-hot core inside its own glow, so a beam reads at any size.
    brush.fill(-0.2);
    brush.rect(0, 4, TILE, 8, 0.35);
    brush.rect(0, 6, TILE, 4, 0.8);
    brush.rect(0, 7, TILE, 2, 1);
  },

  laserUp(brush) {
    brush.fill(-0.2);
    brush.rect(4, 0, 8, TILE, 0.35);
    brush.rect(6, 0, 4, TILE, 0.8);
    brush.rect(7, 0, 2, TILE, 1);
  },

  emitter(brush) {
    brush.fill();
    brush.rect(0, 0, TILE, 3, 0.2);
    brush.rect(0, 13, TILE, 3, -0.25);
    brush.rect(3, 5, 10, 6, -0.35);
    brush.rect(5, 6, 6, 4, 0.3);
    brush.speckle(10, -0.14);
  },

  sign(brush) {
    brush.fill();
    brush.rect(0, 0, TILE, 2, -0.35);
    brush.rect(0, 14, TILE, 2, -0.35);
    brush.rect(0, 0, 2, TILE, -0.35);
    brush.rect(14, 0, 2, TILE, -0.35);
    // Lettering, unreadable and all the better for it.
    brush.rect(3, 5, 3, 6, 0.55);
    brush.rect(7, 5, 2, 6, 0.55);
    brush.rect(10, 5, 3, 2, 0.55);
    brush.rect(10, 9, 3, 2, 0.55);
  },
};

function shift(colour: number, amount: number): number {
  const r = (colour >> 16) & 0xff;
  const g = (colour >> 8) & 0xff;
  const b = colour & 0xff;
  const move = (channel: number): number =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount))));
  return (move(r) << 16) | (move(g) << 8) | move(b);
}

function hex(colour: number): string {
  return `#${colour.toString(16).padStart(6, "0")}`;
}
