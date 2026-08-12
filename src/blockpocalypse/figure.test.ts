import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  buildFigure,
  DEFAULT_DARK,
  MODEL_HEIGHT,
  paintFigure,
  tintFigure,
  type FigurePalette,
} from "./figure";

const PALETTE: FigurePalette = {
  skin: 0xd9a066,
  shirt: 0x3f76b5,
  legs: 0x2f3b4a,
  hair: 0x3a2a1a,
  eye: 0xf1ece0,
};

const linear = (hex: number): [number, number, number] => {
  const colour = new THREE.Color().setHex(hex);
  return [colour.r, colour.g, colour.b];
};

/** Every colour the figure is painted in, as a set of hex strings. */
function coloursOf(figure: ReturnType<typeof buildFigure>): Set<string> {
  const found = new Set<string>();
  const colour = new THREE.Color();
  for (const part of figure.parts) {
    const attribute = part.mesh.geometry.getAttribute("color");
    for (let i = 0; i < attribute.count; i++) {
      colour.setRGB(attribute.getX(i), attribute.getY(i), attribute.getZ(i));
      found.add(colour.getHexString());
    }
  }
  return found;
}

describe("buildFigure", () => {
  it("stands on its own origin, whatever it is scaled to", () => {
    // The group's position is the body's feet, so nothing may hang below zero
    // once the model is scaled to the body's height.
    const figure = buildFigure(PALETTE, 1.7);
    const box = new THREE.Box3().setFromObject(figure.group);
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeCloseTo(MODEL_HEIGHT, 1);
  });

  it("scales the whole model to the body it is given", () => {
    const short = buildFigure(PALETTE, 1.1);
    const box = new THREE.Box3().setFromObject(short.group);
    expect(box.max.y).toBeCloseTo(1.1, 1);
  });

  it("keeps every part to one draw call", () => {
    // Two legs, two arms, a torso and a head. Thirty zombies made of a mesh
    // per brick is what this is holding the line against.
    const figure = buildFigure(PALETTE, 1.7);
    const meshes: THREE.Mesh[] = [];
    figure.group.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    expect(meshes).toHaveLength(6);
  });

  it("paints each brick the palette's own colour", () => {
    const colours = coloursOf(buildFigure(PALETTE, 1.7));
    for (const hex of [PALETTE.skin, PALETTE.shirt, PALETTE.legs, PALETTE.hair, PALETTE.eye!]) {
      expect(colours, `#${hex.toString(16)}`).toContain(new THREE.Color(hex).getHexString());
    }
  });

  it("dresses the gear in a default rather than leaving it unpainted", () => {
    const colours = coloursOf(buildFigure(PALETTE, 1.7));
    expect(colours).toContain(new THREE.Color(DEFAULT_DARK).getHexString());
  });

  it("holds a stand-in gun only when the palette arms it", () => {
    expect(buildFigure(PALETTE, 1.7).gun).toBeNull();
    expect(buildFigure({ ...PALETTE, gun: 0x24252b }, 1.7).gun).not.toBeNull();
  });
});

describe("paintFigure", () => {
  it("repaints a body that has changed breed", () => {
    // The zombie pool reuses a figure across kinds, so a runner must not walk
    // in wearing the walker's skin.
    const figure = buildFigure(PALETTE, 1.7);
    paintFigure(figure, { ...PALETTE, skin: 0x6aa84f, eye: 0xd8e04a });

    const colours = coloursOf(figure);
    expect(colours).toContain(new THREE.Color(0x6aa84f).getHexString());
    expect(colours).not.toContain(new THREE.Color(PALETTE.skin).getHexString());
  });

  it("writes colours in the space the attribute is read in", () => {
    const figure = buildFigure(PALETTE, 1.7);
    const attribute = figure.head.geometry.getAttribute("color");
    const [r, g, b] = linear(PALETTE.skin);
    // The head's first brick is the skull, so its first vertex is skin.
    expect(attribute.getX(0)).toBeCloseTo(r, 5);
    expect(attribute.getY(0)).toBeCloseTo(g, 5);
    expect(attribute.getZ(0)).toBeCloseTo(b, 5);
  });
});

describe("tintFigure", () => {
  it("reaches every material, so a hit flashes all of a body", () => {
    const figure = buildFigure({ ...PALETTE, gun: 0x24252b }, 1.7);
    tintFigure(figure, 0xff4040, 0.8);
    for (const material of figure.materials) {
      expect(material.emissive.getHexString()).toBe("ff4040");
      expect(material.emissiveIntensity).toBe(0.8);
    }
  });
});
