"""Compose ChogSekai's main theme "Over the Floating Citadel": an original adventure tune, synthesized from
scratch (no samples, nothing to license), looping seamlessly. Writes game/assets/music/monadia_theme.wav
(22.05 kHz mono, 16-bit), about 1 m 50 s.

D major, 96 BPM. Form: intro (harp) - A (ocarina) - B - A' (strings join) - bridge (B minor, strings) -
A'' (full) - outro back into the intro. Instruments: Karplus-Strong harp, detuned string section through a
low-pass filter, an ocarina-like lead with breath and vibrato, plucked bass, frame drum and tambourine, and a
convolution hall reverb. Run: python game/tools/make_theme.py   (numpy; deterministic)
"""
import os
import wave

import numpy as np

SR = 22050
BPM = 96
BEAT = 60.0 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(1969)

CH = {  # chord tones (MIDI) for pads/arps, bass root
    "D": ([62, 66, 69], 38), "A": ([61, 64, 69], 45), "Bm": ([59, 62, 66], 47), "G": ([59, 62, 67], 43),
    "Em": ([59, 64, 67], 40), "F#m": ([61, 66, 69], 42), "Asus": ([62, 64, 69], 45),
}
# (section, chord) per bar
A_PROG = ["D", "A", "Bm", "G", "D", "A", "G", "A"]
B_PROG = ["Bm", "G", "D", "A", "Bm", "G", "Em", "A"]
BRIDGE = ["Bm", "F#m", "G", "D", "Em", "Bm", "G", "Asus"]
FORM = ([("intro", c) for c in ["D", "G", "D", "Asus"]] + [("A", c) for c in A_PROG] + [("B", c) for c in B_PROG]
        + [("A2", c) for c in A_PROG] + [("bridge", c) for c in BRIDGE] + [("A3", c) for c in A_PROG]
        + [("outro", c) for c in ["G", "A", "D", "D"]])

MEL_A = [
    [(81, 1), (78, .5), (79, .5), (81, 2)], [(76, 1), (73, .5), (76, .5), (78, 2)],
    [(74, 1), (78, 1), (83, 1.5), (81, .5)], [(79, 3), (78, 1)],
    [(81, 1), (86, 1), (85, .5), (83, .5), (81, 1)], [(76, 1.5), (78, .5), (81, 2)],
    [(83, 1), (81, 1), (79, 1), (78, 1)], [(76, 3), (None, 1)],
]
MEL_B = [
    [(78, 1), (81, 1), (83, 2)], [(86, 1.5), (83, .5), (79, 2)],
    [(81, 1), (78, 1), (74, 2)], [(76, 1), (78, .5), (76, .5), (73, 2)],
    [(78, 1), (81, 1), (83, 1), (86, 1)], [(88, 2), (86, 1), (83, 1)],
    [(83, 1), (79, 1), (76, 1), (79, 1)], [(81, 4)],
]
MEL_BRIDGE = [  # slower, wistful
    [(74, 2), (78, 2)], [(76, 3), (73, 1)], [(74, 2), (71, 2)], [(69, 4)],
    [(71, 2), (74, 2)], [(78, 3), (76, 1)], [(74, 2), (79, 2)], [(76, 4)],
]
MEL_OUTRO = [[(83, 2), (81, 2)], [(79, 2), (76, 2)], [(78, 4)], [(None, 2), (74, 1), (76, 1)]]

LOOP = int(len(FORM) * BAR * SR)
TAIL = int(4 * SR)
dry = np.zeros(LOOP + TAIL)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(t0, sig, buf=None):
    b = dry if buf is None else buf
    i = int(t0 * SR)
    n = min(len(sig), len(b) - i)
    if n > 0:
        b[i:i + n] += sig[:n]


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def env(n, attack, release):
    e = np.ones(n)
    a, r = max(1, int(attack * SR)), max(1, int(release * SR))
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def harp(m, dur, vol):
    """Karplus-Strong plucked string."""
    f = hz(m)
    period = max(2, int(SR / f))
    n = int((dur + 1.6) * SR)
    buf = rng.uniform(-1, 1, period)
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.996 * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return vol * out * env(n, 0.002, 0.08)


