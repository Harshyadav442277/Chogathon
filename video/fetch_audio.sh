#!/bin/sh
# Downloads the sound libraries used by the demo video into assets_audio/ (not committed). All are free to use in videos:
# Kenney.nl packs and the OpenGameArt swishes are CC0; the Mixkit effects fall under the Mixkit Sound Effects Free License;
# the music bed is "Guardians" by Aylex from Free To Use (credit in the video description, see docs/DEMO_VIDEO.md).
cd "$(dirname "$0")"
mkdir -p assets_audio/zips assets_audio/mixkit assets_audio/lib
cd assets_audio/zips
for u in \
 "https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip" \
 "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip" \
 "https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip" \
 "https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip" \
 "https://kenney.nl/media/pages/assets/sci-fi-sounds/6b296f9ecf-1677589334/kenney_sci-fi-sounds.zip" \
 "https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip" \
 "https://opengameart.org/sites/default/files/swishes.zip"; do curl -sL -O "$u"; done
cd ../mixkit
for id in 1492 1486 2638 1474 2615 790 2283 788 2908 2900 1143 871 2344 270 2633 3062 582; do
  curl -sL -o "mixkit_$id.mp3" "https://assets.mixkit.co/active_storage/sfx/$id/$id-preview.mp3"
done
cd ..
python -I -c "
import zipfile, os
for z in sorted(os.listdir('zips')):
    dest = os.path.join('lib', z[:-4]); os.makedirs(dest, exist_ok=True); root = os.path.realpath(dest)
    zf = zipfile.ZipFile(os.path.join('zips', z))
    for m in zf.infolist():
        t = os.path.realpath(os.path.join(dest, m.filename))
        if t.startswith(root) and not m.is_dir():
            os.makedirs(os.path.dirname(t), exist_ok=True); open(t, 'wb').write(zf.read(m))
"
echo "Also copy the music bed to assets_audio/guardians.mp3 (Aylex - Guardians, freetouse.com/music)."
