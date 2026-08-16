# Games Playground

A browser games prototype: TypeScript, Vite, no framework, and one runtime dependency that only Blockpocalypse uses.
Eleven pages, all listed as Rollup inputs in `vite.config.ts`: the games list (`index.html`, entry `home.ts`), Peaceful Plains (`game.html`, entry `main.ts`), Whispering Woods (`woods.html`, entry `woods/main.ts`), Blockpocalypse (`blockpocalypse.html`, entry `blockpocalypse/main.ts`), Amelia's Dungeon (`dungeon.html`, entry `dungeon/main.ts`), a world editor for the Plains (`editor.html`), an island editor for the Woods (`woodsEditor.html`, entry `woods/editor/main.ts`), a coastline editor (`outline.html`), the dungeon builder (`dungeonEditor.html`, entry `dungeon/editor/main.ts`), the asset library (`library.html`, entry `sunnyside/catalogPage.ts`), and credits (`credits.html`).
A new game is an entry in `games.ts` plus its own page and Rollup input.
Only Peaceful Plains is isometric: Whispering Woods is drawn straight down the screen, and shares the input, sprite, loop, and viewport plumbing but none of `iso.ts`.
Blockpocalypse and Amelia's Dungeon share none of it — see below.

## Art that cannot be redistributed

`public/oboro/` is gitignored, and the repo is public.
The oboropixel pack is licensed for use and modification but not for redistribution, so its sheets are carried out of band rather than tracked: Peaceful Plains' slime, its soldier hero skin, and Amelia's mage all draw out of that folder, and a clone without it runs with those sprites missing and nothing else wrong.
Anything else vendored from that pack belongs in there too, which is the whole of the rule — the licence attaches to the pack, not to whichever game reached for it.
`CREDITS.md` carries the same note for a reader who never opens `.gitignore`.

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
A character is layers composited in order — `base_*`, then a hair sheet, then `tools_*` for whatever it is holding — flattened at vendoring time.
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

## What the enemies look like

`monsterSkin.ts` is to `monsters.ts` what `heroSkin.ts` is to the hero: the field owns the wave, the chase and the death, and knows nothing about a sheet.
`MONSTER_SKIN` is the one line that says which art is in play, so the slimes are a word away rather than a revert.
A skin says how many creatures it holds (`cast`) and how far above the feet each one's art tops out (`lift`, in screen pixels, so the heart row clears the sprite without the field knowing any sheet geometry); which of the cast walks in is the ladder's call, not the skin's.
`lift` takes a creature rather than being one number per sheet: a cast stands on one baseline in a cell cut for the tallest of them, so a flat figure floats the heart row most of a creature's height over a small one.
A skin with no death animation, as the mons pack is, fades across the whole of `FADE` rather than saving it for a tail with nothing behind it.

The mons sheet is the one asset here that is *re-cut* rather than vendored whole, and `scripts/cutMonsCast.py` is how: the pack lays its 35 creatures out once per animation frame on a grid 30 wide and 31.2 tall, and a fractional cell cannot be indexed by multiplication.
The script recovers the cell edges from the gaps between content instead, and re-lays each creature one per row, four frames across, centred and standing on a fixed baseline so one anchor serves all 35 — taking the box across a creature's four frames together, or the re-cut would flatten out its bob.
It also prints `MON_ART_TOP`, since where each creature reaches up its cell is knowable only at the cut.
Re-run it if the pack is ever updated — the cut is deterministic, so an unchanged pack rewrites the same bytes — and paste that list back; the original sheet stays alongside it, untouched.

## What a kill is worth

`gems.ts` is Peaceful Plains' experience: a blue gem per *heart* the felled monster had, popped out of the body and left lying until the hero walks over it.
A creature is worth what it cost to bring down, so the ladder's tougher waves pay for themselves and the grind never outruns the fight.
It is Whispering Woods' logs in the other game's units — cells, and `z` in the elevation levels the hero's own jump uses, falling under the same gravity so a drop reads like anything else in the air.
`attackAt` hands back what it felled so the drop starts where the blow caught the monster rather than where the knockback throws the body, and a gem in flight cannot be swept up: snatching one mid-hop looks like it was never dropped.
It is thrown out along the bearing *away from whoever struck it*, `THROW` further than `PICKUP_RANGE` reaches, so a kill is always worth a short walk rather than landing in the lap of the hero who earned it — `gems.test.ts` pins that pair too.
Several fan out across `SPREAD` around that bearing, each finding its own landing, so a three-heart creature leaves three things to walk over instead of one pile; the fan stays under a half-turn so no gem in it comes down behind the hero.
Where it comes down is settled at the throw rather than found on impact, and walked back in toward the body until it clears water, lava and any terrace of a different height: a gem that had to be jumped for, or fished out of a river, would stall a ladder that gems gate.

