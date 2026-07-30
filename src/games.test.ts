import { describe, expect, it } from "vitest";
import { GAMES } from "./games";

describe("GAMES", () => {
  it("links to each game with a relative path", () => {
    // The site deploys under `/<repo>/`, where a root-absolute link lands on the
    // user's GitHub Pages root instead of the game.
    for (const game of GAMES) {
      expect(game.href, game.name).not.toMatch(/^[/]|^[a-z]+:/i);
    }
  });

  it("names every game, and says something about it", () => {
    for (const game of GAMES) {
      expect(game.name.trim().length).toBeGreaterThan(0);
      expect(game.blurb.trim().length).toBeGreaterThan(0);
    }
  });

  it("lists each page once", () => {
    expect(new Set(GAMES.map((g) => g.href)).size).toBe(GAMES.length);
  });
});
