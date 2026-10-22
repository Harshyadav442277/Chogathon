"""Synthesize ChogSekai's UI sound effects (original, no samples) into game/assets/sfx/*.wav (22.05 kHz mono).
click (soft wooden tick), select (two-note chime), pull (rising star shimmer), bestow (bright fanfare chord),
error (low muted thud), open (airy whoosh). Run: python game/tools/make_sfx.py
"""
import os
import wave

import numpy as np

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sfx")
os.makedirs(OUT, exist_ok=True)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tone(m, dur, decay=6.0, harm=(1.0, 0.3, 0.1), attack=0.004):
    t = np.arange(int(dur * SR)) / SR
    f = hz(m)
    s = sum(a * np.sin(2 * np.pi * f * (k + 1) * t) for k, a in enumerate(harm))
    env = np.exp(-t * decay) * np.clip(t / attack, 0, 1)
    return s * env


def mix(parts, length):
    out = np.zeros(int(length * SR))
    for start, sig in parts:
        i = int(start * SR)
        out[i:i + len(sig)] += sig[: len(out) - i]
    return out


def save(name, sig, peak=0.7):
    sig = sig / (np.max(np.abs(sig)) + 1e-9) * peak
    pcm = (sig * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(name, f"{len(pcm) / SR:.2f}s")


rng = np.random.default_rng(7)

# click: a short filtered noise tick plus a tiny wooden knock
n = int(0.06 * SR)
noise = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 120)
save("click", mix([(0, noise * 0.5), (0, tone(84, 0.06, decay=60, harm=(1.0, 0.2)))], 0.07), 0.45)

# select: two quick rising notes, like a menu cursor
save("select", mix([(0, tone(81, 0.18, decay=14)), (0.06, tone(88, 0.25, decay=10))], 0.3), 0.5)

# pull: a rising sparkle arpeggio with a soft bell bloom
arp = [(i * 0.055, tone(m, 0.5, decay=7, harm=(1.0, 0.5, 0.25))) for i, m in enumerate([76, 79, 83, 86, 88, 91, 95])]
bloom = (0.35, tone(100, 0.9, decay=3.5, harm=(1.0, 0.0, 0.4)))
save("pull", mix(arp + [bloom], 1.3), 0.55)

# bestow: a bright major fanfare chord (D major) with a little grace note
fan = [(0, tone(74, 0.12, decay=12)), (0.08, tone(78, 0.9, decay=3)), (0.08, tone(81, 0.9, decay=3)),
       (0.08, tone(86, 0.9, decay=3)), (0.08, tone(62, 0.9, decay=3, harm=(1.0, 0.5)))]
save("bestow", mix(fan, 1.1), 0.55)

# error: a low muted double thud
save("error", mix([(0, tone(45, 0.18, decay=18, harm=(1.0, 0.4))), (0.12, tone(42, 0.22, decay=16, harm=(1.0, 0.4)))], 0.4), 0.55)

# open: an airy whoosh (filtered noise swell) with a soft chime
n = int(0.35 * SR)
t = np.arange(n) / SR
wn = rng.standard_normal(n)
smooth = np.convolve(wn, np.ones(24) / 24, mode="same")
whoosh = smooth * np.sin(np.pi * t / t[-1]) ** 2
save("open", mix([(0, whoosh * 0.6), (0.12, tone(93, 0.3, decay=9) * 0.5)], 0.45), 0.4)
