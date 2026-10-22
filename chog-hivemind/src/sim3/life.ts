// A Chog's life story: a walk over the life graph (data/story/life_*.json) that takes everything known about one
// Chog (NFT traits, job, season history, relationships, past lives) and tells it as sections: origin, the summoning,
// this season, bonds, rumours, legacy and past lives. Deterministic by Chog id and season: the same Chog always has
// the same childhood and temperament, while the season's events change what is told. No model.
import { all, getState, one } from "../lib/db";
import { JOB_BY_ID } from "../sim2/season";
import { chanceOk, evalCond, expand, pickVariant, pickWeighted, shortName, type Env, type Grammar, type StoryNode } from "../story/engine";
import { buildProfile, CALLING, CHILDHOOD, TURNING } from "./lore";
import { placeName, SKILL_BY_ID } from "./sim";
import { WORLD } from "../world/data";
import lifeA from "../../data/story/life_a.json";
import lifeB from "../../data/story/life_b.json";
import lifePast from "../../data/story/life_past.json";

type Row = { season: number; tick: number; kind: string; other: number | null; ref: string | null; text: string };
type LifeNode = StoryNode & { section: string; order?: number };

const FILES = [lifeA, lifeB, lifePast] as unknown as { grammar?: Grammar; nodes: LifeNode[] }[];
export const LIFE_NODES: LifeNode[] = FILES.flatMap((f) => f.nodes);
export const LIFE_GRAMMAR: Grammar = {
  ...Object.assign({}, ...FILES.map((f) => f.grammar ?? {})),
  childhood: CHILDHOOD, calling: CALLING, turning: TURNING,
};

const SECTIONS: { id: string; title: string; max: number; stable?: boolean }[] = [
  { id: "origin", title: "Before the Summoning", max: 4, stable: true },
  { id: "summoning", title: "The Summoning", max: 1 },
  { id: "season", title: "This Season", max: 9 },
  { id: "bonds", title: "Bonds", max: 5 },
  { id: "rumors", title: "What People Say", max: 5, stable: true },
  { id: "legacy", title: "Legacy", max: 2 },
];

const article = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);
const label = (author: unknown) => {
  const s = String(author);
  return s.startsWith("judge") ? "a judge" : s.startsWith("0x") ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
};
const count = (list: Row[], ...kinds: string[]) => list.filter((r) => kinds.includes(r.kind)).length;
const top = (list: (number | null)[]) => {
  const m = new Map<number, number>();
  for (const x of list) if (x != null) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0];
};

