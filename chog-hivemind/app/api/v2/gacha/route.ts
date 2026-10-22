import { err, json } from "@/lib/api";
import { chogBalance } from "@/lib/chain";
import { all, getState, one, run } from "@/lib/db";
import { getSession, judgeChogIds } from "@/lib/session";
import { drawCard, GACHA, GACHA_SCHEMA, ownedChogs, type Card } from "@/sim3/gacha";
import { ensureSimSchema, MAX_SKILLS, QUEST_BY_ID, SKILL_BY_ID } from "@/sim3/sim";

export const dynamic = "force-dynamic";

// Star Pulls (src/sim3/gacha.ts). GET: your cards this season, pulls left, your Chogs.
// POST {action:"pull"}: reveal one card. POST {action:"give", index, chogId}: bestow a pulled card.
async function player() {
  await ensureSimSchema();
  for (const q of GACHA_SCHEMA) await run(q);
  const s = await getSession();
  if (!s) return null;
  const author = s.judge ? `judge:${s.address}` : s.address.toLowerCase();
  const owned = s.judge ? judgeChogIds() : GACHA.ownOnly ? await ownedChogs(s.address) : [];
  const holder = s.judge ? true : GACHA.ownOnly ? owned.length > 0 : ((await chogBalance(s.address)) ?? 0) > 0;
  const season = Number(await getState("season", "0"));
  return { author, owned, holder, season };
}

type Player = NonNullable<Awaited<ReturnType<typeof player>>>;

async function load(p: Player) {
  const row = await one<any>(`SELECT cards, used FROM season_pulls WHERE author = ? AND season = ?`, [p.author, p.season]);
  return { cards: (row ? JSON.parse(row.cards) : []) as Card[], used: (row ? JSON.parse(row.used) : []) as number[] };
}

async function state(p: Player, extra: Record<string, unknown> = {}) {
  const { cards, used } = await load(p);
  const names = p.owned.length
    ? await all<any>(`SELECT id, name FROM chogs WHERE id IN (${p.owned.slice(0, 200).map(() => "?").join(",")}) ORDER BY id`, p.owned.slice(0, 200))
    : [];
  return {
    signedIn: true, holder: p.holder, config: GACHA, season: p.season,
    pullsLeft: Math.max(0, GACHA.pulls - cards.length),
    cards: cards.map((c, index) => ({ index, kind: c.kind, ...(c.kind === "skill" ? SKILL_BY_ID.get(c.id) : QUEST_BY_ID.get(c.id)), used: used.includes(index) })),
    owned: names.map((r) => ({ id: Number(r.id), name: r.name })),
    ...extra,
  };
}

export async function GET() {
  const p = await player();
  if (!p) return json({ signedIn: false, holder: false, config: GACHA, cards: [], pullsLeft: 0 });
  return json(await state(p));
}

export async function POST(req: Request) {
  const p = await player();
  if (!p) return err("Connect your wallet first.", 401);
  if (!p.holder) return err("Only Chog holders draw from the stars. Stargazers can watch everything.", 403);
  const body = await req.json().catch(() => ({}));
  const { cards, used } = await load(p);
  if (body.action === "pull") {
    if (cards.length >= GACHA.pulls) return err(`All ${GACHA.pulls} pulls are used this season. A new season starts every day.`, 429);
    const card = drawCard(p.author, p.season, cards.length, cards);
    cards.push(card);
    await run(
      `INSERT INTO season_pulls(author, season, cards, used, created_at) VALUES(?,?,?,?,?)
       ON CONFLICT(author, season) DO UPDATE SET cards = excluded.cards`,
      [p.author, p.season, JSON.stringify(cards), JSON.stringify(used), Date.now()],
    );
    return json(await state(p, { drawn: cards.length - 1, message: "The stars answer." }));
  }
  if (body.action !== "give") return err("action must be pull or give", 400);
  const index = Number(body.index);
  const chogId = Number(body.chogId);
  const card = cards[index];
  if (!card) return err("Pull a card first.", 400);
  if (used.includes(index)) return err("That card has already been bestowed.", 400);
  if (GACHA.ownOnly && !p.owned.includes(chogId)) return err("You can only bestow cards on Chogs you hold.", 403);
  const agent = await one<any>(`SELECT a.skills, cs.track FROM agents a JOIN chog_season cs ON cs.chog_id = a.chog_id AND cs.season = a.season WHERE a.chog_id = ?`, [chogId]);
  if (!agent) return err("That Chog hasn't been summoned this season.", 404);
  if (agent.track === "demon") return err("Demons don't listen to the stars.", 400);
  if (card.kind === "skill") {
    const skills: string[] = JSON.parse(agent.skills || "[]");
    if (skills.includes(card.id)) return err("This Chog already knows that skill.", 400);
    if (skills.length >= MAX_SKILLS) return err(`A Chog can hold at most ${MAX_SKILLS} skills.`, 400);
  }
  const day = new Date().toISOString().slice(0, 10);
  await run(`INSERT INTO gifts(day, author, kind, chog_id, ref, created_at) VALUES(?,?,?,?,?,?)`, [day, p.author, card.kind, chogId, card.id, Date.now()]);
  await run(`UPDATE season_pulls SET used = ? WHERE author = ? AND season = ?`, [JSON.stringify([...used, index]), p.author, p.season]);
  return json(await state(p, { message: card.kind === "skill" ? "Bestowed. It appears in their Status Window on the next tick." : "Bestowed. They set off on the next tick." }));
}
