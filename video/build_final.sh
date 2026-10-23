#!/bin/sh
# End card + picture + new sound design + final encode.
cd "$(dirname "$0")"
node render.mjs outro build/frames/outro 9.6 30 jpg
python assemble.py video outro
python assemble.py audio
python assemble.py final
echo BUILD-COMPLETE
