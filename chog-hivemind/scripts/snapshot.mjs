// Snapshot every Chog Genesis token: tokenURI -> metadata -> data/chogs.json
// Usage: node scripts/snapshot.mjs
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const RPC = process.env.MONAD_RPC || "https://rpc.monad.xyz";
const CHOG = "0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763";
const SUPPLY = 1969; // token ids 1..1969 (ownerOf(0) reverts)
const GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.filebase.io/ipfs/",
  "https://4everland.io/ipfs/",
];
const OUT = new URL("../data/chogs.json", import.meta.url);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeString(hex) {
  const b = Buffer.from(hex.slice(2), "hex");
  const len = Number(BigInt("0x" + b.subarray(32, 64).toString("hex")));
  return b.subarray(64, 64 + len).toString("utf8");
}

async function rpcBatch(calls) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(calls),
      });
      const json = await res.json();
      if (Array.isArray(json)) return json;
      throw new Error(JSON.stringify(json).slice(0, 200));
    } catch (e) {
      await sleep(500 * 2 ** attempt);
    }
  }
  throw new Error("rpc batch failed");
}

async function tokenURIs() {
  const uris = {};
  const ids = Array.from({ length: SUPPLY }, (_, i) => i + 1);
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const calls = chunk.map((id) => ({
      jsonrpc: "2.0",
      id,
      method: "eth_call",
      params: [{ to: CHOG, data: "0xc87b56dd" + id.toString(16).padStart(64, "0") }, "latest"],
    }));
    const res = await rpcBatch(calls);
    for (const r of res) if (r.result) uris[r.id] = decodeString(r.result);
    process.stdout.write(`\rtokenURI ${Object.keys(uris).length}/${SUPPLY}`);
  }
  console.log();
  return uris;
}

async function fetchJson(ipfsPath, attempt = 0) {
  const gw = GATEWAYS[attempt % GATEWAYS.length];
  try {
    const res = await fetch(gw + ipfsPath, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch (e) {
    if (attempt > 14) throw e;
    await sleep(300 * (1 + attempt));
    return fetchJson(ipfsPath, attempt + 1);
  }
}

async function main() {
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const uris = await tokenURIs();
  const out = { ...prev };
  const todo = Object.entries(uris).filter(([id]) => !out[id]?.attributes);
  let done = 0;
  const worker = async () => {
    while (todo.length) {
      const [id, uri] = todo.shift();
      const path = uri.replace("ipfs://", "");
      try {
        const meta = await fetchJson(path, Number(id) % GATEWAYS.length);
        const traits = Object.fromEntries((meta.attributes || []).map((a) => [a.trait_type, a.value]));
        out[id] = {
          id: Number(id),
          name: meta.name,
          metaN: Number(path.split("/").pop().replace(".json", "")),
          image: meta.image,
          traits,
          attributes: meta.attributes,
        };
      } catch (e) {
        console.error(`\nfailed ${id}: ${e.message}`);
      }
      done++;
      if (done % 25 === 0) {
        process.stdout.write(`\rmetadata ${Object.keys(out).length}/${SUPPLY}`);
        writeFileSync(OUT, JSON.stringify(out));
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`\ndone: ${Object.keys(out).length}/${SUPPLY}`);
}

main();
