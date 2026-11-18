import { ARTEMIS } from "./artemis";
import { KRATOS } from "./kratos";
import { MAZE_CENTRE } from "./maze";
import { LAIR } from "./medusa";
import { PEAK } from "./hydra";
import { VOLCANO } from "./volcano";
import { COLOSSEUM, SEA_ARENA } from "./world";
import { OLYMPUS, ZEUS_RING } from "./zeus";

/**
 * North is up the road to Ares, which is -z; east is +x, toward the sea.
 * A bearing is clockwise from north in radians, so it turns straight into a
 * CSS rotation on the dial.
 */
export function bearing(dx: number, dz: number): number {
  return Math.atan2(dx, -dz);
}

/** The bearing of a yaw: where a body facing `yaw` is headed. */
export function headingOf(yaw: number): number {
  return bearing(Math.sin(yaw), Math.cos(yaw));
}

export interface GodPlace {
  /** The id `save.beaten` records once the god is down. */
  id: string;
  name: string;
  x: number;
  z: number;
  color: string;
}

/** Where every god waits; Hades is under the volcano, so the volcano is where he is marked. */
export const GOD_PLACES: readonly GodPlace[] = [
  { id: "ares", name: "Ares", x: COLOSSEUM.x, z: COLOSSEUM.z, color: "#d8382c" },
  { id: "poseidon", name: "Poseidon", x: SEA_ARENA.x, z: SEA_ARENA.z, color: "#2a8fd0" },
  { id: "hades", name: "Hades", x: VOLCANO.x, z: VOLCANO.z, color: "#5fe08a" },
  { id: "zeus", name: "Zeus", x: ZEUS_RING.x, z: ZEUS_RING.z, color: "#ffd23a" },
  { id: "kronos", name: "Kronos", x: OLYMPUS.x, z: OLYMPUS.z, color: "#a58ad8" },
  { id: "artemis", name: "Artemis", x: ARTEMIS.x, z: ARTEMIS.z, color: "#6fbf6a" },
  { id: "kratos", name: "Kratos", x: KRATOS.x, z: KRATOS.z, color: "#c8913a" },
  { id: "hydra", name: "Hydra", x: PEAK.x, z: PEAK.z, color: "#3fae7a" },
  { id: "medusa", name: "Medusa", x: LAIR.x, z: LAIR.z, color: "#b8c84a" },
  { id: "minotaur", name: "Minotaur", x: MAZE_CENTRE.x, z: MAZE_CENTRE.z, color: "#a86a3a" },
];

export interface DialMark {
  id: string;
  name: string;
  color: string;
  /** Bearing from the hero to the god. */
  bearing: number;
  beaten: boolean;
}

/** Each god's mark on the rim of the dial, as seen from where the hero stands. */
export function dialMarks(x: number, z: number, beaten: readonly string[]): DialMark[] {
  return GOD_PLACES.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    bearing: bearing(g.x - x, g.z - z),
    beaten: beaten.includes(g.id),
  }));
}

export interface MapFit {
  scale: number;
  /** Screen position of a world point. */
  toScreen(x: number, z: number): { x: number; y: number };
}

/** Fits a world box into a `w` by `h` screen with `pad` pixels spare, north up and east right. */
export function fitMap(box: { x0: number; z0: number; x1: number; z1: number }, w: number, h: number, pad: number): MapFit {
  const scale = Math.min((w - pad * 2) / (box.x1 - box.x0), (h - pad * 2) / (box.z1 - box.z0));
  const cx = (box.x0 + box.x1) / 2;
  const cz = (box.z0 + box.z1) / 2;
  return {
    scale,
    toScreen: (x, z) => ({ x: w / 2 + (x - cx) * scale, y: h / 2 + (z - cz) * scale }),
  };
}
