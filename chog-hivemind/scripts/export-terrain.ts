// Export the continent for the Godot client as raw binaries (exact values, no texture import):
//   terrain_height.bin = float32 LE heights, row-major (z rows, x columns); terrain_color.bin = uint8 RGBA (sRGB color + lava/emission in alpha).
// Same deterministic height()/colorAt() as the server and the three.js view.
//   npm run export:terrain
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { colorAt, height, WORLD_D, WORLD_W } from "../src/world/terrain";

export const GRID_X = 321, GRID_Z = 281;
export const SIZE_X = WORLD_W * 1.2, SIZE_Z = WORLD_D * 1.25;

const out = fileURLToPath(new URL("../../game/data/", import.meta.url));
mkdirSync(out, { recursive: true });

const hbuf = Buffer.alloc(GRID_X * GRID_Z * 4);
const cbuf = Buffer.alloc(GRID_X * GRID_Z * 4);
for (let j = 0; j < GRID_Z; j++) {
  for (let i = 0; i < GRID_X; i++) {
    const x = -SIZE_X / 2 + (i / (GRID_X - 1)) * SIZE_X;
    const z = -SIZE_Z / 2 + (j / (GRID_Z - 1)) * SIZE_Z;
    const h = height(x, z);
    const k = (j * GRID_X + i) * 4;
    hbuf.writeFloatLE(h, (j * GRID_X + i) * 4);
    const c = colorAt(x, z, h); // sRGB 0..1 + emission
    cbuf[k] = Math.round(c[0] * 255); cbuf[k + 1] = Math.round(c[1] * 255); cbuf[k + 2] = Math.round(c[2] * 255); cbuf[k + 3] = Math.round(c[3] * 255);
  }
}
function main() {
  writeFileSync(out + "terrain_height.bin", hbuf);
  writeFileSync(out + "terrain_color.bin", cbuf);
  writeFileSync(out + "terrain_meta.json", JSON.stringify({ grid_x: GRID_X, grid_z: GRID_Z, size_x: SIZE_X, size_z: SIZE_Z }));
  console.log(`terrain exported to ${out} (${GRID_X}x${GRID_Z})`);
}

main();