/** Tell one section: eligible beats (conditions, chance), one per slot (seeded by weight), in order, at most `max`. */
function tell(section: string, max: number, env: Env, id: number, stable: boolean, season: number): string[] {
  const seedBase = stable ? `life:${id}` : `life:${id}:${season}`;
  const groups = new Map<string, LifeNode[]>();
  for (const n of LIFE_NODES) {
    if (n.section !== section) continue;
    if (!evalCond(n.requires, env) || (n.unless && evalCond(n.unless, env))) continue;
    if (!chanceOk(`${seedBase}:chance:${n.id}`, n.chance)) continue;
    const key = n.slot ?? `#${n.id}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  const chosen = [...groups.entries()].map(([key, list]) =>
    list.length === 1 ? list[0] : pickWeighted(list.map((n) => ({ n, weight: n.weight ?? 1 })), `${seedBase}:slot:${key}`).n);
  chosen.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1) || (a.order ?? 0) - (b.order ?? 0));
  const kept = chosen.slice(0, max).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return kept.map((n) => {
    const v = pickVariant(n, env, `${seedBase}:variant:${n.id}`);
    return expand(v.text, { env, grammar: LIFE_GRAMMAR, seed: `${seedBase}:${n.id}` });
  }).filter(Boolean);
}

export async function lifeOf(id: number, name: string) {
  const season = Number(await getState("season", "0"));
  const chog = await one<any>(`SELECT traits FROM chogs WHERE id = ?`, [id]);
  const traits = chog ? JSON.parse(chog.traits || "{}") : {};
  const ag = await one<any>(
    `SELECT a.*, cs.job, cs.track FROM agents a JOIN chog_season cs ON cs.chog_id = a.chog_id AND cs.season = a.season WHERE a.chog_id = ?`, [id]);
  const rows = (await all<any>(
    `SELECT season, tick, kind, other, ref, text FROM chog_history WHERE chog_id = ? ORDER BY id DESC LIMIT 1500`, [id],
  )).map((r) => ({ season: Number(r.season), tick: Number(r.tick), kind: String(r.kind), other: r.other == null ? null : Number(r.other), ref: r.ref, text: String(r.text) })) as Row[];
  const now = rows.filter((r) => r.season === season);
  const job = ag ? JOB_BY_ID[String(ag.job)] : undefined;
  const track = String(ag?.track ?? job?.track ?? "civic");
  const homeName = ag ? placeName(String(ag.home)) : "Monadia";
  const profile = buildProfile(id, name, traits, homeName, job?.name ?? "Chog");

  // Names of the Chogs this one is tied to.
  const names = new Map<number, string>();
  const nameOf = async (x?: number | null) => {
    if (x == null) return "";
    if (!names.has(x)) names.set(x, String((await one<any>(`SELECT name FROM chogs WHERE id = ?`, [x]))?.name ?? ""));
    return names.get(x)!;
  };
  const comp = top(now.filter((r) => r.kind === "party").map((r) => r.other));
  const friend = top(now.filter((r) => ["train", "trade", "heal", "gossip"].includes(r.kind)).map((r) => r.other));
  const rival = (await all<any>(`SELECT a, b FROM threads WHERE season = ? AND kind = 'rivals' AND stage >= 1 AND (a = ? OR b = ?) ORDER BY count DESC LIMIT 1`, [season, id, id]))[0];
  const nem = (await all<any>(`SELECT data FROM threads WHERE season = ? AND kind = 'nemesis' AND a = ? AND stage >= 1 LIMIT 1`, [season, id]))[0];
  let nemesis = "";
  if (nem) {
    try {
      const st = JSON.parse((await getState("sim_state", "")) || "{}");
      const region = JSON.parse(nem.data || "{}").region;
      nemesis = await nameOf(st.generals?.find((g: any) => g.region === region)?.chog);
    } catch { /* no sim state yet */ }
  }
  const spon = (await all<any>(`SELECT author FROM gifts WHERE chog_id = ? AND status = 'done' ORDER BY id LIMIT 1`, [id]))[0];
  const higher = ag ? Number((await one<any>(`SELECT COUNT(*) n FROM agents WHERE season = ? AND story > ?`, [season, Number(ag.story)]))?.n ?? 0) : 999;
  const skills: string[] = ag ? JSON.parse(ag.skills || "[]") : [];
  const titleRow = now.find((r) => r.kind === "title");

  // Past seasons: one row of facts each.
  const pastSeasons = [...new Set(rows.filter((r) => r.season !== season).map((r) => r.season))].sort((a, b) => b - a);
  const past = pastSeasons.map((n) => {
    const list = rows.filter((r) => r.season === n);
    const jid = list.find((r) => r.kind === "summoned")?.ref ?? "";
    const j = JOB_BY_ID[jid];
    return {
      season: n, p_season: n, p_job: j?.name ?? "Chog", p_jobA: article(j?.name ?? "Chog"), p_level: Math.max(1, ...list.filter((r) => r.kind === "level").map((r) => Number(r.ref) || 1)),
      p_quests: count(list, "quest_done"), p_fails: count(list, "quest_fail"), p_slays: count(list, "slay_general"),
      p_hero: count(list, "hero") > 0, p_demon: j?.track === "demon",
    };
  });

  const q = count(now, "quest_done");
  const env: Env = {
    a: shortName(name), name, jobid: job?.id ?? "", job: job?.name ?? "Chog", jobA: article(job?.name ?? "Chog"), track, home: homeName, level: Number(ag?.level ?? 1),
    gold: Number(ag?.gold ?? 0), kills: Number(ag?.kills ?? 0), skillsN: skills.length,
    skillList: skills.map((s) => SKILL_BY_ID.get(s)?.name ?? s).join(", "),
    titleName: titleRow?.ref ?? "", demon: track === "demon", tier: traits.Tier ?? "Common",
    skull: /skull/i.test(String(traits.Form ?? "")) || /skull/i.test(String(traits.Base ?? "")), radio: /radioactive/i.test(String(traits.Base ?? "")),
    temper: profile.temperament, quirk: profile.quirk, dream: profile.dream, fear: profile.fear, motto: profile.motto, food: profile.food,
    hobby: profile.hobby, secret: profile.secret, talent: profile.talent,
    quests: q, fails: count(now, "quest_fail"), held: count(now, "raid_held"), hurt: count(now, "raid_hurt"), raidsMade: count(now, "raid_won", "raid_lost"),
    parties: count(now, "party"), gifts: count(now, "gift_skill", "gift_quest"), trains: count(now, "train"), trades: count(now, "trade"),
    gossips: count(now, "gossip"), heals: count(now, "heal"), slays: count(now, "slay_general"),
    is_hero: count(now, "hero") > 0, is_fallen: count(now, "fell") > 0, ranked: higher < 5 && track !== "demon" && Number(ag?.story ?? 0) >= 8,
    companion: comp ? shortName(await nameOf(comp[0])) : "", companionN: comp?.[1] ?? 0, friend: friend ? shortName(await nameOf(friend[0])) : "",
    rival: rival ? shortName(await nameOf(Number(rival.a) === id ? Number(rival.b) : Number(rival.a))) : "", nemesis: shortName(nemesis),
    sponsor: spon ? label(spon.author) : "",
    seasonsPast: pastSeasons.length, heroSeasons: past.filter((p) => p.p_hero).length, pastSlays: past.reduce((s, p) => s + p.p_slays, 0),
    pastJobs: past.filter((p) => p.p_job !== "Chog").slice(0, 5).map((p) => p.p_job.toLowerCase()).join(", "),
  };

  const sections = SECTIONS.map((s) => ({ id: s.id, title: s.title, paragraphs: tell(s.id, s.max, env, id, !!s.stable, season) })).filter((s) => s.paragraphs.length);
  const pastLives = past.slice(0, 8).map((p) => {
    const e: Env = { ...env, ...p };
    const list = LIFE_NODES.filter((n) => n.section === "past" && evalCond(n.requires, e));
    const node = pickWeighted(list.map((n) => ({ n, weight: n.weight ?? 1 })), `life:${id}:past:${p.season}`).n;
    const v = pickVariant(node, e, `life:${id}:pastv:${p.season}`);
    return { season: p.season, text: expand(v.text, { env: e, grammar: LIFE_GRAMMAR, seed: `life:${id}:${p.season}:past` }) };
  });

  // Epithets earned the hard way (shown beside the title).
  const e = env as Record<string, number | boolean | string>;
  const epithets = [
    e.is_hero && `Hero of Season ${season}`, Number(e.slays) >= 1 && "Sealbreaker", Number(e.heroSeasons) >= 1 && "Once a Hero",
    q >= 31 ? "the Tireless" : q >= 13 ? "the Steady" : "", Number(e.fails) >= 3 && q >= 3 && "the Stubborn", Number(e.parties) >= 5 && "the Companion",
    Number(e.held) >= 3 && "Wall-Holder", Number(e.gifts) >= 2 && "Star-Touched", Number(e.level) >= 8 && "the Seasoned",
    Number(e.gold) >= 300 && "the Prosperous", Number(e.seasonsPast) >= 4 && "the Old Soul", e.nemesis && "Grudge-Bearer", e.ranked && "One to Watch",
  ].filter((x): x is string => typeof x === "string" && !!x).slice(0, 4);

  const bonds = [
    comp && { kind: "companion", id: comp[0], name: env.companion, n: comp[1] },
    friend && { kind: "friend", id: friend[0], name: env.friend, n: friend[1] },
    rival && { kind: "rival", id: Number(rival.a) === id ? Number(rival.b) : Number(rival.a), name: env.rival },
  ].filter(Boolean);

  return {
    profile: { temperament: profile.temperament, temperamentLine: profile.temperamentLine, quirk: profile.quirk, dream: profile.dream, fear: profile.fear,
      motto: profile.motto, food: profile.food, hobby: profile.hobby, secret: profile.secret, talent: profile.talent, look: profile.look, traits: profile.traits },
    epithets, sections, pastLives, bonds,
    bio: sections.filter((s) => ["origin", "summoning", "season"].includes(s.id)).flatMap((s) => s.paragraphs).join(" "),
    pastLinesLegacy: pastLives.map((p) => p.text),
    timeline: rows.slice(0, 120).map((r) => ({ season: r.season, tick: r.tick, kind: r.kind, text: r.text })),
    counts: { quests: q, failed: env.fails, parties: env.parties, gifts: env.gifts, held: env.held, kills: env.kills, level: env.level, gold: env.gold, skills: skills.length, seasons: pastSeasons.length + 1 },
  };
}
