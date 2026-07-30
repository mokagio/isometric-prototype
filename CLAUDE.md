# Games Playground

An isometric browser prototype: TypeScript, Vite, no framework, no runtime dependencies.
Five pages, all listed as Rollup inputs in `vite.config.ts`: the games list (`index.html`, entry `home.ts`), Peaceful Plains (`game.html`, entry `main.ts`), Whispering Woods (`woods.html`, entry `woods/main.ts`), a world editor (`editor.html`), and credits (`credits.html`).
A new game is an entry in `games.ts` plus its own page and Rollup input.
Only Peaceful Plains is isometric: Whispering Woods is drawn straight down the screen, and shares the input, sprite, loop, and viewport plumbing but none of `iso.ts`.

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
The same trap catches anything else `public/` holds, and which escape works depends on where you are writing: from `src/chrome.css` the font is a *root-absolute* `url("/fonts/…")`, which Vite rebases at build, but a page's inline `<style>` gets no such rewrite, so anything there — and every link between pages (`games.test.ts` pins it) — has to be relative.

Any new art or font goes in `CREDITS.md` and `credits.html`.

**Sunnyside sheets** (Whispering Woods) are horizontal strips of 96x64 frames, feet-anchored like everything else here — but *not* where the pack says.
Its metadata gives the origin as (48, 64), the bottom edge; the figure is 11x16 of that frame and stands at y=39, so anchoring on 64 floats it a sprite's height above its own shadow.
Measure a new sheet instead of trusting it: `magick walk.png -crop 96x64+0+0 +repage -format %@ info:`.
Frame counts and fps *are* reliable in the pack's GameMaker metadata (`Sunnyside_World_Gamemaker/sprites/<name>/<name>.yy`): walk is 8 frames, idle 9, both at 12 fps.
A character is layers composited in order — `base_*`, then a hair sheet, then `tools_*` for whatever it is holding — flattened at vendoring time, per `CREDITS.md`.
The pack draws one facing, so left is `blitFrame`'s `flip` and walking up or down keeps the sprite front-on.

`woods/field.ts` holds the ground: a finite `FIELD` square of `TILE` (16px) grass, painted from `grass.png` by a value hash so no map is stored, with dark green past its edge.
World coordinates are **sprite pixels** — `walker.ts` and `field.ts` never see the zoom, and `screenAt` is the only conversion.
The camera keeps the character mid-screen and is deliberately unclamped, so walking to the edge shows the void, as it does in Peaceful Plains.
Trees come out of the same hash, thinned by a local-maximum rule — a cell keeps its tree only by out-claiming its neighbours — which spaces them without a placement pass to store, and is what guarantees no two crowns overlap.
Standing things draw in order of how far down the field they are, so passing behind a crown hides you — deliberately, with no ghost of the kind `occlusion.ts` draws in the other game.
Trunks are solid: `blockedByTree` guards the roots only, and `walk` tries each axis separately so walking into one at an angle slides round it.

`woods/wood.ts` holds everything the wood remembers between frames, since the field itself is a pure function of its seed: how many blows each tree has taken, which are shuddering, and `inReach` for the tree the action button would swing at.
Trees stand still until hit — the pack's 4-frame sway plays once, fast, as a shudder.
`Chop` is the swing clock: frame 6 of the axe strip carries the impact star, so that is the frame the blow lands on, and after `CHOPS_TO_FELL` the tree draws as the tileset's own cut stump instead.
The action button and the spacebar both go through one `swingAxe`, so they cannot drift apart; `Input.jump` is the spacebar, and the press is edge-detected because holding it should not chop twice.
The felling blow bursts three logs out of the stump (`woods/logs.ts`): the only thing in this game that leaves the ground, so `z` lives there and nowhere else, and a log is only collectable once it has settled.

## Maps

Every map is `MAP_SIZE` (56) square, generated or hand-built, so the editor can open the world you are playing and the game can play a board you drew.
`mapFormat.ts` owns the file format: `encodeMap`/`decodeMap` (versioned, and validating — a map arrives from a file the player picked), `mapFromWorld`/`worldFromMap` to cross between the two representations, and `readyToPlay` for the unfinished-map offer.
A cell absent from an editor board is a *gap*, `null` in a `MapData`; only `fillEmpty` turns gaps into ground.

Bump `VERSION` whenever the arrays change shape — old files are then refused by name and version rather than half-read.
Every file also records the commit that wrote it (`writtenBy`, from `__BUILD_COMMIT__`), so `git show <commit>:src/mapFormat.ts` is the code that understood it, which is what a converter gets written from.
Unknown fields are ignored on read, so stamps like that can be added without breaking older maps.

A cell carries only its height and surface tile, so `world.ts` is the single rule for what the ground does underfoot.
`isLiquidTile` is sheet row 10, the cracked-pool cube in four hues; `isHazardTile` splits off lava, which the hero can wade at a heart a second (`hazard.ts`), from water and the teal and purple pools, which `blocksTile` keeps impassable.
Water blocks: it is what divides a generated map, and a river you can pay to cross divides nothing.
Only the editor can place lava, so a generated world never charges the hero a heart for the ground.
A new brush of either kind belongs in that row, or the rule needs revisiting — `palette.test.ts` pins every pool tile to a pool-sounding label.

The game and the editor hand work to each other through `handoff.ts`, never in memory: the game stashes its world seed (a world is a pure function of it), the editor stashes a map and asks for it back with `?map=local`.

## UI chrome

`src/chrome.css` holds what every page shares — the `--ww-*` custom properties, and the menu, stick and action-pad rules that `ui.ts`, `stick.ts` and `actionPad.ts` build against.
A page's own `<style>` block holds only what is that page's, and loads after the shared sheet, so it wins any tie.
Neither lives in the TypeScript.

`sharedHead.ts` is the other half: a `transformIndexHtml` plugin that injects the shared `<head>` — charset, viewport, the Home Screen metas, the link to `chrome.css` — into every Rollup input.
A new page therefore gets the chrome by being listed in `vite.config.ts` and nothing else, which is what `sharedHead.test.ts` pins, along with no page having grown its own copy of a meta.
The injected `<link>` needs the hook to stay `order: "pre"`, or Vite's HTML pass never sees the href to hash it; and it is a `<link>` rather than an import from an entry module because `credits.html` has no script.

Pages are `viewport-fit=cover`, so the layout runs under the notch and the home indicator, and the `--ww-inset-*` properties (never a flat `16px`) are what keep the chrome clear of them.
What actually clears Safari's tab bar on an iPhone is Add to Home Screen, which the injected `apple-mobile-web-app-capable` enables.
Fullscreen is a menu item that hides itself where the API is missing, which on an iPhone it is — `createMenu` adds it for every game rather than taking it as a `MenuActions` entry, since it asks the game for nothing.
Class names are `ww-` prefixed, and the storage keys are `ww:` — from Whispering Woods, which is what this was called before it became a playground with more than one game in it.
The list page is a title and one button per game, borrowing the menu button's shape, and its backdrop is the game's own grass tiles: `backdrop.ts` renders a water-free flat world through `renderer.ts` rather than shipping a second copy of the art.
