import { cachedJson } from "@/lib/cache";
import { buildingDetail } from "@/world/buildings";
import { WORLD } from "@/world/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || !WORLD.buildings?.[id]) return Response.json({ error: "not found" }, { status: 404 });
  return cachedJson(req, `building-${id}`, () => buildingDetail(id));
}
