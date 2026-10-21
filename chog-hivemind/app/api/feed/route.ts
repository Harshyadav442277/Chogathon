import { feed } from "@/lib/queries";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const loc = u.searchParams.get("loc") || undefined;
  const chog = u.searchParams.get("chog");
  const meme = u.searchParams.get("meme");
  const before = u.searchParams.get("before");
  const posts = await feed({
    location: loc,
    chog: chog ? Number(chog) : undefined,
    meme: meme ? Number(meme) : undefined,
    before: before ? Number(before) : undefined,
    limit: 40,
  });
  return json({ posts });
}
