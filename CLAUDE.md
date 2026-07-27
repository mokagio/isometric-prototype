# Whispering Woods

An isometric browser prototype: TypeScript, Vite, no framework, no runtime dependencies.
Two pages — the game (`index.html`) and a world editor (`editor.html`) — both listed as Rollup inputs in `vite.config.ts`.

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

Any new art goes in `CREDITS.md`.

## UI chrome

Overlay styles live in the `<style>` block in `index.html`, not in the TypeScript.
Shared sizing goes through the `--ww-*` custom properties defined on `:root` so the stick, action pad, and menu stay in step.
Class names are `ww-` prefixed.
