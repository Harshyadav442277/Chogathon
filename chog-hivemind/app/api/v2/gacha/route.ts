import { err, json } from "@/lib/api";
import { chogBalance } from "@/lib/chain";
import { all, getState, one, run } from "@/lib/db";
import { getSession, judgeChogIds } from "@/lib/session";
import { drawOffers, GACHA, GACHA_SCHEMA, ownedChogs, unlocked, type Card, type Pull } from "@/sim3/gacha";
import { ensureSimSchema, MAX_SKILLS, QUEST_BY_ID, seasonMs, SKILL_BY_ID } from "@/sim3/sim";

export const dynamic = "force-dynamic";

// Star Pulls (src/sim3/gacha.ts). GET: your pulls this season, when the next one unlocks, your Chogs.
// POST {action:"pull"}: reveal the next unlocked pull (4 offers).
// POST {action:"choose", pull, option, chogId}: pick one offer of a pull and bestow it on a Chog you hold.
async function player() {
  await ensureSimSchema();
  for (const q of GACHA_SCHEMA) await run(q);
  const s = await getSession();
  if (!s) return null;
  const author = s.judge ? `judge:${s.address}` : s.address.toLowerCase();
  const owned = s.judge ? judgeChogIds() : GACHA.ownOnly ? await ownedChogs(s.address) : [];
  const holder = s.judge ? true : GACHA.ownOnly ? owned.length > 0 : ((await chogBalance(s.address)) ?? 0) > 0;
  const season = Number(await getState("season", "0"));
  const started = Number((await one<any>(`SELECT started_at FROM seasons WHERE n = ?`, [season]))?.started_at ?? Date.now());
  return { author, owned, holder, season, started };
}

type Player = NonNullable<Awaited<ReturnType<typeof player>>>;

async function load(p: Player): Promise<Pull[]> {
  const row = await one<any>(`SELECT pulls FROM star_pulls WHERE author = ? AND season = ?`, [p.author, p.season]);
  return row ? JSON.parse(row.pulls) : [];
}

const save = (p: Player, pulls: Pull[]) => run(
  `INSERT INTO star_pulls(author, season, pulls, created_at) VALUES(?,?,?,?)
   ON CONFLICT(author, season) DO UPDATE SET pulls = excluded.pulls`,
  [p.author, p.season, JSON.stringify(pulls), Date.now()],
);

const cardData = (c: Card) => ({ kind: c.kind, ...(c.kind === "skill" ? SKILL_BY_ID.get(c.id) : QUEST_BY_ID.get(c.id)) });

async function state(p: Player, extra: Record<string, unknown> = {}) {
  const pulls = await load(p);
  const ids = [...new Set([...p.owned.slice(0, 200), ...pulls.map((x) => x.chog).filter((x): x is number => x != null)])];
  const names = ids.length ? await all<any>(`SELECT id, name FROM chogs WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id`, ids) : [];
  const nameOf = new Map(names.map((r) => [Number(r.id), String(r.name)]));
  const u = unlocked(p.started, seasonMs());
  return {
    signedIn: true, holder: p.holder, config: GACHA, season: p.season, now: Date.now(),
    unlocked: u.count, nextAt: u.nextAt, pullsLeft: Math.max(0, u.count - pulls.length), pullsTotal: GACHA.pulls,
    pulls: pulls.map((x, index) => ({
      index, chosen: x.chosen, chog: x.chog, chogName: x.chog != null ? nameOf.get(x.chog) ?? `Chog #${x.chog}` : null,
      offers: x.offers.map(cardData),
    })),
    owned: p.owned.slice(0, 200).map((id) => ({ id, name: nameOf.get(id) ?? `Chog #${id}` })),
    ...extra,
  };
}

export async function GET() {
  const p = await player();
  if (!p) return json({ signedIn: false, holder: false, config: GACHA, pulls: [], pullsLeft: 0, pullsTotal: GACHA.pulls });
  return json(await state(p));
}

export async function POST(req: Request) {
  const p = await player();
  if (!p) return err("Connect your wallet first.", 401);
  if (!p.holder) return err("Only Chog holders draw from the stars. Stargazers can watch everything.", 403);
  const body = await req.json().catch(() => ({}));
  const pulls = await load(p);
  if (body.action === "pull") {
    const u = unlocked(p.started, seasonMs());
    if (pulls.length >= GACHA.pulls) return err(`All ${GACHA.pulls} pulls are used this season. A new season brings new ones.`, 429);
    if (pulls.length >= u.count) return err("The next pull hasn't risen yet. Check the timer.", 429);
    pulls.push({ offers: drawOffers(p.author, p.season, pulls.length, pulls), chosen: null, chog: null, at: Date.now() });
    await save(p, pulls);
    return json(await state(p, { drawn: pulls.length - 1, message: "The stars answer. Choose one." }));
  }
  if (body.action !== "choose") return err("action must be pull or choose", 400);
  const pull = pulls[Number(body.pull)];
  const option = Number(body.option);
  const chogId = Number(body.chogId);
  if (!pull) return err("Pull first.", 400);
  if (pull.chosen != null) return err("You already chose from this pull.", 400);
  const card = pull.offers[option];
  if (!card) return err("Pick one of the offered cards.", 400);
  if (GACHA.ownOnly && !p.owned.includes(chogId)) return err("You can only bestow cards on Chogs you hold.", 403);
  const agent = await one<any>(`SELECT a.skills, cs.track FROM agents a JOIN chog_season cs ON cs.chog_id = a.chog_id AND cs.season = a.season WHERE a.chog_id = ?`, [chogId]);
  if (!agent) return err("That Chog hasn't been summoned this season.", 404);
  if (agent.track === "demon") return err("Demons don't listen to the stars.", 400);
  if (card.kind === "skill") {
    const skills: string[] = JSON.parse(agent.skills || "[]");
    if (skills.includes(card.id)) return err("This Chog already knows that skill. Pick another card or Chog.", 400);
    if (skills.length >= MAX_SKILLS) return err(`A Chog can hold at most ${MAX_SKILLS} skills. Pick a quest or another Chog.`, 400);
  }
  const day = new Date().toISOString().slice(0, 10);
  await run(`INSERT INTO gifts(day, author, kind, chog_id, ref, created_at) VALUES(?,?,?,?,?,?)`, [day, p.author, card.kind, chogId, card.id, Date.now()]);
  pull.chosen = option;
  pull.chog = chogId;
  await save(p, pulls);
  return json(await state(p, { message: card.kind === "skill" ? "Bestowed. It appears in their Status Window on the next tick." : "Bestowed. They set off on the next tick." }));
}
