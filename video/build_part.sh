#!/bin/sh
# Rebuilds the scenes named on the command line (default: concept), then the picture and the final video (audio unchanged).
cd "$(dirname "$0")"
for s in ${*:-concept}; do
  case $s in
    intro) node render.mjs intro build/frames/intro 17.0 30 jpg ;;
    concept) node render.mjs concept build/frames/concept 22.8 30 jpg ;;
    web) node render.mjs web build/frames/web 9.8 30 jpg ;;
    never) node render.mjs never build/frames/never 12.7 30 jpg ;;
    outro) node render.mjs outro build/frames/outro 9.6 30 jpg ;;
    *) sh render_overlays.sh $s ;;
  esac
done
python assemble.py video ${*:-concept}
python assemble.py final
echo BUILD-COMPLETE