The gem is one 10px tile cut out of the Sunnyside 16px tileset (cell 55, 26 — the blue ore nugget), trimmed to its own content so it stands on the bottom of its frame, as `stump.png` and `log.png` are cut.
It draws at 3x rather than the world's 2x, since a 10px sprite beside a 96px tile is otherwise a speck.

## The ladder

`levels.ts` is what Peaceful Plains is played for. A level is one creature, a number of gems to collect before the next, and how many blows each of that creature takes; one dial moves per level, alternating, so neither the grind nor the fight runs ahead of the other:

| level | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| gems | 6 | 8 | 8 | 10 | 10 | 12 |
| hearts | 1 | 1 | 2 | 2 | 3 | 3 |

Since a kill pays a gem per heart, the gem target is really a count of *blows to land* — which is what keeps a rung with a tougher creature from being cleared in half the kills.
A formula rather than a table, so it never runs out of rungs, and `Progress` is where a run sits on it — the target resets each level and the surplus carries, so picking two up at once on 5 of 6 starts the next level on 1.
The hero's own hearts are untouched by any of it: there is no refill, so a long run is a war of attrition.

`MonsterField.setLevel` is the only way in, and it says what the *next* wave is made of: a wave already walking keeps the creature and the hearts it spawned with, so levelling up never re-skins what is on the field.
A blow takes one heart and only the last one kills, which is what makes `attackAt` return a list rather than nothing — a survivor blinks (`HURT`) where the boss would recoil, since the mons pack draws no hurt pose.
One swing lands on a single frame, so nothing can lose two hearts to one blow and a monster needs no immunity window of its own.
Every blow also shoves: a survivor reels (`RECOIL`, `RECOIL_TIME`), neither advancing nor bumping while it does, and the ground it has to make up afterwards is what a player who keeps swinging is buying.
Without it a creature that takes more than one hit charged a heart for each of them — the bump and the blow resolve in the same frame — and no amount of timing could avoid the trade.
The shove is bounded at both ends and `encounter.test.ts` pins both: long enough that the next swing lands before the monster is back at `CONTACT`, short enough that it is still inside `MELEE` when it does.
A killing blow throws the body the whole of `KNOCKBACK` instead, and through terrain, since it is fading out; a shove stops at the water's edge like a walk.
`hearts.ts` draws the row over a head for the monsters and the boss alike; neither game's own heart row in the corner goes through it.

## The boss

`treant.ts` is Whispering Woods' boss: an enemy that takes five blows and shows five hearts over its head while it does.
It holds the state and the sheet; the game holds where it stands.

The sheet is a *grid*, not a strip — Holder's animated battlers are 4x14 cells of 160px, one pose to a row — so `blitFrame` takes a `row`, and the sheet is vendored byte-identical to the pack rather than cut up, which keeps `magick identify` on it matching the download.
The pack ships no origin, but every pose bottoms out on the same line (y=149 despite standing different heights), so that line is the feet.
Two poses are worth knowing: row 11 runs dark-to-lit and is played *backwards*, which is the fire going out, and row 12 is the slumped hold it settles into.
Row 13 is the pack's credit plate and is never drawn.

It is a battler — one facing, front-on, and no walk cycle anywhere in the sheet — which is why the boss is rooted rather than chasing anybody.
A blow landing mid-roar is absorbed rather than staggering it, so a chopper who simply keeps swinging cannot cancel every roar before it finishes.

Whispering Woods has no hearts to take, so there it is a tree: `woods/bossTree.ts` puts it through the same axe, reach and swing clock the ordinary trees go through, and it bursts an armful of logs instead of three.
It roars and lands nothing — what that buys is a tree plainly awake while you are chopping it.
It draws at 2x rather than the world's own density: a 160px battler at Whispering Woods' 4x would be four tiles across.

## Blockpocalypse

`src/blockpocalypse/` is a voxel side-scroller ported whole from its own repo, and it shares nothing with the rest of the playground but the page furniture: no canvas 2D, no spritesheets, no `iso.ts`, no stick.
It draws with three.js — the one runtime dependency, imported from nowhere else, and the reason `blockpocalypse.html` is the only page whose bundle is half a megabyte.
`src/blockpocalypse/CLAUDE.md` is its own documentation and stayed with the code; read that before touching anything inside the folder.

