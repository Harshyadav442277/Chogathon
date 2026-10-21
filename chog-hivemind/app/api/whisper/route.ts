import { err, json } from "@/lib/api";
import { one, run } from "@/lib/db";
import { ownerOf } from "@/lib/chain";
import { cleanText, isAcceptable } from "@/lib/moderation";
import { getSession, judgeChogIds } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return err("Connect your wallet first.", 401);
  const body = await req.json().catch(() => ({}));
  const id = Number(body.chogId);
  const text = cleanText(String(body.text ?? ""), 140);
  if (!id || !isAcceptable(text)) return err("Whispers must be 3–140 characters and kind enough for a town of Chogs.");

  let allowed = false;
  if (s.judge) allowed = judgeChogIds().includes(id);
  else {
    const owner = await ownerOf(id);
    allowed = !!owner && owner.toLowerCase() === s.address.toLowerCase();
    if (allowed) await run(`UPDATE chogs SET owner = ? WHERE id = ?`, [owner!.toLowerCase(), id]);
  }
  if (!allowed) return err("Only this Chog's holder can whisper to it.", 403);

  const day = new Date().toISOString().slice(0, 10);
  const used = await one<any>(`SELECT COUNT(*) n FROM injections WHERE kind = 'whisper' AND chog_id = ? AND day = ?`, [id, day]);
  if (Number(used?.n ?? 0) >= 1) return err("One whisper per Chog per day. Your Chog is still thinking about the last one.", 429);

  await run(
    `INSERT INTO injections(kind, chog_id, author, text, day, created_at) VALUES('whisper', ?, ?, ?, ?, ?)`,
    [id, s.address.toLowerCase(), text, day, Date.now()],
  );
  await run(`UPDATE chogs SET bond = MIN(100, bond + 2) WHERE id = ?`, [id]);
  return json({ ok: true, message: "Whispered. Your Chog will hear it on the next tick and decide for itself." });
}
