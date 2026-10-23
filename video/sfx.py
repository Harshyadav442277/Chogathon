"""Synthesizes the motion-design sound effects (original, no samples) into build/sfx/*.wav, 48 kHz stereo:
whoosh, riser, boom, shimmer, tick, stinger. Run: python sfx.py"""
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build", "sfx")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1969)


def save(name, x, peak=0.9):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    wavfile.write(os.path.join(OUT, name + ".wav"), SR, (x * 32767).astype(np.int16))
    print(name, f"{len(x) / SR:.2f}s")


def swept_noise(dur, f0, f1, q=0.15, shape="sine"):
    """White noise through a one-pole band-ish filter whose cutoff glides from f0 to f1 (block-wise)."""
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    zi = np.zeros(1)
    block = 256
    for i in range(0, n, block):
        k = i / n
        f = f0 * (f1 / f0) ** k
        a = np.exp(-2 * np.pi * f / SR)
        seg = noise[i:i + block]
        y, zi = lfilter([1 - a], [1, -a], seg, zi=zi)
        out[i:i + len(seg)] = y
    hp = out - lfilter([1 - 0.98], [1, -0.98], out)  # remove the lows a little
    env = np.sin(np.pi * np.linspace(0, 1, n)) ** 2 if shape == "sine" else np.linspace(0, 1, n) ** 2.2
    return hp * env


def tone(f, dur, decay=3.0, harm=(1.0, 0.4, 0.15), attack=0.004):
    t = np.arange(int(dur * SR)) / SR
    s = sum(a * np.sin(2 * np.pi * f * (k + 1) * t) for k, a in enumerate(harm))
    return s * np.exp(-t * decay) * np.clip(t / attack, 0, 1)


def echo(x, delays=(0.19, 0.37, 0.61), gains=(0.45, 0.3, 0.2)):
    out = np.zeros(len(x) + int(max(delays) * SR) + 1)
    out[:len(x)] += x
    for d, g in zip(delays, gains):
        i = int(d * SR)
        out[i:i + len(x)] += x * g
    return out


# whoosh: a soft air sweep for scene changes
w = swept_noise(0.95, 500, 6500)
save("whoosh", np.stack([w, np.roll(w, 400)], axis=1), 0.7)

# riser: noise and a rising tone building to the title reveal
n = int(2.4 * SR)
t = np.arange(n) / SR
r = swept_noise(2.4, 300, 9000, shape="ramp")
tonal = np.sin(2 * np.pi * np.cumsum(180 * (1 + 3.2 * (t / 2.4) ** 2)) / SR) * (t / 2.4) ** 2
save("riser", r * 0.7 + tonal * 0.5, 0.8)

# boom: a sub drop with a short noise burst
t = np.arange(int(1.8 * SR)) / SR
f = 38 + 70 * np.exp(-t * 7)
sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
burst = lfilter([0.08], [1, -0.92], rng.standard_normal(len(t))) * np.exp(-t * 9)
save("boom", sub + burst * 0.8, 0.9)

# shimmer: a D-major pentatonic bell arpeggio with echoes
notes = [587.33, 739.99, 880.0, 1174.66, 1479.98, 1760.0]
sh = np.zeros(int(3.6 * SR))
for i, f in enumerate(notes):
    s = tone(f, 2.2, decay=2.4, harm=(1.0, 0.5, 0.25))
    o = int(i * 0.075 * SR)
    sh[o:o + len(s)] += s * (0.9 - 0.08 * i)
save("shimmer", echo(sh[: int(3.0 * SR)]), 0.6)

# tick: a soft counter tick
save("tick", tone(2100, 0.05, decay=70, harm=(1.0, 0.2)), 0.35)

# stinger: a warm D-major chord with a bell on top, for the end card
chord = np.zeros(int(4.2 * SR))
for f, g in [(146.83, 0.9), (220.0, 0.8), (293.66, 0.8), (369.99, 0.7), (440.0, 0.6), (587.33, 0.5)]:
    s = tone(f, 4.0, decay=0.9, harm=(1.0, 0.45, 0.2), attack=0.02)
    chord[: len(s)] += s * g
bell = tone(1174.66, 3.0, decay=1.6, harm=(1.0, 0.3, 0.1))
chord[int(0.1 * SR): int(0.1 * SR) + len(bell)] += bell * 0.5
save("stinger", echo(chord[: int(4.0 * SR)], delays=(0.23, 0.47), gains=(0.35, 0.2)), 0.7)
