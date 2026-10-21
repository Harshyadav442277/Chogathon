import { WORLD } from "@/world/data";

export const dynamic = "force-static";

export function GET() {
  return Response.json(WORLD, { headers: { "cache-control": "public, max-age=3600" } });
}
