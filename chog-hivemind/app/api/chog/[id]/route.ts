import { chogDetail } from "@/lib/queries";
import { err, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = await chogDetail(Number(id));
  if (!c) return err("not found", 404);
  const { owner, ...pub } = c;
  return json({ chog: { ...pub, owned: !!owner } });
}