Four things the port changed, and nothing else did:

- **A subfolder, not the shared `src/`.** It brought its own `backdrop.ts`, `input.ts`, `hud.ts` and `world.ts`, each of which the playground already had under that name and meaning something else.
- **Its stylesheet is a `<link>`, not a `<style>` block.** Every other page's own CSS is short enough to inline; 570 lines is not. It loads after the `chrome.css` that `sharedHead.ts` prepends, so it still wins any tie — and the only tie is `canvas { image-rendering: pixelated }`, which costs a WebGL canvas drawn at device resolution nothing.
- **The gun is imported, not in `public/`.** `?url` from `blockpocalypse/assets/` is how it arrived and it needs no base-prefix care: Vite rewrites a bundled asset's URL, which is what `public/` is exactly not.
- **The card carries the way home.** This game has no `ui.ts` menu, so without the link on the card the only way back to the games list is the browser's own back button.

`src/sunnyside/` names the pack's art — around 210 ground brushes and props — as a manifest over the sheets vendored whole in `public/sunnyside/`, so nothing is re-cut and a wrong tile is a number to change.
`ASSETS.md` is the whole story: what an asset is, how to add one, what the pack's own GameMaker project tells you (and the two things it says that are wrong), and why autotiled paths are deferred.
`draw.ts` is the one painter; the island editor and Whispering Woods both go through it, so a cell someone paints is the cell they later walk on.
`library.html` shows the lot, drawn by that same painter off the same manifest — which makes it the answer to "does everything in there actually draw" as well as somewhere to go looking. It is reached from the editor's sidebar, and `catalog.ts` holds the grouping and the search so both can be tested without a document.

## Amelia's Dungeon

`src/dungeon/` is a top-down dungeon crawler ported whole from its own repo: find the chest, clear the dungeon, drop into a harder one, and the score is how deep you got.
It is orthogonal rather than isometric, and brought its own projection, renderer, hero skins, input, stick and menu, so it shares no game code with the rest of the playground.
`src/dungeon/CLAUDE.md` is its own documentation and stayed with the code; read that before touching anything inside the folder.

What the port changed, and nothing else did:

- **A subfolder, not the shared `src/`.** It brought a `main.ts`, `hero.ts`, `renderer.ts`, `input.ts`, `stick.ts`, `ui.ts` and half a dozen more under names the playground already used for something else.
- **Its editor reaches back out for the furniture it arrived with.** `editorUi.ts`, `painter.ts`, `panPad.ts`, `history.ts` and `files.ts` came from this repo in the first place and were still byte-identical, so the copies are gone and `src/dungeon/editor/` imports the originals — which is the "a fourth editor should be reaching for these" rule collecting on itself.
- **`assetUrl` names the whole path under `public/`.** The game no longer owns a folder there: its dungeon art is `dungeon/`, but Amelia herself is `rpg_hero/` and `oboro/mage/`, sitting with the sheets Peaceful Plains already draws from rather than vendored a second time.
- **The overlays measure from `--ww-inset-*`.** The shared head makes every page `viewport-fit=cover`, which the game's own pages were not, so its flat `--ad-inset: 16px` would have put the stick under the home indicator.
- **The menu carries the way home, and fullscreen.** It has its own `createMenu` rather than the shared one, so "All Games" and the `fullscreen.ts` item are wired into that copy.

Its `ad-` class names, its `ad:` storage keys and its `<style>` blocks stayed as they were — the builder's block is `chrome.css`'s own `.ed-*` furniture recoloured off the tileset, and loads after it, so it wins every tie.

## Islands

`woods/island.ts` is what someone built inside Whispering Woods: a brush id per cell and a list of things standing on it.
The island's own shape is never stored — the sea, the water's edge, the bank, its lip and the fence around them all come from the field's size alone — so `buildable` is the only thing that says where a child may paint, and the editor and the file format both defer to it.
Unpainted ground plays as grass, so a half-built island is still somewhere to walk.
Things that lie flat (dug soil, a rug) are their own layer, so a carrot plants *in* the soil rather than beside it; everything else takes its cell to itself.
`woods/ground.ts` draws the island's edge for both pages, and the game hands the editor its island through `handoff.ts` under `ww:island`, keyed off the same `?map=local` query Peaceful Plains uses.

## The island's outline

