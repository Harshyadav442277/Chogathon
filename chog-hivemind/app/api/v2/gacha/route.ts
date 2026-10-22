import { err, json } from "@/lib/api";
import { chogBalance } from "@/lib/chain";
import { all, one, run } from "@/lib/db";
import { getSession, judgeChogIds } from "@/lib/session";
import { GACHA, GACHA_SCHEMA, ownedChogs, rollPull } from "@/sim3/gacha";
import { ensureSimSchema, MAX_SKILLS, QUEST_BY_ID, SKILL_BY_ID } from "@/sim3/sim";

export const dynamic = "force-dynamic";

// Daily gacha (src/sim3/gacha.ts). GET: your hand, what's left to bestow and your Chogs.
// POST {action:"pull"}: draw today's hand. POST {action:"give", kind:"skill"|"quest", ref, chogId}: bestow one card.
const today = () => new Date().toISOString().slice(0, 10);

async function player() {
  await ensureSimSchema();
  for (const q of GACHA_SCHEMA) await run(q);
  const s = await getSession();
  if (!s) return null;
  const author = s.judge ? `judge:${s.address}` : s.address.toLowerCase();
  const owned = s.judge ? judgeChogIds() : GACHA.ownOnly ? await ownedChogs(s.address) : [];
  const holder = s.judge ? true : GACHA.ownOnly ? owned.length > 0 : ((await chogBalance(s.address)) ?? 0) > 0;
  return { author, owned, holder };
}

async function state(p: NonNullable<Awaited<ReturnType<typeof player>>>) {
  const row = await one<any>(`SELECT skills, quests, used FROM pulls WHERE author = ? AND day = ?`, [p.author, today()]);
  const used: string[] = row ? JSON.parse(row.used) : [];
  const names = p.owned.length
    ? await all<any>(`SELECT id, name FROM chogs WHERE id IN (${p.owned.slice(0, 200).map(() => "?").join(",")}) ORDER BY id`, p.owned.slice(0, 200))
    : [];
  const card = (kind: string, id: string) => ({ ...(kind === "skill" ? SKILL_BY_ID.get(id) : QUEST_BY_ID.get(id)), used: used.includes(`${kind}:${id}`) });
  return {
    signedIn: true, holder: p.holder, config: GACHA, day: today(),
    pull: row ? { skills: JSON.parse(row.skills).map((id: string) => card("skill", id)), quests: JSON.parse(row.quests).map((id: string) => card("quest", id)) } : null,
    given: { skills: used.filter((u) => u.startsWith("skill:")).length, quests: used.filter((u) => u.startsWith("quest:")).length },
    owned: names.map((r) => ({ id: Number(r.id), name: r.name })),
  };
}

export async function GET() {
  const p = await player();
  if (!p) return json({ signedIn: false, holder: false, config: GACHA, pull: null });
  return json(await state(p));
}

export async function POST(req: Request) {
  const p = await player();
  if (!p) return err("Connect your wallet first.", 401);
  if (!p.holder) return err(GACHA.ownOnly ? "Only Chog holders draw from the stars. Stargazers can watch everything." : "Only Chog holders draw from the stars.", 403);
  const body = await req.json().catch(() => ({}));
  const season = Number((await one<any>(`SELECT value FROM state WHERE key = 'season'`))?.value ?? 0);
  if (body.action === "pull") {
    const hand = rollPull(p.author, today(), season);
    await run(`INSERT OR IGNORE INTO pulls(author, day, season, skills, quests, created_at) VALUES(?,?,?,?,?,?)`,
      [p.author, today(), season, JSON.stringify(hand.skills), JSON.stringify(hand.quests), Date.now()]);
    return json({ ...(await state(p)), message: "The stars have dealt your hand for today." });
  }
  if (body.action !== "give") return err("action must be pull or give", 400);
  const kind = String(body.kind);
  const ref = String(body.ref);
  const chogId = Number(body.chogId);
  const row = await one<any>(`SELECT skills, quests, used FROM pulls WHERE author = ? AND day = ?`, [p.author, today()]);
  if (!row) return err("Draw today's hand first.", 400);
  const used: string[] = JSON.parse(row.used);
  const hand: string[] = JSON.parse(kind === "skill" ? row.skills : row.quests);
  if (!hand.includes(ref)) return err("That card isn't in today's hand.", 400);
  if (used.includes(`${kind}:${ref}`)) return err("You've already bestowed that card.", 400);
  const limit = kind === "skill" ? GACHA.giveSkills : GACHA.giveQuests;
  if (used.filter((u) => u.startsWith(`${kind}:`)).length >= limit) return err(`You can bestow ${limit} ${kind}s a day. More tomorrow at 00:00 UTC.`, 429);
  if (GACHA.ownOnly && !p.owned.includes(chogId)) return err("You can only bestow cards on Chogs you hold.", 403);
  const agent = await one<any>(`SELECT a.skills, cs.track FROM agents a JOIN chog_season cs ON cs.chog_id = a.chog_id AND cs.season = a.season WHERE a.chog_id = ?`, [chogId]);
  if (!agent) return err("That Chog hasn't been summoned this season.", 404);
  if (agent.track === "demon") return err("Demons don't listen to the stars.", 400);
  if (kind === "skill") {
    const skills: string[] = JSON.parse(agent.skills || "[]");
    if (skills.includes(ref)) return err("This Chog already knows that skill.", 400);
    if (skills.length >= MAX_SKILLS) return err(`A Chog can hold at most ${MAX_SKILLS} skills.`, 400);
  }
  await run(`INSERT INTO gifts(day, author, kind, chog_id, ref, created_at) VALUES(?,?,?,?,?,?)`, [today(), p.author, kind, chogId, ref, Date.now()]);
  await run(`UPDATE pulls SET used = ? WHERE author = ? AND day = ?`, [JSON.stringify([...used, `${kind}:${ref}`]), p.author, today()]);
  return json({ ...(await state(p)), message: kind === "skill" ? "Bestowed. It appears in their Status Window on the next tick." : "Bestowed. They set off on the next tick." });
}
