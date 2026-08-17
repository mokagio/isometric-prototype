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

Almost every pack above allows free and commercial use and modification, and
forbids redistributing or reselling the art itself.
0x72's tileset is the exception, being CC0.
Paid or free makes no difference to that clause: the name-your-own-price packs
say it as plainly as the bought one.

What it draws a line around is the repository, not the running game.
Shipping the game is the licensed use, and no browser game can withhold its
pixels from the player's machine; what these terms are about is a tree of
tidily-named sheets that lift straight back out as a pack.

One pack is treated differently, and on harm rather than on terms.
Amelia's mage is from oboropixel's **paid** pack — the only art here that is not
also a free download — so a copy sitting in a public repo stands in for a
payment, where a copy of anything else stands in for a free click.
Those four sheets are committed encrypted, as `art-secrets/oboro/mage/*.png.age`,
and their plaintext under `public/` is gitignored.
The ciphertext is kept out of `public/` because Vite copies that directory
wholesale, and serving players the encrypted copy of the art they are already
being shown is pure weight.

`npm run art:keygen`, `art:encrypt` and `art:decrypt` are the whole of it, and
the deploy runs the last of those with the `AGE_KEY` secret.
A clone without the key still builds and still plays, just without that one
skin.
