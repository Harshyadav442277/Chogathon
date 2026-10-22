import { cachedJson, perVersion } from "@/lib/cache";
import { positions } from "@/world/data";
import { maybeTick } from "@/sim/autotick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;  // room for a background tick (about 6 s on Vercel)

// Polled by every viewer every few seconds; built once per world version (see src/lib/cache.ts).
export async function GET(req: Request) {
  maybeTick();
  return cachedJson(req, "positions", () => perVersion("positions", positions));
}
