import { memeDetail } from "@/lib/queries";
import { err, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const m = await memeDetail(Number(id));
  return m ? json({ meme: m }) : err("not found", 404);
}
