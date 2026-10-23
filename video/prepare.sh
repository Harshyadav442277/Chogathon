#!/bin/sh
# Copies the shared inputs the motion pages use (the key art and GSAP) and captures the live site for the web scene.
cd "$(dirname "$0")"
mkdir -p mograph/assets build/gameplay build/frames
cp ../game/assets/title.jpg mograph/assets/title.jpg
cp node_modules/gsap/dist/gsap.min.js mograph/gsap.min.js
[ "$1" = "--capture" ] && node capture_web.mjs
echo "prepared"
