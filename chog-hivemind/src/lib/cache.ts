// Versioned response cache for the polled endpoints (positions, Star Stream, building panels).
// The world only changes when a simulation tick finishes, so every response is keyed by the
// "world version" (season + last finished tick). Within a version:
// - the JSON is built once and reused (no repeated SQL per viewer),
// - concurrent requests share one in-flight build (no thundering herd after a tick),
// - clients that send the ETag they already have get 304 with no body (no download, no parse),
// - a CDN may serve it for a few seconds (s-maxage) so many viewers cost one origin request.
import { getState } from "./db";

type Entry = { version: string; etag: string; body: string; at: number };

const entries = new Map<string, Entry>();
const building = new Map<string, Promise<Entry>>();
const MAX_ENTRIES = 300;

/** Season + last finished tick. Changes exactly when the world changes. */
export async function worldVersion(): Promise<string> {
  const [season, done] = await Promise.all([getState("season", "0"), getState("tick_done", "")]);
  // Before the first finished tick (fresh database), fall back to the tick counter.
  return `${season}.${done || (await getState("tick", "0"))}`;
}

/**
 * Serve `build()` as JSON, cached per world version under `key`. `maxAgeMs` additionally expires an
 * entry for data that can change between ticks (e.g. holder actions queued in the stream).
 */
export async function cachedJson(req: Request, key: string, build: () => Promise<unknown>, opts: { maxAgeMs?: number; sMaxAge?: number } = {}) {
  const version = await worldVersion();
  const now = Date.now();
  let e = entries.get(key);
  const fresh = e && e.version === version && (!opts.maxAgeMs || now - e.at < opts.maxAgeMs);
  if (!fresh) {
    const flightKey = `${key}@${version}`;
    let p = building.get(flightKey);
    if (!p) {
      p = (async () => {
        const body = JSON.stringify(await build());
        const entry: Entry = { version, etag: `W/"${key.replace(/[^a-z0-9]/gi, "_")}-${version}-${now.toString(36)}"`, body, at: now };
        if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value!);
        entries.set(key, entry);
        return entry;
      })().finally(() => building.delete(flightKey));
      building.set(flightKey, p);
    }
    e = await p;
  }
  const headers = {
    ETag: e!.etag,
    "Cache-Control": `public, max-age=0, s-maxage=${opts.sMaxAge ?? 5}, stale-while-revalidate=30`,
    "X-World-Version": e!.version,
  };
  if (req.headers.get("if-none-match") === e!.etag) return new Response(null, { status: 304, headers });
  return new Response(e!.body, { headers: { ...headers, "Content-Type": "application/json" } });
}

const objects = new Map<string, { version: string; value: Promise<unknown> }>();

/** Build an object once per world version and share it (also between concurrent callers). */
export async function perVersion<T>(key: string, build: () => Promise<T>): Promise<T> {
  const version = await worldVersion();
  const hit = objects.get(key);
  if (hit && hit.version === version) return hit.value as Promise<T>;
  const value = build();
  objects.set(key, { version, value });
  value.catch(() => objects.delete(key));
  return value;
}
