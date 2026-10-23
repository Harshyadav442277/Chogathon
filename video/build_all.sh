#!/bin/sh
# Rebuilds everything that changes with the script: frames, overlays, clips, audio and the final video.
cd "$(dirname "$0")"
node render.mjs never build/frames/never 12.7 30 jpg
node render.mjs outro build/frames/outro 9.6 30 jpg
python make_overlays.py
sh render_overlays.sh fly
python assemble.py video intro pulls fly never outro
python assemble.py audio
python assemble.py final
echo BUILD-COMPLETE
