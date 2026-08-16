import { describe, expect, it } from "vitest";
import { assetUrl } from "./assets";

// The site deploys to a GitHub *project* page served from /<repo>/, so a
// root-absolute path 404s in production.
describe("assetUrl", () => {
  it("hangs assets off the deploy base", () => {
    expect(assetUrl("dungeon/tiles.png", "/")).toBe("/dungeon/tiles.png");
    expect(assetUrl("dungeon/tiles.png", "/isometric-prototype/")).toBe(
      "/isometric-prototype/dungeon/tiles.png",
    );
  });

  it("keeps nested paths intact", () => {
    expect(assetUrl("dungeon/enemies/vampire/idle.png", "/isometric-prototype/")).toBe(
      "/isometric-prototype/dungeon/enemies/vampire/idle.png",
    );
  });

  it("reaches the art the other games already keep", () => {
    // The hero sheets are not this game's own folder: `rpg_hero/` and `oboro/`
    // are shared with Peaceful Plains rather than vendored a second time.
    expect(assetUrl("rpg_hero/idle/idle_down_40x40.png", "/")).toBe("/rpg_hero/idle/idle_down_40x40.png");
    expect(assetUrl("oboro/mage/idle.png", "/")).toBe("/oboro/mage/idle.png");
  });
});
