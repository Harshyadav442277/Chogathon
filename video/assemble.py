"""Assembles the demo video: scenes (motion-design frames or recorded gameplay with overlays) -> one 1080p30 video,
the voice-over, music (our original theme, ducked under the voices), game and synthesized sound effects -> one
loudness-normalised master, plus an SRT and burned-in captions.

  python assemble.py video     # build the scene clips and the silent picture (build/clips/*.mp4, build/picture.mp4)
  python assemble.py audio     # mix build/audio/master.wav
  python assemble.py final     # mux, burn captions, write out/ChogSekai_demo.mp4 (+ .srt)
  python assemble.py all
"""
import json
import os
import re
import subprocess
import sys

import imageio_ffmpeg
import numpy as np
from scipy.io import wavfile
from scipy.ndimage import uniform_filter1d
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, "build")
OUT = os.path.join(HERE, "out")
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000
FPS = 30
script = json.load(open(os.path.join(HERE, "script.json"), encoding="utf-8"))
DUR = json.load(open(os.path.join(B, "voice", "durations.json")))
TEXT = {l["id"]: l for l in script["lines"]}

# Scenes in order. `lines`: voice line id and its start (seconds into the scene). Gameplay scenes: the recording,
# the part of it to use (trim = seconds to cut from the start, tail = seconds to cut from the end) and an overlay.
SCENES = [
    dict(id="intro", kind="mograph", dur=17.0, lines=[("s1a", 0.8), ("s1b", 8.35)]),
    dict(id="concept", kind="mograph", dur=22.8, lines=[("s2a", 0.6), ("s2b", 15.5)]),
    # segs: (raw start, raw end, seconds it should take on screen); the speed of each part follows from that.
    dict(id="fly", kind="game", dur=21.2, segs=[(3.4, 31.7, 21.2)], lines=[("s3a", 0.6), ("s3b", 13.36)]),
    dict(id="chog", kind="game", dur=23.3, segs=[(2.6, 11.2, 8.6), (11.2, 31.3, 14.7)], lines=[("s4a", 0.6), ("s4b", 17.92)]),
    dict(id="pulls", kind="game", dur=23.2, segs=[(2.6, 31.0, 23.2)], lines=[("s5a", 0.6), ("s5b", 15.69), ("s5c", 19.01)]),
    dict(id="chronicle", kind="game", dur=31.6, segs=[(2.6, 34.2, 31.6)], lines=[("s6a", 0.6), ("s6b", 17.34), ("s6c", 22.11), ("s6d", 26.13)]),
    dict(id="web", kind="mograph", dur=9.8, lines=[("sweb", 0.7)]),
    dict(id="tech", kind="mograph", dur=13.1, lines=[("s7a", 0.5)]),
    dict(id="outro", kind="mograph", dur=8.8, lines=[("s8a", 0.6)]),
]
starts, t = {}, 0.0
for s in SCENES:
    starts[s["id"]] = t
    t += s["dur"]
TOTAL = t

# Sound-effect cues on the final timeline: (effect, absolute seconds, gain).
def cues():
    S = starts
    c = [("riser", S["intro"] + 5.7, 0.55), ("boom", S["intro"] + 8.2, 0.8), ("shimmer", S["intro"] + 8.35, 0.5)]
    for sid in ("concept", "fly", "chog", "pulls", "chronicle", "web", "tech", "outro"):
        c.append(("whoosh", S[sid] - 0.25, 0.5))
    c += [("shimmer", S["concept"] + 14.4, 0.35), ("shimmer", S["concept"] + 17.9, 0.3), ("stinger", S["outro"] + 0.4, 0.6)]
    c += [("tick", S["intro"] + 1.2 + i * 0.28, 0.35) for i in range(14)]
    return c


def run(args, quiet=True):
    r = subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y"] + args, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr[-1500:])
        raise SystemExit("ffmpeg failed: " + " ".join(args)[:200])


def probe(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])


def atempo(speed):
    parts = []
    while speed > 2.0:
        parts.append("atempo=2.0")
        speed /= 2.0
    while speed < 0.5:
        parts.append("atempo=0.5")
        speed /= 0.5
    parts.append(f"atempo={speed:.5f}")
    return ",".join(parts)


