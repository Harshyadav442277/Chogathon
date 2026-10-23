"""Generates the voice-over lines in script.json with edge-tts (Microsoft's neural voices, free, no account) into
build/voice/<id>.mp3 and writes build/voice/durations.json (seconds per line, measured with ffmpeg).
Usage: python tts.py [id ...]   (no ids: all lines)"""
import asyncio
import json
import os
import re
import subprocess
import sys

import edge_tts
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build", "voice")
FF = imageio_ffmpeg.get_ffmpeg_exe()
os.makedirs(OUT, exist_ok=True)
script = json.load(open(os.path.join(HERE, "script.json"), encoding="utf-8"))


def duration(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])


async def one(line):
    v = script["voices"][line["actor"]]
    path = os.path.join(OUT, line["id"] + ".mp3")
    for attempt in range(4):
        try:
            comm = edge_tts.Communicate(line["text"], v["voice"], rate=v["rate"], pitch=v["pitch"], volume=v["volume"], boundary="WordBoundary")
            words = []
            with open(path, "wb") as f:
                async for chunk in comm.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        words.append({"text": chunk["text"], "start": chunk["offset"] / 1e7, "dur": chunk["duration"] / 1e7})
            json.dump(words, open(os.path.join(OUT, line["id"] + ".words.json"), "w"), indent=0)
            return
        except Exception as e:  # the free service now and then drops a request
            print("retry", line["id"], e)
            await asyncio.sleep(2)
    raise RuntimeError("TTS failed for " + line["id"])


async def main(ids):
    lines = [l for l in script["lines"] if not ids or l["id"] in ids]
    for l in lines:
        await one(l)
        print(l["id"], l["actor"], round(duration(os.path.join(OUT, l["id"] + ".mp3")), 2), "s")


asyncio.run(main(sys.argv[1:]))
durs = {l["id"]: round(duration(os.path.join(OUT, l["id"] + ".mp3")), 3) for l in script["lines"] if os.path.exists(os.path.join(OUT, l["id"] + ".mp3"))}
json.dump(durs, open(os.path.join(OUT, "durations.json"), "w"), indent=1)
print("total spoken:", round(sum(durs.values()), 1), "s")
