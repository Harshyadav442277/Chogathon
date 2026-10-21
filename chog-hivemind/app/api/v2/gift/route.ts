import { err, json } from "@/lib/api";
import { chogBalance } from "@/lib/chain";
import { all, one, run } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ensureSimSchema, DAILY_STAR_POINTS, MAX_SKILLS, QUEST_BY_ID, SKILL_BY_ID } from "@/sim3/sim";

export const dynamic = "force-dynamic";

// Constellation powers: a wallet holding at least one Chog (or a judge session) gets DAILY_STAR_POINTS per UTC day
// to grant a skill or give a quest to ANY Chog. Gifts apply on the next simulation tick.

const today = () => new Date().toISOString().slice(0, 10);

async function budget() {
  await ensureSimSchema();
  const s = await getSession();
  if (!s) return { signedIn: false, holder: false, used: 0, limit: DAILY_STAR_POINTS, author: null as string | null };
  const author = s.judge ? `judge:${s.address}` : s.address.toLowerCase();
  const holder = s.judge ? true : ((await chogBalance(s.address)) ?? 0) > 0;
  const used = Number((await one<any>(`SELECT COUNT(*) n FROM gifts WHERE author = ? AND day = ?`, [author, today()]))?.n ?? 0);
  return { signedIn: true, holder, used, limit: DAILY_STAR_POINTS, author };
}

export async function GET() {
  const b = await budget();
  const recent = b.author
    ? await all<any>(`SELECT kind, chog_id, ref, status, created_at FROM gifts WHERE author = ? ORDER BY id DESC LIMIT 10`, [b.author])
    : [];
  return json({ ...b, author: undefined, recent });
}

export async function POST(req: Request) {
  const b = await budget();
  if (!b.signedIn) return err("Connect your wallet first.", 401);
  if (!b.holder) return err("Only Chog holders are Constellations. Stargazers can watch everything.", 403);
  if (b.used >= b.limit) return err(`You've used all ${b.limit} Star Points today. They refill at 00:00 UTC.`, 429);
  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind ?? "");
  const chogId = Number(body.chogId);
  const ref = String(body.ref ?? "");
  const agent = await one<any>(`SELECT a.skills, cs.track FROM agents a JOIN chog_season cs ON cs.chog_id = a.chog_id AND cs.season = a.season WHERE a.chog_id = ?`, [chogId]);
  if (!agent) return err("That Chog hasn't been summoned this season.", 404);
  if (agent.track === "demon") return err("Demons don't listen to the stars.", 400);
  if (kind === "skill") {
    if (!SKILL_BY_ID.has(ref)) return err("Unknown skill.", 400);
    const skills: string[] = JSON.parse(agent.skills || "[]");
    if (skills.includes(ref)) return err("This Chog already knows that skill.", 400);
    if (skills.length >= MAX_SKILLS) return err(`A Chog can hold at most ${MAX_SKILLS} skills.`, 400);
  } else if (kind === "quest") {
    const q = QUEST_BY_ID.get(ref);
    if (!q || (q.boss && q.boss !== "seal")) return err("Unknown quest.", 400);
  } else return err("kind must be skill or quest", 400);
  await run(`INSERT INTO gifts(day, author, kind, chog_id, ref, created_at) VALUES(?,?,?,?,?,?)`, [today(), b.author, kind, chogId, ref, Date.now()]);
  return json({ ok: true, used: b.used + 1, limit: b.limit, message: kind === "skill" ? "Granted. It appears in their Status Window on the next tick." : "Given. They set off on the next tick." });
}