def clip(scene):
    sid, dur = scene["id"], scene["dur"]
    out = os.path.join(B, "clips", sid + ".mp4")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    enc = ["-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", "-r", str(FPS), "-an"]
    if scene["kind"] == "mograph":
        run(["-framerate", str(FPS), "-i", os.path.join(B, "frames", sid, "%05d.jpg"), "-frames:v", str(round(dur * FPS))] + enc + [out])
        return out
    avi = os.path.join(B, "gameplay", sid + ".avi")
    length = probe(avi)
    segs = scene["segs"]
    parts, labels = [f"[0:v]split={len(segs)}" + "".join(f"[i{i}]" for i in range(len(segs)))], []
    for i, (r0, r1, d) in enumerate(segs):
        r1 = min(r1, length)
        parts.append(f"[i{i}]trim=start={r0}:end={r1},setpts=(PTS-STARTPTS)/{(r1 - r0) / d:.5f},fps={FPS}[s{i}]")
        labels.append(f"[s{i}]")
    chain = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(segs)}:v=1:a=0,scale=1920:1080:flags=lanczos,tpad=stop_mode=clone:stop_duration=3[g]"
    fade = f"fade=t=in:st=0:d=0.5,fade=t=out:st={dur - 0.5:.2f}:d=0.5"
    inputs = ["-i", avi]
    ovdir = os.path.join(B, "frames", "ov_" + sid)
    if os.path.isdir(ovdir) and os.listdir(ovdir):
        inputs += ["-framerate", str(FPS), "-i", os.path.join(ovdir, "%05d.png")]
        chain += ";[g][1:v]overlay=0:0:format=auto[o];[o]" + fade + "[v]"
    else:
        chain += ";[g]" + fade + "[v]"
    print(f"{sid}: footage {length:.1f}s -> {dur}s in {len(segs)} segment(s)")
    run(inputs + ["-filter_complex", chain, "-map", "[v]", "-t", str(dur)] + enc + [out])
    return out


