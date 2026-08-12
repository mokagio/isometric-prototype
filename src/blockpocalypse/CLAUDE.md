# Blockpocalypse

A voxel side-scroller: run right through a ruined city, shoot the zombies, and
use the grappling hook to swing over what you cannot jump.
three.js is its own, and the playground's only runtime dependency: nothing else here imports it.

Ported whole from its own repo, so this file is the game's and the root `CLAUDE.md` is the site's.
The page is `blockpocalypse.html`, an entry in `games.ts` and a Rollup input like any other; what the port changed is written down there.

## The split that everything else follows

**The simulation never imports three.js, and the renderer never decides anything.**
`game.ts` owns the whole game state and `stepGame` advances it from an `InputState` and a `dt`; give it the same seed and the same inputs and it plays the same game.
That is what makes `game.test.ts` able to walk a player across the opening city in a node test with no canvas anywhere.

`render.ts` reads that state and draws it. It holds no gameplay rule, not even a clamp.
`input.ts` is the mirror image: `InputState` and `emptyInput` are plain data the tests build by hand, and `createInput` — the half that touches `window` — is never called from a test.

Tests run in Vitest's node environment; there is no jsdom, so a test that needs `document` does not belong here.

**A press the simulation cannot see does not go in `InputState`.** Pause, restart and dismissing the instruction card are the loop's business, so they come off the `InputSource` as `takePause`, `takeRestart` and `takeAnyPress` — each reports true once and forgets. That is not tidiness: `endFrame` runs per *tick*, and a paused frame runs no ticks, so an edge parked in `InputState` would sit there until the game unpaused and then fire.

Pausing is `main.ts` skipping `stepGame` and zeroing the accumulator; the game state is untouched, and `render` still runs so the scene stays live under the card.

## Tuning is exported

`RUN_SPEED`, `JUMP_SPEED`, `HOOK_RANGE`, `SWING_ACCEL`, `WAKE_RANGE` and the rest are named exports, and the tests refer to the constant rather than the number.
A new dial is a named export, and its test says its name.

## Coordinates

One block is one unit. `y` grows upwards — the opposite of a canvas, the same as the scene.
A `Body` is `x` at its **centre** and `y` at its **feet**, which is also where a figure's `group.position` goes and where every spawn point in `level.ts` is measured.

The world grid is a flat `Uint8Array` in `world.ts`. Left of column 0 is solid so nobody walks out of the level; everywhere else outside is air, and falling below `DEATH_Y` is a death.

## Depth

Blocks are drawn a whole unit *behind* the plane the living stand on (`CITY_Z` vs `ACTOR_Z` in `render.ts`).
Dead-on that would not matter, but the camera is a few degrees off axis — otherwise a cube is a square and nothing reads as voxels — and at that angle a figure sharing the wall's plane is half-buried in it.
The aim plane the pointer unprojects onto is `ACTOR_Z`, so the crosshair sits where the player does.

## What the renderer is allowed to keep

One `InstancedMesh` holds the whole city, one instance per block that exists **when the level is built**.
Nothing in the game turns air back into a block, so a cell that starts empty never needs a slot, and breaking a window collapses its instance to zero scale rather than rebuilding twenty thousand matrices.
`World.set` pushes the changed cell onto `world.dirty` and `drainBrokenBlocks` empties it; anything else that starts editing the world has to keep that contract.

Figures are turned round with `rotation.y`, never a negative scale — mirroring turns the normals inside out and the lighting goes with them. `faceFigure` then swaps the gun arm to the near side by hand, or it ends up behind the body.

## What a person is made of

`figure.ts` is a table of bricks, not a tree of meshes: `TORSO_BRICKS`, `HEAD_BRICKS`, `LEG_BRICKS` and `ARM_BRICKS` say where every box sits in its own part's space, and each part is **merged into one geometry** carrying a colour per vertex.
Six meshes come out — two legs, two arms, a torso and a head — because that is how many things move on their own, and `MAX_ZOMBIES` is thirty: a mesh per brick would be five hundred draw calls for a handful of people.
A brick therefore names a `ROLES` entry rather than a colour, and `paintFigure` looks that role up in a palette and rewrites the colour attribute.
That is what lets the pool hand the same body to a walker on one frame and a runner on the next; `render.ts` keeps `poolKind` so it repaints on the change rather than every frame.

Two things the detail has to survive, both of which it got wrong first:

- **A figure walking away is the back of its head.** Facing west spins the whole group, so the hair down the back only covers its top half — a full-height slab leaves a figure with no head at all from behind.
- **Anything on the face is a brick standing proud of it**, not a coplanar decal: the eyes and mouth sit at z 0.225 against a face at 0.22, which is the difference between a feature and a z-fight.

The origin of a limb is the joint it swings about, so a leg's bricks hang below zero and `animateWalk` rotates about the hip.
The whole model is `MODEL_HEIGHT` tall and scaled to the body it is given, so the feet stay on `group.position` — `figure.test.ts` pins that with a bounding box rather than trusting the arithmetic.

## The level, and what generation must guarantee

`generateLevel(seed)` lays a street and then walks left to right dropping set pieces: gaps, gutted buildings, scaffolding, rubble.
Later sections overwrite earlier ones, which is why `standable` exists — spawn points that end up walled in are filtered out at the end rather than waking a zombie inside a brick.
`level.test.ts` asserts that invariant for the spawns, the checkpoints and the player's own start.

Three rules the road has to keep, each of which has already been broken once and is now pinned by a test:

