"""Builds overlays/<scene>.json for the gameplay scenes. Every caption is placed from two clocks:
  * the voice: build/voice/<line>.words.json (when each word is spoken) and the line's start in the scene
  * the footage: build/gameplay/<scene>.marks (movie time of key moments, printed by the demo director) mapped
    through the scene's speed segments to scene time
so the picture and the narration stay locked together. Run: python make_overlays.py"""
import json
import os

import assemble as A

HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(HERE, "overlays"), exist_ok=True)
SC = {s["id"]: s for s in A.SCENES}
ARCS = json.load(open(os.path.join(HERE, "..", "chog-hivemind", "data", "story", "arcs.json"), encoding="utf-8"))["arcs"]


def words(line):
    return json.load(open(os.path.join(A.B, "voice", line + ".words.json")))


def say(scene, line, word, nth=0):
    """Scene time at which `word` (nth occurrence) of `line` is spoken."""
    off = dict(SC[scene]["lines"])[line]
    hits = [w for w in words(line) if w["text"].lower().strip(".,:;!?") == word.lower()]
    return off + hits[nth]["start"]


def line_span(scene, line):
    off = dict(SC[scene]["lines"])[line]
    return off, off + A.DUR[line]


def marks(scene, fallback=None):
    path = os.path.join(A.B, "gameplay", scene + ".marks")
    out = dict(fallback or {})
    if os.path.exists(path):
        for l in open(path):
            if l.startswith("MARK "):
                _, name, t = l.split()
                out[name] = float(t)
    return out


def to_scene(scene, raw):
    """Map a raw footage time to scene time through the speed segments."""
    t = 0.0
    for r0, r1, d in SC[scene]["segs"]:
        if raw <= r1:
            return t + max(0.0, raw - r0) * d / (r1 - r0)
        t += d
    return t


def save(scene, items):
    dur = SC[scene]["dur"]
    for it in items:  # keep every caption inside the scene
        it["t"] = [round(min(it["t"][0], dur - 1.0), 2), round(min(it["t"][1], dur - 0.25), 2)]
    path = os.path.join(HERE, "overlays", scene + ".json")
    json.dump({"duration": SC[scene]["dur"], "items": items}, open(path, "w"), indent=1)
    print(scene, len(items), "overlay items")


LEFT_STACK = {"left": "40px", "top": "150px", "bottom": "auto", "minWidth": "0", "maxWidth": "430px"}

# ---- fly -------------------------------------------------------------------------------------------------
m = marks("fly", dict(cam_capital=3.5, cam_emberforge=9.5, cam_tidecry=15.0, cam_prism=20.5, cam_hollow=26.0, end=31.0))
arr = [to_scene("fly", m[k]) for k in ("cam_emberforge", "cam_tidecry", "cam_prism", "cam_hollow", "end")]
names = ["The Hive Capital", "Emberforge Peaks", "Tidecry Coast", "Prism Expanse", "The Hollow"]
items = [dict(kind="lower", t=[0.9, 6.4], title="Monadia", sub="Ten regions, one living continent")]
for i, nm in enumerate(names):
    a = max(1.6, arr[i] - 2.0) if i else 2.4
    items.append(dict(kind="region", t=[round(a, 2), round(min(arr[i] + 0.7, SC["fly"]["dur"] - 0.25), 2)], eyebrow=f"Region {i + 1}", text=nm))
t_browser = say("fly", "s3b", "plays") - 0.2
t_stream = say("fly", "s3b", "Star") - 0.3
items.append(dict(kind="lower", t=[round(t_browser, 2), round(t_browser + 4.2, 2)], title="Plays in your browser", sub="No install, nothing to download", style={"bottom": "250px"}))
items.append(dict(kind="callout", t=[round(t_stream, 2), round(t_stream + 5.2, 2)], title="Star Stream", sub="The world narrates itself, live", lx=640, ly=905, sx=640, sy=950, x=560, y=960))
save("fly", items)