def strings(notes, dur, vol, cutoff=1800):
    n = int((dur + 0.6) * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for m in notes:
        for det in (-4.0, 0.0, 4.5):  # cents
            f = hz(m) * 2 ** (det / 1200)
            vib = 1 + 0.0025 * np.sin(2 * np.pi * (5.0 + det * 0.05) * t)
            ph = 2 * np.pi * f * np.cumsum(vib) / SR
            s += sum(np.sin(k * ph) / k for k in range(1, 7))  # band-limited saw
    s = lowpass(s, cutoff)
    return vol * s / (3 * len(notes)) * env(n, 0.35, 0.6)


def ocarina(m, dur, vol):
    n = int((dur + 0.12) * SR)
    t = np.arange(n) / SR
    f = hz(m)
    vib = 1 + 0.005 * np.sin(2 * np.pi * 5.4 * t) * np.clip((t - 0.15) / 0.3, 0, 1)
    ph = 2 * np.pi * f * np.cumsum(vib) / SR
    s = np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.04 * np.sin(3 * ph)
    breath = lowpass(rng.standard_normal(n), 3000) * 0.05 * np.exp(-t * 8)
    return vol * (s + breath) * env(n, 0.04, 0.1)


def bass(m, dur, vol):
    n = int((dur + 0.4) * SR)
    t = np.arange(n) / SR
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return vol * s * np.exp(-t * 1.8) * env(n, 0.008, 0.25)


def frame_drum(vol):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 90 * np.exp(-t * 14) + 55
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    skin = lowpass(rng.standard_normal(n), 900) * np.exp(-t * 30) * 0.4
    return vol * (body + skin)


def tambourine(vol):
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    hp = noise - lowpass(noise, 5000)
    jingle = sum(np.sin(2 * np.pi * f * t) for f in (5200, 6800, 8100)) * 0.15
    return vol * (hp + jingle) * np.exp(-t * 28)


for b, (sec, ch) in enumerate(FORM):
    t0 = b * BAR
    notes, root = CH[ch]
    full = sec in ("A3",)
    # harp arpeggio, every section
    arp = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 24, notes[2] + 24, notes[1] + 24, notes[2] + 12, notes[1] + 12]
    hv = 0.10 if sec in ("bridge",) else 0.30 if sec == "intro" else 0.14
    for k, m in enumerate(arp):
        add(t0 + k * BEAT / 2, harp(m, BEAT / 2, hv * (1.0 if k % 2 == 0 else 0.75)))
    # strings pad from A on; brighter in A2/A3, the lead voice of the bridge
    add(t0, strings(notes, BAR, 0.20 if sec in ("A2", "A3", "bridge") else 0.16 if sec == "intro" else 0.12, 2600 if sec in ("A3",) else 1600))
    # bass
    if sec != "intro":
        add(t0, bass(root, 2 * BEAT, 0.30))
        add(t0 + 2 * BEAT, bass(root + 7 if root < 45 else root - 5, 2 * BEAT, 0.22))
    # percussion: frame drum on 1 and 3, tambourine on the off-beats (not in intro/bridge)
    if sec in ("A", "B", "A2", "A3", "outro"):
        add(t0, frame_drum(0.32))
        add(t0 + 2 * BEAT, frame_drum(0.22 if not full else 0.3))
        for k in range(4):
            add(t0 + k * BEAT + BEAT / 2, tambourine(0.035 if not full else 0.05))
    # melody
    mel = None
    i = 0
    if sec in ("A", "A2", "A3"):
        i = (b - [x for x, (s, _) in enumerate(FORM) if s == sec][0])
        mel = MEL_A[i]
    elif sec == "B":
        i = b - [x for x, (s, _) in enumerate(FORM) if s == "B"][0]
        mel = MEL_B[i]
    elif sec == "bridge":
        i = b - [x for x, (s, _) in enumerate(FORM) if s == "bridge"][0]
        mel = MEL_BRIDGE[i]
    elif sec == "outro":
        i = b - [x for x, (s, _) in enumerate(FORM) if s == "outro"][0]
        mel = MEL_OUTRO[i]
    if mel:
        tm = t0
        for m, beats in mel:
            if m is not None:
                d = beats * BEAT * 0.95
                if sec == "bridge":
                    add(tm, strings([m], d, 0.30, 2200))  # the strings sing the bridge
                else:
                    add(tm, ocarina(m, d, 0.24))
                    if sec in ("A2", "A3"):
                        add(tm, strings([m - 12], d, 0.14, 2000))  # strings double an octave below
            tm += beats * BEAT

# Seamless loop: fold the tails back onto the start before the reverb, then reverb with wrap-around.
dry[:TAIL] += dry[LOOP:LOOP + TAIL]
song = dry[:LOOP]
ir_n = int(2.2 * SR)
ir_t = np.arange(ir_n) / SR
ir = lowpass(rng.standard_normal(ir_n), 4500) * np.exp(-ir_t * 3.2)
ir[0] = 0
ir /= np.sqrt(np.sum(ir ** 2))
# circular convolution via FFT so the reverb tail of the end flows into the start (seamless loop)
N = len(song)
wet = np.real(np.fft.ifft(np.fft.fft(song) * np.fft.fft(np.concatenate([ir, np.zeros(N - ir_n)]))))
song = song * 0.82 + wet * 0.28
song = np.tanh(song * 1.2) / np.tanh(1.2)
song = song / np.max(np.abs(song)) * 0.9
pcm = (song * 32767).astype(np.int16)

path = os.path.join(os.path.dirname(__file__), "..", "assets", "music", "monadia_theme.wav")
with wave.open(path, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(path, f"{len(pcm) / SR:.1f} s", os.path.getsize(path) // 1024, "KB")
