import { clientKey, err, json, rateLimit } from "@/lib/api";
import { run } from "@/lib/db";
import { cleanText, isAcceptable } from "@/lib/moderation";
import { getSession } from "@/lib/session";
import { LOCATION_IDS } from "@/sim/world";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const location = String(body.location ?? "");
  const text = cleanText(String(body.text ?? ""), 140);
  if (!(LOCATION_IDS as string[]).includes(location)) return err("Pick a place in town.");
  if (!isAcceptable(text)) return err("Rumors must be 3–140 characters and kind enough for a town of Chogs.");
  const s = await getSession();
  const who = s?.address ? `wallet:${s.address.toLowerCase()}` : `anon:${await clientKey()}`;
  if (!(await rateLimit(`rumor:${who}`, s ? 3 : 1))) return err("You've already started enough trouble today.", 429);
  await run(
    `INSERT INTO injections(kind, location, author, text, day, created_at) VALUES('rumor', ?, ?, ?, ?, ?)`,
    [location, who, text, new Date().toISOString().slice(0, 10), Date.now()],
  );
  return json({ ok: true, message: "Rumor dropped. Whoever's nearby might pick it up on the next tick." });
}
