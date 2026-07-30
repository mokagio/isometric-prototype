# Games Playground

An isometric browser prototype: TypeScript, Vite, no framework, no runtime dependencies.
Four pages, all listed as Rollup inputs in `vite.config.ts`: the games list (`index.html`, entry `home.ts`), the game — Peaceful Plains — (`game.html`, entry `main.ts`), a world editor (`editor.html`), and credits (`credits.html`).
A new game is an entry in `games.ts` plus its own page and Rollup input.

## Commands

- `npm run dev` — Vite dev server, bound to `host: true` so a phone on the LAN can play it.
- `npm run build` — `tsc` then `vite build`. This is the type check; there is no separate `typecheck` script.
- `npm test` — Vitest, single run. `npm run test:watch` to iterate.

CI only builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`); it does not run the tests.
Run `npm test` and `npm run build` locally before pushing.

## Module conventions

**Split pure logic from DOM.**
Export the testable functions and unit test them; leave the `createX` entry point that builds elements and appends to `document.body` untested.
`stick.ts` is the model: `axisFromDrag` and `steppedCircle` are covered by `stick.test.ts`, `createStick` is not.
Tests run in Vitest's node environment — there is no jsdom, so a test that needs `document` does not belong here.

**Browser globals get stubbed, not mocked away.**
`monsters.test.ts` swaps in a `FakeImage` via `vi.stubGlobal` and settles `onload` by hand, which is also how it asserts the loading state machine.

**Tuning constants are exported and asserted against.**
`SPEED`, `CONTACT`, `MELEE`, `FADE` in `monsters.ts` are exported so the tests express behaviour in terms of the dial rather than a magic number.
Keep that up: a new tunable is a named export, and its test refers to it.

## Rendering

`iso.ts` owns the projection. `SX`/`SY`/`SZ` are half-tile screen steps per grid axis; screen-x runs with `col - row`, screen-y with `col + row`.

Sprites anchor on the **feet** — `(feetX, feetY)` is the centre of the tile the figure stands on, and each sheet's `ANCHOR_X`/`ANCHOR_Y` says where that point sits inside its frame.
Draw order is by `col + row` through `renderer.ts`'s `Entity` list.

Spritesheets live in `public/` and load through `` `${import.meta.env.BASE_URL}...` ``.
The site deploys to a GitHub *project* page served from `/<repo>/`, so a root-absolute path 404s in production.
Every new sheet loader needs a test covering the base prefix, as `monsters.test.ts` does.
The same trap catches anything else `public/` holds: the font in `index.html` is reached with a *relative* `url("fonts/…")`, and links between pages are relative for the same reason (`games.test.ts` pins it).

Any new art or font goes in `CREDITS.md` and `credits.html`.

## Maps

Every map is `MAP_SIZE` (56) square, generated or hand-built, so the editor can open the world you are playing and the game can play a board you drew.
`mapFormat.ts` owns the file format: `encodeMap`/`decodeMap` (versioned, and validating — a map arrives from a file the player picked), `mapFromWorld`/`worldFromMap` to cross between the two representations, and `readyToPlay` for the unfinished-map offer.
A cell absent from an editor board is a *gap*, `null` in a `MapData`; only `fillEmpty` turns gaps into ground.

Bump `VERSION` whenever the arrays change shape — old files are then refused by name and version rather than half-read.
Every file also records the commit that wrote it (`writtenBy`, from `__BUILD_COMMIT__`), so `git show <commit>:src/mapFormat.ts` is the code that understood it, which is what a converter gets written from.
Unknown fields are ignored on read, so stamps like that can be added without breaking older maps.

A cell carries only its height and surface tile, so `world.ts` is the single rule for what the ground does underfoot.
`isLiquidTile` is sheet row 10, the cracked-pool cube in four hues; `isHazardTile` splits off water and lava, which the hero can wade at a heart a second (`hazard.ts`), from the teal and purple pools, which `blocksTile` keeps impassable.
Monsters stay out of all four, so a river is an escape the hero can buy.
A new brush of either kind belongs in that row, or the rule needs revisiting — `palette.test.ts` pins every pool tile to a pool-sounding label.

The game and the editor hand work to each other through `handoff.ts`, never in memory: the game stashes its world seed (a world is a pure function of it), the editor stashes a map and asks for it back with `?map=local`.

## UI chrome

Each page keeps its styles in its own `<style>` block, not in the TypeScript — the game's chrome in `game.html`, the list's in `index.html`.
Shared sizing goes through the `--ww-*` custom properties defined on `:root` so the stick, action pad, and menu stay in step.
Class names are `ww-` prefixed, and the storage keys are `ww:` — from Whispering Woods, which is what this was called before it became a playground with more than one game in it.
The list page is a title and one button per game, borrowing the menu button's shape, and its backdrop is the game's own grass tiles: `backdrop.ts` renders a water-free flat world through `renderer.ts` rather than shipping a second copy of the art.
