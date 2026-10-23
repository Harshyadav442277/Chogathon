"""The video's sound design: every effect is a real recording from the CC0 / free libraries in assets_audio
(Kenney.nl Interface, RPG, Casino, Impact and Sci-fi packs; OpenGameArt swishes; Mixkit cinematic effects), placed from the
real clocks: the overlay events, the gameplay recording marks (through the speed segments) and the spoken words.

build_cues() -> list of (samples, absolute seconds, gain in dB). assemble.mix_audio() sums them and adds the voices and the music bed."""
import json
import os

import numpy as np

import assemble as A
import sfxlib as L

HERE = os.path.dirname(os.path.abspath(__file__))
SC = {s["id"]: s for s in A.SCENES}
S = A.starts


def marks(scene, fallback=None):
    out = dict(fallback or {})
    path = os.path.join(A.B, "gameplay", scene + ".marks")
    if os.path.exists(path):
        for l in open(path):
            if l.startswith("MARK "):
                _, name, t = l.split()
                out[name] = float(t)
    return out


def to_scene(scene, raw):
    t = 0.0
    for r0, r1, d in SC[scene]["segs"]:
        if raw <= r1:
            return t + max(0.0, raw - r0) * d / (r1 - r0)
        t += d
    return t


def overlay_items(scene):
    return json.load(open(os.path.join(HERE, "overlays", scene + ".json")))["items"]


def words(line):
    return json.load(open(os.path.join(A.B, "voice", line + ".words.json")))


def say(scene, line, word, nth=0):
    off = dict(SC[scene]["lines"])[line]
    hits = [w for w in words(line) if w["text"].lower().strip(".,:;!?") == word.lower()]
    return off + hits[nth]["start"]


_cache = {}
TICKS = ["tick_001.ogg", "tick_002.ogg", "tick_004.ogg"]


def lib(pattern, db=-20.0, trim=True, max_s=None):
    key = (pattern, db, trim, max_s)
    if key not in _cache:
        _cache[key] = L.load(pattern, target_db=db, trim=trim, max_s=max_s)
    return _cache[key]