The coastline `coast.ts` works out from its neighbours is a guess at what somebody wants an island to look like, and describing one in prose was a slow way to find out it was the wrong guess.
`outline.html` hands over the pen: `coastTiles.ts` names every edge tile the pack cut — the grass water's edge and the sand one, the cliff's corners and feet, the ragged grass fringes, the seams, the fence — and the page lays whichever you pick in whichever cell you point at.
Nothing is worked out; `outlineDraw.ts` puts down the tile the cell holds, which is what makes the editor and the game the same picture.
The band outside the fence is all it draws: `editable` stops at `FENCE_RING`, since everything inside is the game's own ground and neither the walker nor the island editor asks the outline's permission.
Unlike the island editor it also zooms and pans (`camera.ts`), because a coastline is drawn a tile at a time along the very edge: the way out stops at the whole island, since there is nothing past it to see, and the way in at four times life size.

A cell is one character, so a saved outline is `FIELD` lines of `FIELD` characters — meant to be read in a diff and pasted into the source the day a drawn island becomes the built-in one.
`grownOutline` writes down what `coast.ts` would have drawn, so the page opens on the island as it stands rather than an empty sea, and drawing is editing.
It reaches the game through `handoff.ts` under `ww:outline` — not by query, unlike a map: the wood wears the last coastline drawn until someone starts over.

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

`src/chrome.css` holds what every page shares — the `--ww-*` custom properties, and the menu, stick, action-pad and tally rules that `ui.ts`, `stick.ts`, `actionPad.ts` and `tally.ts` build against.
A page's own `<style>` block holds only what is that page's, and loads after the shared sheet, so it wins any tie.
Neither lives in the TypeScript.

`tally.ts` is the corner count both games keep: Whispering Woods' logs and Peaceful Plains' gems are the same widget with a different icon.
Nothing up there places itself: `corner.ts` is the one top-left column, and hearts and tally stack in it in the order they were made.
That is what stops the gem count being drawn over the hearts on a screen narrow enough for ten of them to wrap onto a second row.

`sharedHead.ts` is the other half: a `transformIndexHtml` plugin that injects the shared `<head>` — charset, viewport, the Home Screen metas, the link to `chrome.css` — into every Rollup input.
A new page therefore gets the chrome by being listed in `vite.config.ts` and nothing else, which is what `sharedHead.test.ts` pins, along with no page having grown its own copy of a meta.
The injected `<link>` needs the hook to stay `order: "pre"`, or Vite's HTML pass never sees the href to hash it; and it is a `<link>` rather than an import from an entry module because `credits.html` has no script.

Pages are `viewport-fit=cover`, so the layout runs under the notch and the home indicator, and the `--ww-inset-*` properties (never a flat `16px`) are what keep the chrome clear of them.
What actually clears Safari's tab bar on an iPhone is Add to Home Screen, which the injected `apple-mobile-web-app-capable` enables.
Fullscreen is a menu item that hides itself where the API is missing, which on an iPhone it is — `createMenu` adds it for every game rather than taking it as a `MenuActions` entry, since it asks the game for nothing.
Class names are `ww-` prefixed, and the storage keys are `ww:` — from Whispering Woods, which is what this was called before it became a playground with more than one game in it.
The list page is a title and one button per game, borrowing the menu button's shape, and its backdrop is the game's own grass tiles: `backdrop.ts` renders a water-free flat world through `renderer.ts` rather than shipping a second copy of the art.

## What the editors share

There are three — the map editor, the island editor and the outline editor — and they are furnished from the same four modules rather than each keeping a copy.
`editorUi.ts` builds the sidebar: the swatch grid with its single-select bookkeeping, the tool row with its toggles, the tabs, the file buttons, the hint.
`painter.ts` is the drag — press lays down, dragging keeps laying down, the right button rubs out whichever brush is in hand, and letting go ends a stroke.
`panPad.ts` is the compass of arrows over the board's corner, which greys out an arrow when there is nothing that way.
`history.ts` is undo, and takes its own `clone`/`same`, since a snapshot is a `slice` for a drawing of characters and a JSON round trip for a board.

Undo records once per *stroke*, not per cell: `onStroke` is where each editor calls `record`, and a state no different from the last one is not a step.
A board that arrives whole — opened from a file, loaded from the game — calls `reset` instead, so undo cannot walk back into somebody else's map.
The `.ed-*` class names all live in `chrome.css`; a page's own `<style>` holds only what is that page's, which is why the map editor's height stepper is still in `editor.html`.
A fourth editor should be reaching for these, and anything it has to build for itself is a sign one of them is missing a part.
