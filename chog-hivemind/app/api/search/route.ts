import { searchChogs } from "@/lib/queries";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").slice(0, 40);
  return json({ results: q ? await searchChogs(q) : [] });
}
