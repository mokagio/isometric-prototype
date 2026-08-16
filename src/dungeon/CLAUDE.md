# Amelia's Dungeon

A top-down dungeon crawler in the browser, ported whole into the playground from its own repo.
Two pages — the game (`dungeon.html`) and a dungeon builder (`dungeonEditor.html`) — both listed as Rollup inputs in `vite.config.ts`.
The playground's own `CLAUDE.md` says what the port changed; everything below is the game itself, and the commands are the repo's.

## Module conventions

**Split pure logic from DOM.**
Export the testable functions and unit test them; leave the `createX` entry point that builds elements and appends to `document.body` untested.
`stick.ts` is the model: `steppedCircle` and `steppedRing` are covered by `stick.test.ts`, `createStick` is not.
Tests run in Vitest's node environment — there is no jsdom, so a test that needs `document` does not belong here.

**Browser globals get stubbed, not mocked away.**
`enemies.test.ts` swaps in a `FakeImage` via `vi.stubGlobal` and settles `onload` by hand, which is also how it asserts the loading state machine.

**Tuning constants are exported and asserted against.**
`SPEED`, `CONTACT`, `MELEE`, `SEPARATION` in `enemies.ts` are exported so the tests express behaviour in terms of the dial rather than a magic number.
Keep that up: a new tunable is a named export, and its test refers to it.

## Hero skins

`heroSkin.ts` is the interface and the `createHeroSkin` switch; each skin is its own module.
They share the mechanics — feet anchor, four-way facing, caller-owned clock — and differ in sheet geometry and in where the weapon comes from.
`mageSkin.ts` and `dungeonHeroSkin.ts` carry their weapon through their own attack strips; `elfSkin.ts` has no attack pose at all, because 0x72 draws its characters empty-handed, so its swing is a separate sword sprite arcing around her hand.
A skin without a defeat pose returns false from `drawDefeat` and `main.ts` falls back to idle.
Skins whose art is side-on only mirror on `LEFT` and ignore the other two headings.

Add a skin to `SKINS` in menu order; the picker steps through that list, so nothing else needs touching.

## The dungeon loop

Find the chest, clear the dungeon, drop into a harder one, and the tally counts how many.
`chest.ts` hides the treasure in the room furthest from Amelia's start *by flood distance*, so it is always somewhere she can walk to.
Nothing points the way — searching is the game.

Enemies are a fixed roster placed once per dungeon by `EnemyField.populate`, asleep, never within `SAFE_STEPS` of her start, and never refilled — a cleared dungeon stays cleared.
They wake at `WAKE_STEPS`, also measured through the dungeon, so a wall between them counts.
Hunt/Lurk now decides what a woken enemy does when she gets away: follow her, or settle back down.

Both `enter()` and `populate` want the flood taken from Amelia's *spawn*, which is why `enter()` recomputes it before placing anything; `frame` re-floods from wherever she walks to next.

## Chasing the hero

`flow.ts` floods steps-to-the-hero across the floor, and `main.ts` recomputes it when she crosses into a new cell.
Enemies walk straight at her whenever `lineClear` says nothing is in the way, and follow the flood otherwise — that split is what keeps an open-room chase looking like a chase while still getting a body out of a corner.
Spawn rings are measured in flood steps, not straight-line distance, so every spawn is somewhere with a way through.

## Rendering

`grid.ts` owns the projection — plain orthogonal, `CELL` screen pixels per cell, `ZOOM` whole-pixel steps over the sheet's 16px tiles.

Sprites anchor on the **feet**, at the centre of the cell the figure stands on.
Draw order is by row through `renderer.ts`'s `Entity` list, so a wall further down the screen paints over whatever stands behind it.

`dungeonTiles.ts` decides what a cell is built from, given only its four neighbours, and is where the sheet's wall geometry is written down: a wall is a 16px brick face with a 4px lit lip that lives in the bottom of its own `wall_top_*` tile, so a head-on wall is two pieces and everything else is one.
Any new wall case belongs there with a test, not in the renderer.

`tiles.ts` is the sheet index, transcribed from the pack's `tile_list_v1.7`.
Regenerate it from that file rather than editing rects by hand.

## The builder's two modes

`dungeonEditor.html` digs and it rules on tiles.
Digging paints the floor map the game plays; the Tiles mode overrules `wallPieces` a cell at a time and exports the result, so the autotiler can be rewritten against tiles somebody chose rather than against a screenshot.

The overlay never reaches the game: `render` takes an optional `wallAt` that answers `null` for every cell nobody has ruled on, which is all of them outside the editor.

Corrections are sparse and seeded from `wallPieces` on first touch, so untouched geometry still re-flows when the floor is dug.
Each keeps the 3×3 window it was decided against — `wallPieces` reads seven cells and all of them sit inside that window, which is what lets `rules.ts` collect corrections by shape and call out the same window drawn two ways.
`around.test.ts` holds that property down over all 512 windows; if it ever fails, an exported rule is a lie.

The sidebar widgets, drag painting, undo, the file picker and the pan compass are the playground's own, imported out of `src/` and carrying no game knowledge.
Reach for those before writing a new one; the `ed-` classes they build against are `chrome.css`'s, recoloured off the tileset in `dungeonEditor.html`.

Sheets load through `assets.ts`'s `assetUrl`, which prefixes `import.meta.env.BASE_URL` and takes the whole path under `public/` — the dungeon's own art is `dungeon/`, but Amelia is `rpg_hero/` and `oboro/mage/`, shared with the other games rather than copied.
The site deploys to a GitHub *project* page served from `/<repo>/`, so a root-absolute path 404s in production.

Any new art goes in the playground's `CREDITS.md` and `credits.html`, which `credits.test.ts` holds to each other.
Anything from the oboropixel pack goes under `public/oboro/`, which is gitignored — the licence forbids redistribution and the repo is public.

## UI chrome

Overlay styles live in the `<style>` block in `dungeon.html`, not in the TypeScript, and load after the `chrome.css` the shared head prepends.
The palette is sampled from the tileset and exposed as `--ad-*` custom properties on `:root`, so the chrome stays in the same dungeon as the art.
Class names are `ad-` prefixed.