def build_cues():
    cues = []

    def add(pattern, scene, t, gain=0.0, **kw):
        """A cue `t` seconds into `scene`, `gain` dB relative to its normalised level (default -20 dBFS RMS)."""
        cues.append((lib(pattern, **kw), S[scene] + t, gain))

    def anchored(pattern, scene, hit, peak, gain=0.0, **kw):
        """Place a sample so that its peak (`peak` seconds into it) lands at `hit` seconds into the scene."""
        cues.append((lib(pattern, trim=False, **kw), S[scene] + hit - peak, gain))

    # ---- scene transitions: a whoosh that peaks on the cut ------------------------------------------------
    anchored("mixkit_1492.mp3", "concept", 0.0, 1.09, 2)
    anchored("mixkit_1486.mp3", "fly", 0.0, 0.92, -2)
    anchored("mixkit_2638.mp3", "chog", 0.0, 1.31, 0)
    anchored("mixkit_1474.mp3", "pulls", 0.0, 1.01, 0)
    anchored("mixkit_2615.mp3", "chronicle", 0.0, 2.12, -2)
    anchored("mixkit_1474.mp3", "web", 0.0, 1.01, 0)
    anchored("mixkit_1492.mp3", "never", 0.0, 1.09, 2)
    anchored("mixkit_1492.mp3", "outro", 0.0, 1.09, -4)

    # ---- intro: counter ticks, then the riser into the title hit -------------------------------------------
    for i in range(14):
        add(TICKS[i % 3], "intro", 1.15 + i * 0.28, -10 - (0 if i % 2 else 2))
    anchored("mixkit_788.mp3", "intro", 8.3, 2.17, 1)                 # riser + big cinematic impact
    add("lowFrequency_explosion_000.ogg", "intro", 8.3, -6)
    add("impactBell_heavy_000.ogg", "intro", 8.32, -5)
    add("mixkit_871.mp3", "intro", 8.5, -2, trim=False)
    add("mixkit_3062.mp3", "intro", 9.7, -6, trim=False)               # the light sweep under the rule
    add("swish-3.wav", "intro", 8.05, -8)

    # ---- concept: NFT wall, agent card, jobs, season, constellation ----------------------------------------
    for i, t in enumerate([0.2, 0.32, 0.46, 0.6, 0.78, 0.98]):
        add("pluck_00%d.ogg" % (1 + i % 2), "concept", t, -9)
    add("maximize_003.ogg", "concept", 2.5, -4)
    for i in range(9):
        add(TICKS[i % 3], "concept", 3.05 + i * 0.14, -11)
    for t, p in [(4.23, "pluck_001.ogg"), (5.0, "pluck_002.ogg"), (5.72, "pluck_001.ogg"), (6.24, "pluck_002.ogg")]:
        add(p, "concept", t, -3)
    for i, t in enumerate([7.6, 8.4, 9.0, 10.6, 11.5]):
        add("select_00%d.ogg" % (1 + i % 5), "concept", t, -4)
    anchored("mixkit_1143.mp3", "concept", 12.5, 0.55, -1)             # "HERO OF THE SEASON"
    add("impactBell_heavy_001.ogg", "concept", 12.55, -6)
    anchored("mixkit_2633.mp3", "concept", 16.0, 0.93, -2)             # the constellation star appears
    for t, p in [(17.95, "card-place-1.ogg"), (18.3, "card-place-2.ogg"), (18.65, "card-place-3.ogg")]:
        add(p, "concept", t, -3)
    for t in (19.3, 19.65, 20.0):
        add("mixkit_3062.mp3" if t < 19.5 else "glass_00%d.ogg" % (1 + int(t * 10) % 3), "concept", t, -5, **({"trim": False} if t < 19.5 else {}))

    # ---- overlay-driven cues in the gameplay scenes ---------------------------------------------------------
    sw = ["swish-%d.wav" % n for n in (3, 7, 9, 5, 12)]
    for scene in ("fly", "chog", "pulls", "chronicle"):
        k = 0
        for it in overlay_items(scene):
            t0 = it["t"][0]
            if it["kind"] == "region":
                add(sw[k % len(sw)], scene, t0 + 0.05, -4); add("maximize_00%d.ogg" % (1 + k % 6), scene, t0 + 0.1, -9); k += 1
            elif it["kind"] == "lower":
                add("maximize_00%d.ogg" % (4 + k % 4), scene, t0 + 0.1, -7); k += 1
            elif it["kind"] == "callout":
                add("select_00%d.ogg" % (1 + k % 5), scene, t0 + 0.3, -5)
                add("pluck_001.ogg", scene, t0 + 0.65, -6); k += 1
            elif it["kind"] == "badge":
                add("pluck_00%d.ogg" % (1 + k % 2), scene, t0 + 0.1, -5); k += 1
            elif it["kind"] == "arc":
                add("card-slide-%d.ogg" % (1 + k % 8), scene, t0 + 0.05, -3); k += 1
            elif it["kind"] == "steps":
                for ta, idx in it["active"]:
                    add("select_00%d.ogg" % (3 + idx), scene, ta, -9)
    # fly: the camera flights
    # (the region swishes above follow the cards)

    # ---- chog: opening the Life Story, pages turning while it scrolls --------------------------------------
    m = marks("chog", dict(panel_ready=7.0, life_open=11.6, scroll_start=13.1, scroll_end=30.1))
    t = to_scene("chog", m["life_open"])
    add("select_002.ogg", "chog", t - 0.05, -2); add("bookOpen.ogg", "chog", t + 0.05, 6); add("open_002.ogg", "chog", t + 0.08, -6)
    a, b = to_scene("chog", m["scroll_start"]), to_scene("chog", m["scroll_end"])
    for i, p in enumerate(["bookFlip1.ogg", "bookFlip2.ogg", "bookFlip3.ogg", "bookFlip1.ogg"]):
        add(p, "chog", a + (b - a) * (i + 0.5) / 4, 3)

    # ---- pulls: sign-in, the pull, four cards, choose, bestow ----------------------------------------------
    m = marks("pulls", dict(window_open=5.6, typing=8.1, signin_click=9.53, signed_in=11.1, pull_click=12.7, cards_flip=14.03, card_click=17.07, bestow_click=19.37, bestowed=24.5))
    S_ = lambda k: to_scene("pulls", m[k])
    add("select_002.ogg", "pulls", S_("window_open") - 0.05, -2); add("open_003.ogg", "pulls", S_("window_open") + 0.05, -5)
    for i in range(9):
        add("click_003.ogg", "pulls", S_("typing") + 0.05 + i * 0.105, -4)
    add("select_004.ogg", "pulls", S_("signin_click") - 0.05, -2); add("confirmation_001.ogg", "pulls", S_("signed_in") - 0.05, -4)
    add("select_001.ogg", "pulls", S_("pull_click") - 0.05, -2)
    t = S_("cards_flip")
    add("cards-pack-open-1.ogg", "pulls", t - 0.1, 2); add("mixkit_871.mp3", "pulls", t + 0.02, -3, trim=False)
    for i, p in enumerate(["card-slide-1.ogg", "card-slide-3.ogg", "card-slide-5.ogg", "card-slide-7.ogg"]):
        add(p, "pulls", t + 0.05 + i * 0.12 * 0.85, 0)
    add("select_005.ogg", "pulls", S_("card_click") - 0.05, -2)
    t = S_("bestow_click")
    add("select_003.ogg", "pulls", t - 0.05, -2); add("confirmation_003.ogg", "pulls", t + 0.1, -2)
    add("handleCoins.ogg", "pulls", t + 0.2, 0); anchored("mixkit_2344.mp3", "pulls", t + 0.15, 0.11, -3)

    # ---- chronicle: the book opens ---------------------------------------------------------------------------
    m = marks("chronicle", dict(chronicle_open=3.6, scroll_start=6.33, scroll_end=33.3))
    t = to_scene("chronicle", m["chronicle_open"])
    add("select_002.ogg", "chronicle", t - 0.05, -2); add("bookOpen.ogg", "chronicle", t + 0.08, 6)
    a, b = to_scene("chronicle", m["scroll_start"]), to_scene("chronicle", m["scroll_end"])
    for i, p in enumerate(["bookFlip2.ogg", "bookFlip3.ogg", "bookFlip1.ogg", "bookFlip2.ogg", "bookFlip3.ogg"]):
        add(p, "chronicle", a + (b - a) * (i + 0.6) / 5, 3)

    # ---- web: a browser window flying in, the address typed, the click -------------------------------------
    for i in range(20):
        add(TICKS[i % 3], "web", 0.75 + i * 0.055, -12)
    add("swish-7.wav", "web", 2.95, -6)
    add("select_003.ogg", "web", 4.95, -2); add("click_003.ogg", "web", 4.97, -2)
    for i in range(3):
        add("pluck_00%d.ogg" % (1 + i % 2), "web", 3.6 + i * 0.35, -5)

    # ---- never the same twice ----------------------------------------------------------------------------------
    for at in (0.55, 2.85, 5.85):
        add("maximize_00%d.ogg" % (2 + int(at) % 3), "never", at + 0.05, -3)
        add("handleCoins2.ogg", "never", at + 0.25, 6)
        for i in range(12):
            add(TICKS[i % 3], "never", at + 0.1 + i * 0.11, -13)
    anchored("mixkit_2908.mp3", "never", 9.05, 0.93, -2)               # "No two seasons read alike"
    add("impactBell_heavy_002.ogg", "never", 9.1, -6)

    # ---- outro: the tagline lands on "god" ----------------------------------------------------------------------
    hit = S["outro"] + 0.6 + 2.2 + 0.0
    anchored("mixkit_2900.mp3", "outro", 2.85, 3.72, 0)                # logo-intro impact: builds, then hits on "god"
    add("impactBell_heavy_000.ogg", "outro", 2.85, -4)
    add("lowFrequency_explosion_001.ogg", "outro", 2.85, -7)
    add("mixkit_582.mp3", "outro", 3.0, -9, trim=False)
    add("mixkit_3062.mp3", "outro", 3.2, -5, trim=False)
    add("select_003.ogg", "outro", 4.4, -3); add("pluck_001.ogg", "outro", 4.45, -4)
    return cues
