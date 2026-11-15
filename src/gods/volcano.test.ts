import { describe, expect, it } from "vitest";
import { atPortal, footing, inVolcano, ISLAND_R, ISLAND_Y, LANDING_OUT, landing, LAVA_Y, PORTAL_R, STAIR_HALF, VOLCANO } from "./volcano";

const along = (d: number, off = 0) => ({ x: VOLCANO.x + d, z: VOLCANO.z + off });

describe("the volcano", () => {
  it("climbs the stairs from the ground at the foot to the top at the lip", () => {
    const foot = along(VOLCANO.r - 0.01);
    expect(footing(foot.x, foot.z)!.y).toBeCloseTo(0, 1);
    const top = along(LANDING_OUT);
    expect(footing(top.x, top.z)!.y).toBeCloseTo(VOLCANO.h);
  });

  it("rises without a jump anywhere from the foot to the pool", () => {
    let last = footing(along(VOLCANO.r - 0.01).x, VOLCANO.z)!.y;
    for (let d = VOLCANO.r - 0.01; d > 0; d -= 0.1) {
      const f = footing(VOLCANO.x + d, VOLCANO.z);
      expect(f).not.toBeNull();
      expect(Math.abs(f!.y - last)).toBeLessThan(0.4);
      last = f!.y;
    }
  });

  it("has nothing to stand on beside the stairs", () => {
    const side = along(30, STAIR_HALF + 0.3);
    expect(footing(side.x, side.z)).toBeNull();
    expect(inVolcano(side.x, side.z)).toBe(true);
  });

  it("drops anyone who falls inside the crater into the lava", () => {
    const beside = along(8, 3);
    expect(footing(beside.x, beside.z)).toBeNull();
    expect(landing(beside.x, beside.z)).toEqual({ y: LAVA_Y, lava: true });
  });

  it("keeps the portal in the middle of the island", () => {
    expect(atPortal(VOLCANO.x, VOLCANO.z)).toBe(true);
    const rock = along(0, (PORTAL_R + ISLAND_R) / 2);
    expect(atPortal(rock.x, rock.z)).toBe(false);
    expect(footing(rock.x, rock.z)).toEqual({ y: ISLAND_Y, kind: "island" });
  });
});