- **No pit before `NO_PITS_BEFORE`.** A collapsed street is the only thing that kills outright, and one opening 14 blocks in killed anyone who just held right, over and over.
- **A rubble mound rises and falls one block at a time.** Sloping only one way made it a five-block wall from the west, which is unjumpable and needs the hook to pass.
- **Fire escapes zig-zag.** A ledge straight above another one is a ceiling to bang your head on, so the rungs alternate between `x - 2` and `x - 1`.

The hook is a shortcut everywhere, never the only way through anything before the extraction tower — which is the one climb that is meant to need it.

## Drawing the world

`city.ts` builds the world as **merged geometry, one mesh per 32-column chunk**, not as instanced cubes: only faces with nothing opaque against them are emitted, and every vertex carries its own shading. `World.set` pushes the changed cell onto `world.dirty`, and `city.update` rebuilds only the chunks those cells fall in — plus the neighbour when the cell sits on a seam, since corner shading reads across it.

Shading is three things multiplied: a fixed level per face (`FACE_SHADE`), a per-cell jitter, and **corner shading on the front face**. That last one is the usual ambient-occlusion trick turned sideways: nothing can ever stand in front of a block here, so there is nothing to occlude it, and instead the eight cells *around* it in the plane decide how dark each corner is. It draws a bright rim along every silhouette and sinks the middle of a wall back.

`World.back` is a second grid one layer behind, drawn dim and flat. It is the room a doorway leads into; without it every window is a hole through to the skyline.

Blocks that `glow` go into a second mesh with an unlit material, so a lit window or a laser is its own light source rather than something the lamp has to reach.

## What a block looks like

`textures.ts` paints the atlas at load — one 16×16 tile per block, all colour in the tile so a mesh's vertex colours stay pure shading. **Each tile is clipped to its own 16 pixels.** A running bond has to lay bricks that run off both edges to come out seamless, and unclipped those strokes land on whichever tiles happen to sit next door: the brick painter was quietly repainting concrete and sidewalk as brick, and it took looking at a screenshot to notice.

One tile cannot read as a beam in both directions — the core has to run along it — so a laser is two blocks, `LASER` and `LASER_UP`.

## Gear

A run is played with exactly one `Ability` — `"hook"` or `"jetpack"` — picked from the card before it starts.
It lives on `Player` and nowhere else, so there is no second copy to disagree with: `createGame` passes it to `createPlayer`, and `respawn` reads it off the player it is about to replace.

`stepPlayer` branches on it in two places and no more — the hook step, and the thrust step. Everything else (running, jumping, shooting, taking a hit) is the same either way, and adding a third piece of gear should stay that cheap.

The jetpack's thrust runs *after* the jump so the two stack into one climb, and it only pushes a body already rising slower than `JET_MAX_RISE`, so it never brakes the jump underneath it. Fuel is seconds of burn, refilled by standing on anything solid.

The card is both the title screen and the pause menu (`CardMode`), and its three buttons are the same control in both: picking always starts a fresh run. Before anything is picked there is nothing to resume, so Escape and stray keypresses do nothing — only the buttons start the game. What runs behind the opening card is a backdrop played with `BACKDROP_PICK` and thrown away on the first pick.

`picks.ts` is the one place that says what each button means, so the card, the loop and the HUD all speak in the same three words.

## The joyride

A different game sharing the same engine: `generateJoyride` builds a tunnel instead of a street, `flyOn` replaces the walking and jumping, and the rest — physics, bullets, zombies, particles, HUD — is untouched.

Two rules make it work, and both are pinned by tests in `joyride.test.ts`:

- **Nothing in the corridor is solid.** At that pace a single block to bump into is a run over, so every obstacle is a hazard you fly through and regret. Scenery is either walked through or painted on the back wall — the first version dropped a steel block on the floor and the test caught it.
- **Every column has a way past.** `reachable` flies the whole tunnel on paper, one column at a time, allowing less vertical movement than the real jetpack has, so a level it passes has room to spare.

There is no aiming: `stepPlayer` forces the aim east, and the gun has no recoil there because a gun that slows the auto-run turns "shoot the thing" into a trade nobody asked for. Contact with a hazard and picking up a coin both go through `sweepCells`, reading the grid the body is standing in — a beam of any length costs nothing to collide with that way.

On a touch screen the two pads *are* the game. `bindPad` feeds the same flags the keys do, which is why `sync` ORs pad and key state together rather than assigning: a pad press was otherwise undone by the next keyboard sync.

## The chrome

`style.css` opens with the palette, and it is the world's own: the beacon's green, the jetpack's amber, the blood red of a lost heart, the night the sky fades to. Anything new picks from those tokens rather than adding a hex, or the overlay stops looking like it belongs to the city underneath it.

Hearts and the two gear icons are **CSS masks over a solid colour**, not fonts, images or characters — the SVG is a handful of `rect`s on a small integer grid with `shape-rendering='crispEdges'`, so they are drawn from the same squares the world is and recolour from a token. `♥` in a monospace font was the alternative, and it looked like a text editor.

The fuel gauge is a plain bar with notches laid over it by a repeating gradient, so it empties in blocks without the DOM needing one element per block.

## The rope

`grapple.ts` is the maths and nothing else: `raycast` walks the grid a cell at a time (Amanatides & Woo) so a hook, a bullet or a line of sight can never skip a block, and `applyRope` holds a point at the rope's length while spending only the part of its velocity that pulls *away* along the rope.
Spending the outward component is the whole trick — it is what turns a fall into a swing, and why the swing keys push **sideways** rather than along the tangent. Pushing along the tangent would need a sign rule for hanging above the anchor and would feel like steering.

The hook flies rather than snapping on: `stepHook` raycasts immediately to find where it will land, then moves the tip there at `HOOK_SPEED`. The player keeps falling while it travels, so the rope's length is set by where they are when it bites, not where they aimed from.