def build_video():
    clips = [clip(s) for s in SCENES]
    lst = os.path.join(B, "clips", "list.txt")
    open(lst, "w").write("".join(f"file '{c.replace(chr(92), '/')}'\n" for c in clips))
    run(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", os.path.join(B, "picture.mp4")])
    print("picture:", round(probe(os.path.join(B, "picture.mp4")), 2), "s")


def load_wav(path, gain=1.0):
    sr, x = wavfile.read(path)
    x = x.astype(np.float64) / 32768.0
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    if sr != SR:
        x = resample_poly(x, SR, sr, axis=0)
    return x * gain


def decode(path, extra=()):
    tmp = os.path.join(B, "audio", "_tmp.wav")
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    run(["-i", path, *extra, "-ar", str(SR), "-ac", "2", tmp])
    return load_wav(tmp)


def place(buf, x, at, gain=1.0):
    i = int(at * SR)
    n = min(len(x), len(buf) - i)
    if n > 0 and i >= 0:
        buf[i:i + n] += x[:n] * gain


def mix_audio():
    n = int((TOTAL + 1.0) * SR)
    voice = np.zeros((n, 2))
    sfx_game = np.zeros((n, 2))
    sfx_synth = np.zeros((n, 2))
    # voices (the cast), slightly different pan so the characters feel apart
    pan = {"narrator": (1.0, 1.0), "guide": (1.0, 1.0), "orrun": (1.0, 0.8), "king": (0.85, 1.0), "peddler": (0.8, 1.0), "child": (1.0, 0.85)}
    for s in SCENES:
        for lid, off in s["lines"]:
            x = decode(os.path.join(B, "voice", lid + ".mp3"))
            p = pan[TEXT[lid]["actor"]]
            place(voice, x * np.array(p), starts[s["id"]] + off)
    # the game's own sounds from the recordings (clicks, card flips, bestow), time-compressed like the picture
    for s in SCENES:
        if s["kind"] != "game":
            continue
        avi = os.path.join(B, "gameplay", s["id"] + ".avi")
        length = probe(avi)
        chunks = []
        for (r0, r1, d) in s["segs"]:
            r1 = min(r1, length)
            chunks.append(decode(avi, ["-ss", str(r0), "-t", str(r1 - r0), "-af", atempo((r1 - r0) / d)])[: int(d * SR)])
        x = np.concatenate(chunks)
        place(sfx_game, x[: int(s["dur"] * SR)], starts[s["id"]], 0.8)
    # synthesized cues
    for name, at, g in cues():
        place(sfx_synth, load_wav(os.path.join(B, "sfx", name + ".wav")), max(0, at), g)
    # music: our original theme, looped, ducked under speech, faded at the ends
    theme = load_wav(os.path.join(HERE, "..", "game", "assets", "music", "monadia_theme.wav"))
    music = np.tile(theme, (int(np.ceil(n / len(theme))) + 1, 1))[:n]
    speech = np.abs(voice).max(axis=1)
    env = uniform_filter1d((speech > 0.02).astype(float), size=int(0.5 * SR))
    env = uniform_filter1d(env, size=int(0.35 * SR))
    gain = 0.50 - 0.33 * np.clip(env * 1.6, 0, 1)
    gain = gain * np.clip(np.arange(n) / (2.0 * SR), 0, 1) * np.clip((n - np.arange(n)) / (3.0 * SR), 0, 1)
    music = music * gain[:, None]
    master = voice * 1.0 + music + sfx_game * 0.9 + sfx_synth
    master = np.tanh(master * 0.9) / np.tanh(0.9)
    master = master / np.max(np.abs(master)) * 0.95
    os.makedirs(os.path.join(B, "audio"), exist_ok=True)
    raw = os.path.join(B, "audio", "mix_raw.wav")
    wavfile.write(raw, SR, (master * 32767).astype(np.int16))
    run(["-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=9", "-ar", str(SR), os.path.join(B, "audio", "master.wav")])
    print("audio: master.wav", round(len(master) / SR, 1), "s")


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt():
    cues_ = []
    for s in SCENES:
        for lid, off in s["lines"]:
            text, dur = TEXT[lid]["text"], DUR[lid]
            sents = re.split(r"(?<=[.!?:])\s+", text)
            total = sum(len(x) for x in sents)
            t0 = starts[s["id"]] + off
            for x in sents:
                d = dur * len(x) / total
                # break long sentences into two lines at a comma or near the middle
                if len(x) > 46:
                    mid = len(x) // 2
                    cut = x.rfind(" ", 0, mid + 8)
                    x = x[:cut] + "\n" + x[cut + 1:]
                cues_.append((t0, t0 + d - 0.05, f"{x}"))
                t0 += d
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "ChogSekai_demo.srt"), "w", encoding="utf-8") as f:
        for i, (a, b, x) in enumerate(cues_, 1):
            f.write(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{x}\n\n")
    print("srt:", len(cues_), "cues")


def final():
    write_srt()
    pic = os.path.join(B, "picture.mp4")
    aud = os.path.join(B, "audio", "master.wav")
    srt = os.path.join(OUT, "ChogSekai_demo.srt")
    # captions need a relative path without a drive letter for the filter parser
    style = "FontName=Segoe UI Semibold,FontSize=17,PrimaryColour=&H00F6EDCC,OutlineColour=&H00101810,BorderStyle=1,Outline=2.2,Shadow=0.6,MarginV=26,Alignment=2"
    out = os.path.join(OUT, "ChogSekai_demo.mp4")
    cwd = os.getcwd()
    os.chdir(OUT)
    try:
        run(["-i", pic, "-i", aud, "-vf", f"subtitles=ChogSekai_demo.srt:force_style='{style}'", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
             "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k", "-shortest", "ChogSekai_demo.mp4"])
    finally:
        os.chdir(cwd)
    print("out:", out, round(probe(out), 1), "s", round(os.path.getsize(out) / 1e6, 1), "MB")


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("video", "all"):
        build_video()
    if what in ("audio", "all"):
        mix_audio()
    if what in ("final", "all"):
        final()
