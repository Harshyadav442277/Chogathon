# Demo video

The submission video is produced by scripts in [`video/`](../video) from the real, deployed game. Nothing in it is mocked: the gameplay is the actual client talking to https://chogsekai.vercel.app, recorded frame by frame; the voices are AI text-to-speech; the motion design is HTML and GSAP rendered through Chrome. The organizer's limit is three minutes ([RULES.md](../RULES.md)); the cut is 2:51.

| Part | How | Free service or tool |
|---|---|---|
| Gameplay | A dev-only "demo director" ([`game/scripts/dev/demo_director.gd`](../game/scripts/dev/demo_director.gd)) drives the real game (camera flights, selecting a Chog, the Life Story window, a judge sign-in, a Star Pull, the Chronicle) with a drawn cursor. Godot's Movie Maker captures it at 1920x1080, 30 fps | Godot 4.7 `--write-movie` |
| Voices | Six AI voice actors from [`video/script.json`](../video/script.json): narrator, guide, Orrun the lynx, the Demon King, the Star Peddler and a child | Microsoft Edge neural voices through `edge-tts` (free, no account) |
| Motion design | Intro, concept explainer, architecture card, end card, plus transparent overlays (region cards, callouts, step tracker, premise cards). Pages are paused GSAP timelines seeked frame by frame in Chrome | GSAP, Playwright (driving the installed Chrome), Google Fonts (Cinzel, Inter: SIL OFL) |
| Music and effects | Music bed: "Guardians" by Aylex ([Free To Use](https://freetouse.com/music)), ducked under the voices. Sound effects are real library recordings placed from the real timings (overlay events, recording marks, spoken words) in [`video/soundtrack.py`](../video/soundtrack.py): [Kenney.nl](https://kenney.nl) Interface, RPG, Casino, Impact and Sci-fi packs (CC0), the OpenGameArt swishes (CC0), and 17 [Mixkit](https://mixkit.co/free-sound-effects/) cinematic effects (whooshes, risers, impacts, sparkles; free license, no attribution) | Python (numpy, scipy); [`video/fetch_audio.sh`](../video/fetch_audio.sh) re-downloads the libraries |
| Edit and encode | Scenes, overlays, mix, captions and loudness (-16 LUFS) in [`video/assemble.py`](../video/assemble.py) | ffmpeg (via `imageio-ffmpeg`) |

## Scenes (2:51)

| Time | Scene | Shows | Voice |
|---|---|---|---|
| 0:00 | Intro | The crossroads, 1,969 counting up, the title | Narrator |
| 0:17 | Concept | The NFT wall, a Chog becoming an agent, jobs every season, the season arc to a Hero, "you are a Constellation" | Guide |
| 0:40 | World | A flight over the Hive Capital, Emberforge, Tidecry, Prism and the Hollow; the Star Stream | Narrator |
| 1:01 | A Chog | Status with the real NFT picture, then the Life Story window | Guide |
| 1:24 | Star Pulls | Judge sign-in (the code is masked), a pull, four cards, choose one, bestow | Narrator, Peddler |
| 1:47 | Chronicle | The eight premises, with Orrun, the Demon King and a child speaking | Guide, Orrun, King, Child |
| 2:19 | One address | The real site in a browser window: loader, title screen, Enter Monadia, the world (captured from the live deployment) | Narrator |
| 2:29 | Never the same twice | 8 premises, 191 story beats, 1,969 life stories; "no two seasons read alike" | Narrator |
| 2:42 | End card | "Be the god in their story.", the URL, how holders and judges sign in | Narrator |

The voices are AI-generated; say so in the video description.

## Rebuild

```sh
pip install edge-tts imageio-ffmpeg        # numpy, scipy, pillow, pydub are also used
cd video && npm install                    # playwright-core, gsap (uses your installed Chrome)
sh prepare.sh --capture                    # key art, GSAP, and real captures of the live site (web scene)
python tts.py                              # voices and word timings -> build/voice
python sfx.py                              # synthesized effects -> build/sfx
sh render_opaque.sh                        # intro, concept, tech, outro frames
sh record.sh                               # gameplay scenes (Godot Movie Maker; needs chog-hivemind/.env.deploy for the judge code)
python make_overlays.py && sh render_overlays.sh
python assemble.py all                     # -> video/out/ChogSekai_demo.mp4 and .srt
```

`record.sh` temporarily writes `game/override.cfg` (1920x1080 viewport) and removes it afterwards; the judge code is read from the ignored `.env.deploy` and is never printed or stored in the video (the field is masked). Recording runs at about 10% of real time. Outputs under `video/build` and `video/out` are git-ignored.

## Status

The pipeline was run locally on 2026-10-23. The video has not been uploaded anywhere by this repository's scripts: it still has to be uploaded (unlisted YouTube or Google Drive) and the link checked while signed out before it is entered in the submission form ([SUBMISSION.md](SUBMISSION.md)).

## Credits for the video description (required by the music licence)

> Music: "Guardians" by Aylex, from https://freetouse.com/music (Free To Use).
> Sound effects: Kenney.nl (CC0), OpenGameArt (CC0), Mixkit (Mixkit Sound Effects Free License).
> Voices: AI text-to-speech (Microsoft neural voices).
