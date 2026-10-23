#!/bin/sh
# Records the scripted gameplay scenes with Godot's Movie Maker at 1920x1080 / 30 fps into build/gameplay/<scene>.avi.
# Usage: sh video/record.sh [scene ...]   (default: fly chog pulls chronicle). Reads the judge code from
# chog-hivemind/.env.deploy (never printed) for the pulls scene.
cd "$(dirname "$0")/.."
G="${GODOT_BIN:-C:/Users/avara/tools/godot/Godot_v4.7.2-stable_win64_console.exe}"
API="${DEMO_API:-https://chogsekai.vercel.app}"
printf '[display]\n\nwindow/size/viewport_width=1920\nwindow/size/viewport_height=1080\n' > game/override.cfg
JUDGE=$(grep '^JUDGE_CODE=' chog-hivemind/.env.deploy | cut -d= -f2-)
for scene in ${*:-fly chog pulls chronicle}; do
  echo "== $scene"
  "$G" --path game --rendering-driver opengl3 --write-movie "$PWD/video/build/gameplay/$scene.avi" --fixed-fps 30 -- --api="$API" --demo="$scene" --judge="$JUDGE" 2>&1     | grep -E "ERROR|SCRIPT ERROR|frames at|^MARK" | tee "$PWD/video/build/gameplay/$scene.marks" 
done
rm -f game/override.cfg
echo "recorded"
