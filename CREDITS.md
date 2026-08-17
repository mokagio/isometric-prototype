# Credits

- [Isometric Fantasy](https://raou.itch.io/free-isometric-tiles-v)
- [Dungeon Hero](https://pixel-poem.itch.io/dungeon-hero)
- [Pixel Mons](https://akoro.itch.io/pixel-mons-35-monsters-size-24x24-free) — Peaceful Plains enemies
- [Characters Animations Asset Pack](https://oboropixel.itch.io/characters-animations-asset-pack)
- [Sunnyside World](https://danieldiggle.itch.io/sunnyside) — Whispering Woods, and Peaceful Plains' gems
- [Holder's Animated Battlers: Free Enemies](https://holder-anibat.itch.io/holders-animated-battlers-free-enemies-pack-1) — the treant boss
- [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) — SIL Open Font License, text in `public/fonts/OFL.txt`
- [Voxel Weapons](https://stonedeadshred.itch.io/voxel-weapons) — the rifle Blockpocalypse's figures carry
- [DungeonTileset II](https://0x72.itch.io/dungeontileset-ii) — CC0, Amelia's Dungeon: the dungeon itself, its chest, and the weapons
- [Dungeon Asset Pack](https://pixel-poem.itch.io/dungeon-assetpuck) — Amelia's Dungeon enemies: the skeletons and the vampire
- [three.js](https://threejs.org/) — MIT, the only runtime dependency, and only Blockpocalypse uses it

## Redistribution

`public/oboro/` holds oboropixel art from two packs.
The slime and the soldier hero skin come from the free Characters Animations
pack and are committed like any other art here.
Amelia's mage comes from the paid pack, which is licensed for use and
modification, personal or commercial, but **not** for redistribution or resale,
so those four sheets are committed **encrypted** — `public/oboro/mage/*.png.age`
— and the plaintext is gitignored.

What that draws the line around is the repository, not the running game.
Shipping the game is the licensed use, and no browser game can withhold its
pixels from the player's machine; what a licence like this is about is a public
tree of tidily-named sheets that lift straight back out as a pack.
So the deployed site serves the mage and the repo does not carry her in the
clear.

`npm run art:keygen`, `art:encrypt` and `art:decrypt` are the whole of it, and
the deploy runs the last of those with the `AGE_KEY` secret.
A clone without the key still builds and still plays, just without that one
skin.
