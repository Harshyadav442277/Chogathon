// Anyone can cheer a post. Cheers count triple in every Chog's feed ranking.
import { clientKey, err, json, rateLimit } from "@/lib/api";
import { one, run } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = Number(body.postId);
  const post = id ? await one<{ cheers: number }>(`SELECT cheers FROM posts WHERE id = ? AND chog_id > 0`, [id]) : undefined;
  if (!post) return err("That post is gone.", 404);
  const s = await getSession();
  const who = s?.address ? `wallet:${s.address.toLowerCase()}` : `anon:${await clientKey()}`;
  if (!(await rateLimit(`cheer:${who}:${id}`, 1))) return err("You already cheered this one.", 429);
  if (!(await rateLimit(`cheer:${who}`, s ? 30 : 10))) return err("Out of cheers for today.", 429);
  await run(`UPDATE posts SET cheers = cheers + 1 WHERE id = ?`, [id]);
  return json({ ok: true, cheers: Number(post.cheers) + 1 });
}
