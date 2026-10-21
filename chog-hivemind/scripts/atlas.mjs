// Pack every Chog thumbnail into one portrait atlas for the 3D world (one texture, one draw call).
// Slot index = tokenId - 1. Missing thumbnails stay transparent.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const TILE = 64, COLS = 45, SUPPLY = 1969;
const ROWS = Math.ceil(SUPPLY / COLS);
const src = (id) => fileURLToPath(new URL(`../public/chogs/${id}.webp`, import.meta.url));
const outDir = new URL("../public/atlas/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const tiles = [];
let missing = 0;
for (let id = 1; id <= SUPPLY; id++) {
  if (!existsSync(src(id))) { missing++; continue; }
  const i = id - 1;
  tiles.push({
    input: await sharp(src(id)).resize(TILE, TILE, { fit: "cover" }).toBuffer(),
    left: (i % COLS) * TILE,
    top: Math.floor(i / COLS) * TILE,
  });
}

await sharp({ create: { width: COLS * TILE, height: ROWS * TILE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(tiles)
  .webp({ quality: 80 })
  .toFile(fileURLToPath(new URL("chogs.webp", outDir)));
writeFileSync(fileURLToPath(new URL("atlas.json", outDir)), JSON.stringify({ tile: TILE, cols: COLS, rows: ROWS, width: COLS * TILE, height: ROWS * TILE, supply: SUPPLY }));
console.log(`atlas ${COLS * TILE}x${ROWS * TILE}, ${tiles.length} portraits, ${missing} missing`);
