// Download every Chog image once and write a small 160px WebP thumbnail to public/chogs/<tokenId>.webp
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const GATEWAYS = ["https://gateway.pinata.cloud/ipfs/", "https://ipfs.filebase.io/ipfs/", "https://4everland.io/ipfs/"];
const chogs = Object.values(JSON.parse(readFileSync(new URL("../data/chogs.json", import.meta.url), "utf8")));
const outDir = new URL("../public/chogs/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchImage(path, attempt = 0) {
  const gw = GATEWAYS[attempt % GATEWAYS.length];
  try {
    const res = await fetch(gw + path, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(String(res.status));
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    if (attempt > 11) throw e;
    await sleep(400 * (1 + attempt));
    return fetchImage(path, attempt + 1);
  }
}

const todo = chogs.filter((c) => c.image && !existsSync(new URL(`${c.id}.webp`, outDir)));
console.log(`thumbnails to make: ${todo.length}`);
let done = 0;
async function worker(k) {
  while (todo.length) {
    const c = todo.shift();
    try {
      const buf = await fetchImage(c.image.replace("ipfs://", ""), k);
      await sharp(buf).resize(160, 160, { fit: "cover" }).webp({ quality: 72 }).toFile(fileURLToPath(new URL(`${c.id}.webp`, outDir)));
    } catch (e) {
      console.error(`\nthumb ${c.id} failed: ${e.message}`);
    }
    if (++done % 25 === 0) process.stdout.write(`\r${done} done`);
  }
}
await Promise.all(Array.from({ length: 6 }, (_, k) => worker(k)));
console.log("\nthumbnails complete");
