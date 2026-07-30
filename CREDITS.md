# Credits

- [Isometric Fantasy](https://raou.itch.io/free-isometric-tiles-v)
- [Dungeon Hero](https://pixel-poem.itch.io/dungeon-hero)
- [Pixel Mons](https://akoro.itch.io/pixel-mons-35-monsters-size-24x24-free)
- [Characters Animations Asset Pack](https://oboropixel.itch.io/characters-animations-asset-pack)
- [Sunnyside World](https://danieldiggle.itch.io/sunnyside) — Whispering Woods. `public/sunnyside/` holds the character strips flattened out of the pack's layers:

  ```
  magick base_walk_strip8.png shorthair_walk_strip8.png -composite public/sunnyside/walk.png
  magick base_idle_strip9.png shorthair_idle_strip9.png -composite public/sunnyside/idle.png
  magick base_axe_strip10.png shorthair_axe_strip10.png -composite tools_axe_strip10.png -composite public/sunnyside/axe.png
  ```

  `tree.png` is `spr_deco_tree_01_strip4` and `shadow.png` the pack's `spr_deco_charactershadow`.
  `grass.png` is four 16px tiles cut from `spr_tileset_sunnysideworld_16px.png`, and `stump.png` is what is left of a tree once its crown is cropped off:

  ```
  magick public/sunnyside/tree.png -crop 32x11+0+23 +repage public/sunnyside/stump.png
  ```

- [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) — SIL Open Font License, text in `public/fonts/OFL.txt`
