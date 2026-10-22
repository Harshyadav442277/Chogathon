"""Compose ChogSekai's main theme: an original, seamlessly looping adventure tune, synthesized from scratch
(no samples, nothing to license). Writes game/assets/music/monadia_theme.wav (22.05 kHz mono, 16-bit).

D major, 100 BPM, 24 bars (~58 s): harp arpeggios, a warm pad, bass, a flute-like melody and soft percussion.
Run: python game/tools/make_theme.py   (needs numpy; deterministic)
"""
import os
import wave

import numpy as np

SR = 22050
BPM = 100
BEAT = 60.0 / BPM
BAR = 4 * BEAT
CHORDS = {  # MIDI notes: pad voicing, bass root
    "D": ([62, 66, 69], 38), "A": ([61, 64, 69], 45), "Bm": ([59, 62, 66], 47),
    "G": ([59, 62, 67], 43), "Em": ([59, 64, 67], 40),
}
PROGRESSION = [
    "D", "A", "Bm", "G", "D", "A", "G", "A",
    "Bm", "G", "D", "A", "Bm", "G", "Em", "A",
    "D", "A", "Bm", "G", "G", "A", "D", "D",
]
# Melody per bar: (MIDI note or None for rest, length in beats).
MELODY = [
    [(81, 1), (78, .5), (79, .5), (81, 2)], [(76, 1), (73, .5), (76, .5), (78, 2)],
    [(74, 1), (78, 1), (83, 1.5), (81, .5)], [(79, 3), (78, 1)],
    [(81, 1), (86, 1), (85, .5), (83, .5), (81, 1)], [(76, 1.5), (78, .5), (81, 2)],
    [(83, 1), (81, 1), (79, 1), (78, 1)], [(76, 3), (None, 1)],
    [(78, 1), (81, 1), (83, 2)], [(86, 1.5), (83, .5), (79, 2)],
    [(81, 1), (78, 1), (74, 2)], [(76, 1), (78, .5), (76, .5), (73, 2)],
    [(78, 1), (81, 1), (83, 1), (86, 1)], [(88, 2), (86, 1), (83, 1)],
    [(83, 1), (79, 1), (76, 1), (79, 1)], [(81, 4)],
    [(81, 1), (78, .5), (79, .5), (81, 2)], [(76, 1), (73, .5), (76, .5), (78, 2)],
    [(74, 1), (78, 1), (83, 1.5), (81, .5)], [(79, 2), (83, 2)],
    [(86, 1.5), (83, .5), (79, 1), (81, 1)], [(83, 1), (85, 1), (88, 2)],
    [(86, 4)], [(None, 2), (74, 1), (76, 1)],
]

LOOP = int(len(PROGRESSION) * BAR * SR)
TAIL = int(3 * SR)  # release tails that wrap around to the start of the loop
out = np.zeros(LOOP + TAIL)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, attack, release):
    e = np.ones(n)
    a = max(1, int(attack * SR))
    r = max(1, int(release * SR))
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def add(start_s, sig):
    i = int(start_s * SR)
    out[i:i + len(sig)] += sig[: len(out) - i]


def pluck(m, dur, vol):
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return vol * s * np.exp(-t * 3.2) * env(n, 0.004, 0.05)


def pad(notes, dur, vol):
    n = int((dur + 0.8) * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for m in notes:
        f = hz(m)
        for det in (-0.6, 0.6):  # slight detune for warmth
            s += np.sin(2 * np.pi * (f + det) * t) + 0.25 * np.sin(4 * np.pi * (f + det) * t)
    return vol * s / (2 * len(notes)) * env(n, 0.5, 0.9)


def flute(m, dur, vol):
    n = int((dur + 0.15) * SR)
    t = np.arange(n) / SR
    f = hz(m)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.3, 0, 1)
    phase = 2 * np.pi * f * np.cumsum(vib) / SR
    s = np.sin(phase) + 0.18 * np.sin(2 * phase) + 0.06 * np.sin(3 * phase)
    breath = 0.02 * np.random.default_rng(int(m * 97 + dur * 13)).standard_normal(n)
    return vol * (s + breath) * env(n, 0.06, 0.12)


def bass(m, dur, vol):
    n = int((dur + 0.3) * SR)
    t = np.arange(n) / SR
    f = hz(m)
    return vol * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 1.6) * env(n, 0.01, 0.2)


def kick(vol):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 110 * np.exp(-t * 18) + 45
    return vol * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def shaker(vol, seed):
    n = int(0.09 * SR)
    noise = np.random.default_rng(seed).standard_normal(n)
    hp = noise - np.concatenate([[0], noise[:-1]])  # crude high-pass
    return vol * hp * np.exp(-np.arange(n) / SR * 45)


for b, name in enumerate(PROGRESSION):
    t0 = b * BAR
    notes, root = CHORDS[name]
    add(t0, pad(notes, BAR, 0.16))
    add(t0, bass(root, 2 * BEAT, 0.32))
    add(t0 + 2 * BEAT, bass(root + 7 if root < 45 else root - 5, 2 * BEAT, 0.24))
    arp = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 24, notes[2] + 12, notes[1] + 12, notes[0] + 12, notes[2]]
    for k, m in enumerate(arp):
        add(t0 + k * BEAT / 2, pluck(m, BEAT / 2, 0.10 if k % 2 else 0.13))
    if b >= 2:  # percussion enters after the intro
        add(t0, kick(0.30))
        add(t0 + 2 * BEAT, kick(0.22))
        for k in range(8):
            add(t0 + k * BEAT / 2 + BEAT / 4, shaker(0.045 if k % 2 else 0.03, b * 8 + k))
    tm = t0
    for m, beats in MELODY[b]:
        if m is not None and b >= 1:  # the melody starts in bar 2; bar 1 is the harp intro
            add(tm, flute(m, beats * BEAT * 0.95, 0.20))
        tm += beats * BEAT

# Seamless loop: fold the tails that ring past the end back onto the start.
out[:TAIL] += out[LOOP:LOOP + TAIL]
song = out[:LOOP]
# Gentle compression + normalisation.
song = np.tanh(song * 1.3) / np.tanh(1.3)
song = song / np.max(np.abs(song)) * 0.89
pcm = (song * 32767).astype(np.int16)

path = os.path.join(os.path.dirname(__file__), "..", "assets", "music", "monadia_theme.wav")
with wave.open(path, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(path, f"{len(pcm) / SR:.1f} s", os.path.getsize(path) // 1024, "KB")
