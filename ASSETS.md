# The Sunnyside asset library

`src/sunnyside/` names the art in the [Sunnyside World pack](https://danieldiggle.itch.io/sunnyside)
so a game or an editor can ask for "a red cottage" rather than for a rectangle of
a PNG. It is a manifest over the vendored sheets: nothing is re-cut, so a wrong
tile is a number to change rather than an image to re-export.

- `sheets.ts` — the vendored sheets, their cell size and how many cells they hold.
- `library.ts` — the shapes: `Ground`, `Prop`, `Art`, and the geometry helpers.
- `manifest.ts` — the data. Around 210 named assets in ten categories.
- `draw.ts` — painting one onto a canvas. The editor and the game both come
  through here, so a cell someone paints is the cell they later walk on.

## What an asset is

A **`Ground`** brush paints one cell. It carries a few `variants`, and
`variantAt` picks between them by position, so a painted field does not read as a
pattern. `solid` keeps the walker off it — only the two waters set it.

A **`Prop`** stands on the ground and covers a `w` x `h` footprint of cells.

```ts
{
  id: "cottage-red",
  label: "Red Cottage",
  category: "houses",
  w: 5, h: 4,
  base: { dx: 0, dy: 3 },   // the footprint cell it stands on
  art: { kind: "tiles", sheet: "tileset", tiles: [{ dx: 0, dy: 0, col: 15, row: 33 }, …] },
  solid: "all",             // "base" blocks its bottom row, "none" nothing
  layer: "flat",            // optional: lies flat, so something can stand on it
}
```

`base` is the cell the cursor holds it by and the cell it draws from, so a tree's
base is its trunk and its crown hangs into the cell above. `footprint` and
`solidCells` turn that into cells; `drawOrder` puts what lies flat under what
stands on it.

Art comes in three kinds:

- `tiles` — 16px tiles laid on the grid, offset from the footprint's top-left.
- `tileStrip` — one tile that animates along its row, as the pack's own tile
  animations do (5 fps).
- `sprite` — a strip of frames anchored on the middle of the base cell.

## Adding one

Find the tile on the sheet, add an entry, and the palette picks it up — the
editor lists whatever is in the manifest under a category. `library.test.ts`
checks every rect is inside its sheet, every prop's tiles are inside its own
footprint, every id is unique and every category is filled, so a typo fails the
suite rather than drawing the wrong thing.

Anything new that is not already in `CREDITS.md` and `credits.html` goes there.

## What the pack told us, and what it did not

The pack ships a GameMaker project, and it is ground truth for anything it says.
`Sunnyside_World_Gamemaker/` holds:

- **`tilesets/tileset_sunnysideworld.yy`** — eleven named autotile sets (`Land`,
  `Building 01/02`, `Inner Walls`, `Path 01–03`, `River`, `Clouds 01/02`,
  `Cloud Shadow`), each 16 tiles, and 25 tile animations at 5 fps. The sheet
  gives no hint that a tile is animated; the extra frames just look like unused
  duplicates.
- **`rooms/Room1/Room1.yy`** — the example scene as tile layers. Its buildings
  are assembled correctly, which is where the house stamps here come from: each
  is one of its buildings, trimmed to the tiles inside its colour block.
- Tile index → sheet position is `col = idx % 64`, `row = idx / 64`. Transform
  bits are `0x10000000` flip vertical, `0x20000000` mirror horizontal,
  `0x40000000` rotate. `.yy` files are JSON5-ish — strip trailing commas.

Two things the pack states that are **not** to be trusted:

- **Sprite origins.** Several deco sprites record a frame centre and
  `spr_deco_tree_01` records (0, 0). Every anchor in the manifest is measured off
  the union of a strip's frames instead.
- **The tileset's own metadata for the character sheets** — see `CLAUDE.md`.

Frame counts and playback speeds in the `.yy` files *are* reliable.

### The five house colours

The building block spans cols 15–34 and repeats every eight rows in blue (row 9),
green (17), orange (25), red (33) and purple (41). The five bands are
pixel-identical apart from nine cells, so a house stamp is authored once against
the blue band and its colours are a row offset. That is why there are sixty
houses for twelve shapes.

### Autotiling, deferred

The autotile sets are corner sets: a slot is indexed by which of a tile's four
corners the terrain does not cover (NW 1, NE 2, SW 4, SE 8). Checked against the
example room, horizontally and vertically adjacent tiles agree on their shared
corners 99–100% of the time.

Knowing that is not enough to paint with them. The path and river sets are cut as
*overlays for the cells outside the path*, feathering inwards over it — lay one
on the path itself and the grass fringe lands on the wrong side of the boundary.
Rendering the same shape under every reading of the mapping showed it plainly.
So `path`, `path-brown`, `path-pale` and `river` are plain fills for now, with
square edges, and the feathering is a job for whoever wants it.

## Where the art is

`public/sunnyside/` holds the two tilesets whole (`tileset.png`,
`forest.png`) and one file per sprite strip. The strips the game cut before this
library existed — `grass.png`, `tree.png`, `shore.png` and the rest — are still
there and still used by `woods/main.ts` and `woods/ground.ts`.

Sheets load through `sheetUrl`, which goes via `import.meta.env.BASE_URL`: the
site deploys to a GitHub project page served from `/<repo>/`, so a root-absolute
path 404s in production.
