"""Sound-effect library for the video: decodes the CC0 packs in assets_audio/lib (Kenney.nl, OpenGameArt swishes) to
48 kHz stereo float arrays on demand, trims leading silence so a cue lands exactly on its time, and normalises level.
Licenses: all CC0 (see the License.txt files in each pack)."""
import glob
import os
import subprocess

import imageio_ffmpeg
import numpy as np
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, "assets_audio")
CACHE = os.path.join(HERE, "assets_audio", "wav")
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000
os.makedirs(CACHE, exist_ok=True)


def find(pattern):
    hits = sorted(glob.glob(os.path.join(LIB, "**", pattern), recursive=True))
    hits = [h for h in hits if "__MACOSX" not in h and not os.path.basename(h).startswith("._")
            and os.sep + "wav" + os.sep not in h and os.sep + "zips" + os.sep not in h]
    if not hits:
        raise FileNotFoundError(pattern)
    return hits[0]


def wav_of(path):
    key = os.path.relpath(path, LIB).replace(os.sep, "__").replace(" ", "_")
    out = os.path.join(CACHE, key + ".wav")
    if not os.path.exists(out):
        r = subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", path, "-ar", str(SR), "-ac", "2", out], capture_output=True)
        if r.returncode:
            raise RuntimeError(r.stderr.decode()[-300:])
    return out


def load(pattern, target_db=-14.0, trim=True, max_s=None):
    """A sample by file-name pattern: trimmed of leading silence, normalised so its RMS (over the audible part) hits target_db."""
    sr, x = wavfile.read(wav_of(find(pattern)))
    x = x.astype(np.float64) / 32768.0
    if trim:
        env = np.abs(x).max(axis=1)
        idx = np.argmax(env > 0.02 * max(env.max(), 1e-6))
        x = x[max(0, idx - int(0.004 * SR)):]
    if max_s:
        x = x[: int(max_s * SR)]
        x[-int(0.05 * SR):] *= np.linspace(1, 0, min(len(x), int(0.05 * SR)))[:, None]
    rms = np.sqrt(np.mean(x ** 2)) + 1e-9
    x = x * (10 ** (target_db / 20) / rms)
    peak = np.abs(x).max()
    if peak > 0.95:
        x *= 0.95 / peak
    return x


def stats(pattern):
    sr, x = wavfile.read(wav_of(find(pattern)))
    x = x.astype(np.float64) / 32768.0
    m = x.mean(axis=1)
    spec = np.abs(np.fft.rfft(m * np.hanning(len(m))))
    freqs = np.fft.rfftfreq(len(m), 1 / SR)
    cen = (spec * freqs).sum() / (spec.sum() + 1e-9)
    return dict(dur=len(m) / SR, peak=float(np.abs(x).max()), rms_db=float(20 * np.log10(np.sqrt(np.mean(m ** 2)) + 1e-9)), centroid=float(cen))