# ---- chog ------------------------------------------------------------------------------------------------
m = marks("chog", dict(panel_ready=7.0, life_open=11.6, scroll_start=13.1, scroll_end=30.1))
t_nft = say("chog", "s4a", "NFT") - 0.3
t_life = say("chog", "s4a", "life") - 0.2
t_bonds = say("chog", "s4a", "bonds") - 0.3
t_past = say("chog", "s4a", "past") - 0.3
save("chog", [
    dict(kind="callout", t=[round(t_nft, 2), round(t_nft + 4.6, 2)], title="Real NFT, real traits", sub="Eyes, mouth, head and tier shape the personality", lx=860, ly=150, sx=1400, sy=215, x=1584, y=196),
    dict(kind="lower", t=[round(t_life, 2), round(t_life + 5.8, 2)], title="Life Story", sub="A biography written by the story graph", style=LEFT_STACK),
    dict(kind="lower", t=[round(t_bonds, 2), round(t_bonds + 5.6, 2)], title="Bonds, rumours, legacy", sub="From this Chog's own history", style={**LEFT_STACK, "top": "330px"}),
    dict(kind="lower", t=[round(t_past, 2), round(SC["chog"]["dur"] - 0.2, 2)], title="Past lives", sub="Remembered across seasons", style={**LEFT_STACK, "top": "510px"}),
])

# ---- pulls -----------------------------------------------------------------------------------------------
m = marks("pulls", dict(window_open=6.5, typing=9.0, signin_click=10.5, signed_in=12.0, pull_click=14.0, cards_flip=15.0, card_click=19.0, bestow_click=20.5, bestowed=21.5))
S = lambda k: to_scene("pulls", m[k])
t_holders = say("pulls", "s5a", "holders") - 0.3
t_five = say("pulls", "s5a", "five") - 0.2
a5, b5 = line_span("pulls", "s5b")
a5c, b5c = line_span("pulls", "s5c")
save("pulls", [
    dict(kind="steps", style={"top": "40px", "bottom": "auto"}, t=[round(S("window_open") - 0.2, 2), round(SC["pulls"]["dur"] - 0.2, 2)], items=["Sign in", "Pull", "Choose 1 of 4", "Bestow"],
         active=[[round(S("window_open"), 2), 0], [round(S("pull_click"), 2), 1], [round(S("cards_flip"), 2), 2], [round(S("bestow_click"), 2), 3]]),
    dict(kind="badge", t=[round(t_holders, 2), round(t_holders + 4.0, 2)], text="NFT holders only", x=40, y=160, cls=""),
    dict(kind="badge", t=[round(t_five, 2), round(t_five + 4.2, 2)], text="5 pulls per season", x=40, y=230, cls="violet"),
    dict(kind="lower", t=[round(a5 + 0.1, 2), round(b5 + 0.6, 2)], title="The Peddler of Stars", sub="“These are tools, not toys.”", style=LEFT_STACK),
    dict(kind="lower", t=[round(a5c, 2), round(b5c + 1.2, 2)], title="Applied on the next tick", sub="The skill or quest changes that Chog's story", style={**LEFT_STACK, "top": "330px"}),
])

# ---- chronicle -------------------------------------------------------------------------------------------
keys = ["lantern", "Chog", "war", "nobody", "Maligned", "locked", "worst", "hidden"]
starts_ = [say("chronicle", "s6a", k) - 0.25 for k in keys]
end_ = line_span("chronicle", "s6a")[1] + 0.3
items = []
for i, (k, a) in enumerate(zip(keys, starts_)):
    b = starts_[i + 1] - 0.05 if i + 1 < len(keys) else end_
    arc = ARCS[i]
    items.append(dict(kind="arc", t=[round(a, 2), round(b, 2)], eyebrow=f"Premise {i + 1} of 8", title=arc["title"], sub=arc["blurb"], cls="narrow"))
for lid, title, sub in [("s6b", "Orrun, the Lynx", "The Lantern at the Crossroads"), ("s6c", "The Demon King", "The Quiet Throne"), ("s6d", "A child on a wall", "Every season, a new Hero")]:
    a, b = line_span("chronicle", lid)
    items.append(dict(kind="lower", t=[round(a - 0.1, 2), round(b + 0.5, 2)], title=title, sub=sub, style={"left": "40px", "bottom": "90px", "maxWidth": "430px", "minWidth": "0"}))
save("chronicle", items)
