#!/bin/sh
# Renders the transparent overlay sequences (callouts, region cards, step trackers, premise cards) for the gameplay scenes.
# Usage: sh render_overlays.sh [scene ...]   (default: fly chog pulls chronicle)
cd "$(dirname "$0")"
for s in ${*:-fly chog pulls chronicle}; do
  d=$(node -e "console.log(require('./overlays/$s.json').duration)")
  rm -rf build/frames/ov_$s
  node render.mjs overlay build/frames/ov_$s $d 30 png overlays/$s.json
done
echo "overlays rendered"
