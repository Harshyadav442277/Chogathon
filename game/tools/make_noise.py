"""Bake game/textures/noise.png: a 256x256 tileable RGBA value-noise texture for the surface shaders.

Sampled at uv = p / 32, so one lattice cell of R covers one world unit of p:
  R = value noise (lattice 32)          ~ vnoise(p)
  G = 3-octave fbm (lattices 32/64/128) ~ fbm(p)
  B = value noise, other seed           ~ vnoise(p + offset)
  A = value noise (lattice 128)         ~ vnoise(4p)
Run: python game/tools/make_noise.py   (pure Python, deterministic)
"""
import os
import random
import struct
import zlib

N = 256


def lattice(cells, seed):
    rng = random.Random(seed)
    return [[rng.random() for _ in range(cells)] for _ in range(cells)]


def value_noise(cells, seed):
    g = lattice(cells, seed)
    step = N / cells
    out = [[0.0] * N for _ in range(N)]
    for y in range(N):
        fy = y / step
        iy = int(fy)
        ty = fy - iy
        ty = ty * ty * (3 - 2 * ty)
        for x in range(N):
            fx = x / step
            ix = int(fx)
            tx = fx - ix
            tx = tx * tx * (3 - 2 * tx)
            a = g[iy % cells][ix % cells]
            b = g[iy % cells][(ix + 1) % cells]
            c = g[(iy + 1) % cells][ix % cells]
            d = g[(iy + 1) % cells][(ix + 1) % cells]
            out[y][x] = (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty
    return out


def main():
    r = value_noise(32, 1)
    o2 = value_noise(64, 2)
    o3 = value_noise(128, 3)
    b = value_noise(32, 4)
    a = value_noise(128, 5)
    rows = []
    for y in range(N):
        row = bytearray([0])  # PNG filter: none
        for x in range(N):
            g = r[y][x] * 0.55 + o2[y][x] * 0.3 + o3[y][x] * 0.15
            for v in (r[y][x], g, b[y][x], a[y][x]):
                row.append(max(0, min(255, int(round(v * 255)))))
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", N, N, 8, 6, 0, 0, 0)) + chunk(b"IDAT", raw) + chunk(b"IEND", b"")
    out = os.path.join(os.path.dirname(__file__), "..", "textures", "noise.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "wb") as f:
        f.write(png)
    print(out, len(png), "bytes")


if __name__ == "__main__":
    main()
