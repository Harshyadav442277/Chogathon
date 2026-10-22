import { cachedJson, perVersion } from "@/lib/cache";
import { positions } from "@/world/data";

export const dynamic = "force-dynamic";

// Polled by every viewer every few seconds; built once per world version (see src/lib/cache.ts).
export async function GET(req: Request) {
  return cachedJson(req, "positions", () => perVersion("positions", positions));
}
