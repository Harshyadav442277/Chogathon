// Holder commands: whisper, journey (nudge), introduce, gift. Each costs 1 Mon Energy.
import { err, json } from "@/lib/api";
import { one, run } from "@/lib/db";
import { canCommand, energyLeft, holderKey, queueCommand } from "@/lib/holder";
import { cleanText, isAcceptable } from "@/lib/moderation";
import { getSession } from "@/lib/session";
import { GIFTS, LOCATION_IDS, locationName } from "@/sim/world";

export const dynamic = "force-dynamic";

const DONE: Record<string, string> = {
  whisper: "Whispered. Your Chog will hear it on the next tick and decide for itself.",
  nudge: "Asked. Your Chog may go, take a detour, or stay put.",
  introduce: "Introduced. Your Chog will decide whether it likes them.",
  gift: "Gift left. Your Chog will find it on the next tick.",
};

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return err("Connect your wallet first.", 401);
  const body = await req.json().catch(() => ({}));
  const id = Number(body.chogId);
  const kind = String(body.kind ?? "");
  if (!id || !(kind in DONE)) return err("Unknown action.");

  let text = "";
  let location: string | null = null;
  let target: number | null = null;
  if (kind === "whisper") {
    text = cleanText(String(body.text ?? ""), 140);
    if (!isAcceptable(text)) return err("Whispers must be 3–140 characters and kind enough for a town of Chogs.");
  } else if (kind === "nudge") {
    location = String(body.location ?? "");
    if (!(LOCATION_IDS as string[]).includes(location)) return err("Pick a place in town.");
    text = `Go to ${locationName(location)}.`;
  } else if (kind === "introduce") {
    target = Number(body.targetChog);
    const t = target && target !== id ? await one<{ name: string }>(`SELECT name FROM chogs WHERE id = ? AND id > 0`, [target]) : undefined;
    if (!t) return err("Pick another Chog to introduce.");
    text = `Meet ${t.name}.`;
  } else {
    text = GIFTS[Number(body.gift)] ?? "";
    if (!text) return err("Pick a gift.");
  }

  if (!(await canCommand(s, id))) return err("Only this Chog's holder can do that.", 403);
  const author = await holderKey(s);
  const queued = await queueCommand({ kind, chogId: id, location, target, author, text });
  if (queued === "repeat") return err(`One ${kind === "nudge" ? "journey" : kind} per Chog per day.`, 429);
  if (queued === "empty") return err("Out of Mon Energy for today. It refills at 00:00 UTC.", 429);
  if (kind === "whisper") await run(`UPDATE chogs SET bond = MIN(100, bond + 2) WHERE id = ?`, [id]);
  return json({ ok: true, message: DONE[kind], energy: await energyLeft(author) });
}
