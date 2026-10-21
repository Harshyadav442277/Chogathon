import { buildingDetail } from "@/world/buildings";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = await buildingDetail(Number(id));
  return d ? Response.json(d) : Response.json({ error: "not found" }, { status: 404 });
}
