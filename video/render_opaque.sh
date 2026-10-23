#!/bin/sh
# Renders the full-screen motion-design scenes to JPEG sequences in build/frames/.
cd "$(dirname "$0")"
node render.mjs intro build/frames/intro 17.0 30 jpg
node render.mjs concept build/frames/concept 22.8 30 jpg
node render.mjs web build/frames/web 9.8 30 jpg
node render.mjs never build/frames/never 12.7 30 jpg
node render.mjs outro build/frames/outro 9.6 30 jpg
echo "opaque scenes rendered"
