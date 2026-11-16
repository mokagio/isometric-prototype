#!/usr/bin/env bash

set -euo pipefail

# Cuts the seaside game's sheets out of the Sunnyside World pack.
# Usage: scripts/vendorSeaside.sh /path/to/Sunnyside_World_ASSET_PACK_V2.1

pack="${1:?path to Sunnyside_World_ASSET_PACK_V2.1}/Sunnyside_World_Assets"
out="$(cd "$(dirname "$0")/.." && pwd)/public/seaside"
mkdir -p "$out"
human="$pack/Characters/Human"
crops="$pack/Elements/Crops"

# The kid is the base body under short hair, as in Whispering Woods' walk and idle;
# these also carry the tools layer, which is the rod, the can and the shovel.
kid() {
  local folder="$1" name="$2" frames="$3" to="$4"
  magick "$human/$folder/base_${name}_strip${frames}.png" \
    "$human/$folder/shorthair_${name}_strip${frames}.png" -composite \
    "$human/$folder/tools_${name}_strip${frames}.png" -composite "$out/$to.png"
}
kid CASTING casting 15 cast
kid WAITING waiting 9 wait
kid REELING reeling 13 reel
kid CAUGHT caught 10 caught
kid DIG dig 13 dig
kid WATERING watering 5 water

# Crops: a row each, six 16px cells from seed to picked, standing on the bottom middle.
rows=()
for crop in carrot radish cabbage pumpkin; do
  row="$out/.row-$crop.png"
  magick "$crops/${crop}_00.png" "$crops/${crop}_01.png" "$crops/${crop}_02.png" \
    "$crops/${crop}_03.png" "$crops/${crop}_04.png" "$crops/${crop}_05.png" \
    -background none -gravity south -extent 16x16 +append "$row"
  rows+=("$row")
done
magick "${rows[@]}" -append "$out/crops.png"
rm -f "${rows[@]}"

# Dug soil, dry then watered; and the things you carry: a fish, an egg, a seed bag.
magick "$crops/soil_00.png" "$crops/soil_01.png" -background none -gravity south -extent 16x16 +append "$out/soil.png"
magick "$crops/fish.png" "$crops/egg.png" "$crops/seeds_generic.png" -background none -gravity center -extent 16x16 +append "$out/items.png"
