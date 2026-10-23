// The season novel, "The Monadia Cycle": a walk over the story graph (src/story, data/story/*.json).
// Each season picks a premise (arc); every tick, the beats whose trigger has been reached, whose edges are satisfied
// (after / afterAny / requires), whose slot is still free and whose chance roll passes are told: each gets one of its
// variants, expanded with the grammar and filled with that season's Chogs, places and events. Everything is seeded
// by season and node id, so a season always reads the same, and no two seasons read alike.
import { all, batch, one, run } from "../lib/db";
import { JOB_BY_ID } from "../sim2/season";
import { WORLD } from "../world/data";
import { hash } from "../sim/world";
import { chanceOk, evalCond, expand, pickVariant, pickWeighted, tidy, type Env, type StoryNode } from "../story/engine";
import { GRAPH, NODE_BY_ID } from "../story/chronicle";
import { QUEST_BY_ID, SKILL_BY_ID } from "./sim";
import type { SeasonState } from "./sim";

export const NOVEL = { title: "The Monadia Cycle", graph: GRAPH };

export const NOVEL_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS novel (
    season INTEGER NOT NULL, chapter TEXT NOT NULL, ord INTEGER NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL,
    tick INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (season, chapter)
  )`,
  `CREATE TABLE IF NOT EXISTS story (season INTEGER PRIMARY KEY, arc TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}')`,
];

export type NovelCtx = {
  season: number; tick: number; now: number; st: SeasonState; progress: number;
  seasonStart: boolean; seasonEnd: boolean;
  raid: { town: number; held: boolean; size: number; defender: number | null } | null;
  placeName: (place: string) => string;
};

type StoryData = { flags: string[]; used: Record<string, number> };

const REGION_NAME = new Map(WORLD.regions.map((r) => [r.id, r.name]));
const article = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);
const ORD = ["first", "second", "third", "fourth"];

// ---------------------------------------------------------------------------------------------------------
// Premise (arc) and persisted story state

export async function storyOf(season: number): Promise<{ arc: string; data: StoryData }> {
  for (const q of NOVEL_SCHEMA) await run(q);
  const row = await one<any>(`SELECT arc, data FROM story WHERE season = ?`, [season]);
  if (row) return { arc: String(row.arc), data: { flags: [], used: {}, ...JSON.parse(row.data || "{}") } };
  const prev = (await all<any>(`SELECT arc FROM story WHERE season < ? ORDER BY season DESC LIMIT 3`, [season])).map((r) => String(r.arc));
  const forced = process.env.STORY_ARC && GRAPH.arcs.some((a) => a.id === process.env.STORY_ARC) ? process.env.STORY_ARC : null;
  const pool = GRAPH.arcs.filter((a) => !prev.includes(a.id));
  const arc = forced ?? (season === 1 ? "lantern" : pickWeighted((pool.length ? pool : GRAPH.arcs).map((a) => ({ id: a.id, weight: a.weight })), `arc:${season}`).id);
  const data: StoryData = { flags: [], used: {} };
  await run(`INSERT OR IGNORE INTO story(season, arc, data) VALUES(?,?,?)`, [season, arc, JSON.stringify(data)]);
  return { arc, data };
}

/** Variant indexes used by the previous season, so the same beat does not read the same two seasons in a row. */
async function previousUsed(season: number): Promise<Record<string, number>> {
  const row = await one<any>(`SELECT data FROM story WHERE season = ?`, [season - 1]);
  try { return JSON.parse(row?.data || "{}").used ?? {}; } catch { return {}; }
}

// ---------------------------------------------------------------------------------------------------------
// Triggers

type Trig = (t: string) => Promise<boolean>;

function triggers(ctx: NovelCtx, fresh: boolean): Trig {
  const { st } = ctx;
  const cache = new Map<string, Promise<boolean>>();
  const any = (sql: string) => all<any>(sql, [ctx.season]).then((r) => r.length > 0).catch(() => false);
  const count = (sql: string) => all<any>(sql, [ctx.season]).then((r) => Number(r[0]?.n ?? 0)).catch(() => 0);
  const calc = async (t: string): Promise<boolean> => {
    if (t === "season_start") return ctx.seasonStart || ctx.progress < 0.3 || fresh;  // the opening is always told, even if the story starts late
    if (t === "season_end") return ctx.seasonEnd;
    if (t === "first_raid") return !!ctx.raid || Object.values(st.raids ?? {}).some((r) => r.held + r.lost > 0);
    if (t === "phase_2") return st.phase >= 2;
    if (t === "phase_3") return st.phase >= 3;
    if (t === "last_stand") return st.lastStand;
    if (t === "hero") return !!st.hero;
    if (t.startsWith("seals_")) return st.seals >= Number(t.slice(6));
    if (t.startsWith("progress_")) return ctx.progress >= Number(t.slice(9)) / 100;
    if (t.startsWith("king_hp_")) return st.phase >= 3 && (100 * st.king.hp) / st.king.max <= Number(t.slice(8));
    if (t.startsWith("quests_")) return (await count(`SELECT COUNT(*) n FROM chog_history WHERE season = ? AND kind = 'quest_done'`)) >= Number(t.slice(7));
    if (t.startsWith("level_")) return any(`SELECT 1 FROM agents a JOIN chog_season cs ON cs.chog_id = a.chog_id AND cs.season = a.season WHERE a.season = ? AND cs.track != 'demon' AND a.level >= ${Number(t.slice(6)) | 0} LIMIT 1`);
    if (t === "party_first") return any(`SELECT 1 FROM chog_history WHERE season = ? AND kind = 'party' LIMIT 1`);
    if (t === "ko_first") return any(`SELECT 1 FROM chog_history WHERE season = ? AND kind = 'quest_fail' LIMIT 1`);
    if (t === "gift_first") return (await count(`SELECT COUNT(*) n FROM chog_history WHERE season = ? AND kind IN ('gift_skill','gift_quest')`)) >= 1;
    if (t === "gift_5") return (await count(`SELECT COUNT(*) n FROM chog_history WHERE season = ? AND kind IN ('gift_skill','gift_quest')`)) >= 5;
    if (t === "rival_first") return any(`SELECT 1 FROM threads WHERE season = ? AND kind = 'rivals' AND stage >= 1 LIMIT 1`);
    if (t === "nemesis_first") return any(`SELECT 1 FROM threads WHERE season = ? AND kind = 'nemesis' AND stage >= 1 LIMIT 1`);
    if (t === "siege_first") return any(`SELECT 1 FROM threads WHERE season = ? AND kind = 'siege' AND stage >= 1 LIMIT 1`);
    if (t === "underdog_first") return ctx.progress >= 0.2 && any(`SELECT 1 FROM threads t JOIN chog_season cs ON cs.chog_id = t.a AND cs.season = t.season
      WHERE t.season = ? AND t.kind = 'underdog' AND t.stage >= 1 AND cs.track NOT IN ('adventurer', 'demon') LIMIT 1`);
    return false;
  };
  return (t) => { let p = cache.get(t); if (!p) cache.set(t, (p = calc(t))); return p; };
}

// ---------------------------------------------------------------------------------------------------------
// Writing chapters

/** Extra facts for one node: the seal beats get that seal's slayer and numbering. */
function extraFor(n: StoryNode, base: Env): Env {
  const m = n.trigger?.match(/^seals_(\d)$/);
  if (!m) return {};
  const k = Number(m[1]);
  return { ...((base.seal as Env[])?.[k - 1] ?? {}), sealNo: k, sealOrd: ORD[k - 1], sealOrdCap: ORD[k - 1][0].toUpperCase() + ORD[k - 1].slice(1), sealsLeft: 4 - k };
}

/** Where a beat sits in a season's timeline (0..100), so beats told in the same tick still read in story order. */
function beatRank(n: StoryNode): number {
  const t = n.trigger ?? "";
  const num = Number(t.replace(/\D+/g, "")) || 0;
  if (t === "season_start") return 0;
  if (t.startsWith("progress_")) return num;
  if (t.startsWith("quests_")) return { 25: 4, 100: 12, 300: 35, 600: 60 }[num] ?? num / 10;
  if (t.startsWith("seals_")) return 20 * num + 5;
  if (t.startsWith("level_")) return 6 + num;
  if (t.startsWith("king_hp_")) return 100 - num / 2;
  return ({ party_first: 3, ko_first: 5, first_raid: 8, gift_first: 9, phase_2: 10, gift_5: 15, rival_first: 20, nemesis_first: 25, underdog_first: 28,
    siege_first: 30, phase_3: 85, last_stand: 95, hero: 98, season_end: 100 } as Record<string, number>)[t] ?? 50;
}
const depthOf = (n: StoryNode, memo = new Map<string, number>()): number => {
  if (memo.has(n.id)) return memo.get(n.id)!;
  const parents = [...(n.after ?? []), ...(n.afterAny ?? [])].map((id) => NODE_BY_ID.get(id)?.node).filter((x): x is StoryNode => !!x);
  const d = parents.length ? 1 + Math.max(...parents.map((q) => depthOf(q, memo))) : 0;
  memo.set(n.id, d);
  return d;
};

/** Writes every beat whose moment has come this tick; returns their titles (for the Star Stream). */
export async function writeChapters(ctx: NovelCtx): Promise<string[]> {
  const { arc, data } = await storyOf(ctx.season);
  const rows = await all<any>(`SELECT chapter FROM novel WHERE season = ?`, [ctx.season]);
  const seen = new Set(rows.map((r) => String(r.chapter)).filter((id) => NODE_BY_ID.has(id)));
  const flags = new Set(data.flags);
  const slotTaken = new Set<string>();
  for (const id of seen) { const s = NODE_BY_ID.get(id)!.node.slot; if (s) slotTaken.add(s); }
  const trig = triggers(ctx, seen.size === 0);
  const armOk = (n: StoryNode) => !n.arc || (Array.isArray(n.arc) ? n.arc.includes(arc) : n.arc === arc);

  /** Beats that are possible right now by trigger, edges, slot and chance (no facts needed yet). */
  const cheap = async () => {
    const out: StoryNode[] = [];
    for (const n of GRAPH.nodes) {
      if (seen.has(n.id) || !armOk(n) || (n.slot && slotTaken.has(n.slot))) continue;
      if (n.after?.some((a) => !seen.has(a))) continue;
      if (n.afterAny && !n.afterAny.some((a) => seen.has(a))) continue;
      if (n.trigger && !(await trig(n.trigger))) continue;
      if (!chanceOk(`chance:${ctx.season}:${n.id}`, n.chance)) continue;
      out.push(n);
    }
    return out;
  };

  let ready = await cheap();
  if (!ready.length) return [];
  const base = await facts(ctx, arc);
  const prevUsed = await previousUsed(ctx.season);
  const env = (extra: Env = {}): Env => {
    const e: Env = { ...base, ...extra };
    for (const f of flags) e[f] = true;
    for (const s of seen) e[`seen_${s.replace(/\W/g, "_")}`] = true;
    return e;
  };
  const written: { node: StoryNode; title: string; text: string }[] = [];

  // A beat told in one pass can unlock its successors (after) in the next.
  for (let pass = 0; pass < 8 && ready.length; pass++) {
    const groups = new Map<string, StoryNode[]>();
    for (const n of ready) {
      const e = env(extraFor(n, base));
      if (n.trigger?.startsWith("seals_") && !e.slayer) continue;  // the seal's story needs its slayer
      if (!evalCond(n.requires, e) || (n.unless && evalCond(n.unless, e))) continue;
      const key = n.slot ?? `#${n.id}`;
      groups.set(key, [...(groups.get(key) ?? []), n]);
    }
    let told = 0;
    for (const [key, list] of groups) {
      if (key[0] !== "#" && slotTaken.has(key)) continue;
      const node = list.length === 1 ? list[0] : pickWeighted(list.map((n) => ({ n, weight: n.weight ?? 1 })), `slot:${ctx.season}:${key}`).n;
      const e = env(extraFor(node, base));
      const seed = `${ctx.season}:${node.id}`;
      const v = pickVariant(node, e, `variant:${seed}`, prevUsed[node.id] ?? -1);
      const cx = { env: e, grammar: GRAPH.grammar, seed };
      written.push({ node, title: tidy(expand(node.title ?? node.id, cx)), text: expand(v.text, cx) });
      data.used[node.id] = v.index;
      seen.add(node.id);
      if (node.slot) slotTaken.add(node.slot);
      for (const f of node.sets ?? []) flags.add(f);
      told++;
    }
    if (!told) break;
    ready = await cheap();
  }
  if (!written.length) return [];

  data.flags = [...flags];
  written.sort((a, b) => beatRank(a.node) - beatRank(b.node) || depthOf(a.node) - depthOf(b.node) || NODE_BY_ID.get(a.node.id)!.index - NODE_BY_ID.get(b.node.id)!.index);
  await batch([
    ...written.map(({ node, title, text }, i) => ({
      sql: `INSERT OR IGNORE INTO novel(season, chapter, ord, title, text, tick, at) VALUES(?,?,?,?,?,?,?)`,
      args: [ctx.season, node.id, i, title, text, ctx.tick, ctx.now],  // ord = place in this tick's batch (story order)
    })),
    { sql: `UPDATE story SET data = ? WHERE season = ?`, args: [JSON.stringify(data), ctx.season] },
  ]);
  return written.map((w) => w.title);
}

// ---------------------------------------------------------------------------------------------------------
// Facts: the placeholders ({w1}, {j_baker}, {townA}...) and values the text can use

const label = (author: unknown) => {
  const s = String(author);
  return s.startsWith("judge") ? "a judge" : s.startsWith("0x") ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
};

export async function facts(ctx: NovelCtx, arc: string): Promise<Env> {
  const { season, st } = ctx;
  const agents = await all<any>(
    `SELECT a.chog_id id, c.name, cs.job, cs.track, a.home, a.level, a.story, a.gold FROM agents a JOIN chogs c ON c.id = a.chog_id
     JOIN chog_season cs ON cs.chog_id = a.chog_id AND cs.season = a.season WHERE a.season = ?`, [season]);
  const by = new Map(agents.map((a) => [Number(a.id), a]));
  const nm = (id: number | null | undefined) => (id != null && by.get(Number(id))?.name) || "";
  const jobName = (id: number) => JOB_BY_ID[by.get(id)?.job]?.name ?? "Chog";
  const home = (id: number) => (by.get(id) ? ctx.placeName(String(by.get(id).home)) : "Monadia");
  const heroes = agents.filter((a) => a.track !== "demon");
  const v: Env = { season, arc, king: nm(st.king.chog), seals: st.seals, kingHp: Math.round((100 * st.king.hp) / st.king.max), progress: Math.round(ctx.progress * 100), chogs: agents.length };
  st.generals.forEach((g, i) => { v[`g${i + 1}`] = nm(g.chog); v[`r${i + 1}`] = REGION_NAME.get(g.region) ?? g.region; });

  // Witnesses: three Chogs picked by a seeded hash, so every season shows different ones. w1 is the viewpoint.
  const w = [...heroes].sort((a, b) => hash(`w:${season}:${a.id}`) - hash(`w:${season}:${b.id}`)).slice(0, 3);
  w.forEach((a, i) => { v[`w${i + 1}`] = a.name; v[`w${i + 1}job`] = jobName(Number(a.id)); v[`w${i + 1}home`] = home(Number(a.id)); });

  // One Chog per job, seeded: {j_baker}, {j_blacksmith}, {j_imp}, {j_dark_knight}, ... (who does that work this season).
  const byJob = new Map<string, any[]>();
  for (const a of agents) byJob.set(a.job, [...(byJob.get(a.job) ?? []), a]);
  for (const jid of Object.keys(JOB_BY_ID)) {
    const list = byJob.get(jid) ?? heroes;
    v[`j_${jid}`] = [...list].sort((a, b) => hash(`j:${season}:${jid}:${a.id}`) - hash(`j:${season}:${jid}:${b.id}`))[0]?.name ?? "someone";
  }

  // Places: three towns and two dungeons, seeded.
  const pois = WORLD.pois.map((p, i) => ({ ...p, i }));
  const pick = (kinds: string[], tag: string, n: number) => pois.filter((p) => kinds.includes(p.kind))
    .sort((a, b) => hash(`${tag}:${season}:${a.i}`) - hash(`${tag}:${season}:${b.i}`)).slice(0, n).map((p) => p.name);
  const towns = pick(["town", "village", "capital"], "town", 3);
  ["A", "B", "C"].forEach((k, i) => (v[`town${k}`] = towns[i]));
  const dungeons = pick(["dungeon"], "dng", 2);
  ["A", "B"].forEach((k, i) => (v[`dungeon${k}`] = dungeons[i]));

  const first = (await all<any>(`SELECT chog_id, ref, text FROM chog_history WHERE season = ? AND kind = 'quest_done' ORDER BY id LIMIT 1`, [season]))[0];
  if (first) {
    v.firstQuester = nm(first.chog_id);
    v.firstQuesterJob = jobName(Number(first.chog_id));
    v.firstQuest = String(first.text).match(/"([^"]+)"/)?.[1] ?? "a quest";
    v.firstQuestPlace = String(first.text).match(/ at (.+)\.$/)?.[1] ?? home(Number(first.chog_id));
  }
  v.questsDone = Number((await all<any>(`SELECT COUNT(*) n FROM chog_history WHERE season = ? AND kind = 'quest_done'`, [season]))[0]?.n ?? 0);
  const raids = st.raids ?? {};
  v.raidsHeld = Object.values(raids).reduce((s, r) => s + r.held, 0);
  v.raidsLost = Object.values(raids).reduce((s, r) => s + r.lost, 0);
  const worst = Object.entries(raids).sort((a, b) => b[1].held + b[1].lost - (a[1].held + a[1].lost))[0];
  if (worst && worst[1].held + worst[1].lost >= 2) { v.mostRaided = WORLD.pois[Number(worst[0])]?.name; v.mostRaidedCount = worst[1].held + worst[1].lost; }
  // The first raid: held or lost (this tick's raid if there is one, else the season's record so far).
  const held = ctx.raid ? ctx.raid.held : Number(v.raidsHeld) >= Number(v.raidsLost);
  v.raid_held = held;
  const raidTownId = ctx.raid?.town ?? (worst ? Number(worst[0]) : Number(Object.keys(raids)[0]));
  v.raidTown = WORLD.pois[raidTownId]?.name ?? v.townA ?? "a town";
  v.raidSize = ctx.raid?.size ?? 8;
  v.raidDefender = nm(ctx.raid?.defender) || "";
  v.raidOutcome = held
    ? `${v.raidDefender || "A farmer with a pitchfork"} was the first onto the wall, and the others followed. By midnight the demons broke and fled back into the dark, leaving pitchforks and pride behind.`
    : `The defenders were too few and too new. ${v.raidTown} burned until morning, and the demons went home laughing, their sacks full.`;

  const ko = (await all<any>(`SELECT chog_id, ref FROM chog_history WHERE season = ? AND kind = 'quest_fail' ORDER BY id LIMIT 1`, [season]))[0];
  if (ko) { v.firstFallen = nm(ko.chog_id); v.firstFallenQuest = QUEST_BY_ID.get(String(ko.ref))?.name ?? "a quest"; }
  const party = (await all<any>(`SELECT chog_id, other, ref FROM chog_history WHERE season = ? AND kind = 'party' ORDER BY id LIMIT 1`, [season]))[0];
  if (party) { v.partyA = nm(party.chog_id); v.partyB = nm(party.other); v.partyQuest = QUEST_BY_ID.get(String(party.ref))?.name ?? "a quest"; }
  const lv = heroes.filter((a) => Number(a.level) >= 5).sort((a, b) => Number(b.level) - Number(a.level) || Number(a.id) - Number(b.id))[0];
  if (lv) { v.levelFive = lv.name; v.levelFiveJob = jobName(Number(lv.id)); }
  const nem = (await all<any>(`SELECT a, data FROM threads WHERE season = ? AND kind = 'nemesis' AND stage >= 1 ORDER BY id LIMIT 1`, [season]))[0];
  if (nem) {
    v.nemesisA = nm(nem.a);
    const g = st.generals.find((x) => x.region === JSON.parse(nem.data || "{}").region);
    v.nemesisBoss = nm(g?.chog) || "a Demon General";
  }
  const under = (await all<any>(`SELECT t.a FROM threads t JOIN chog_season cs ON cs.chog_id = t.a AND cs.season = t.season
    WHERE t.season = ? AND t.kind = 'underdog' AND t.stage >= 1 AND cs.track NOT IN ('adventurer', 'demon') ORDER BY t.id LIMIT 1`, [season]))[0];
  if (under) { v.underdog = nm(under.a); v.underdogJob = jobName(Number(under.a)); }
  // The one who takes the cultist's bait (and comes back): seeded, never a witness.
  const wit = new Set(w.map((a) => Number(a.id)));
  const tr = [...heroes].filter((a) => !wit.has(Number(a.id))).sort((a, b) => hash(`t:${season}:${a.id}`) - hash(`t:${season}:${b.id}`))[0];
  if (tr) { v.traitor = tr.name; v.traitorJobA = article(jobName(Number(tr.id))); }

  const cands = [...heroes].sort((a, b) => Number(b.story) - Number(a.story) || Number(b.level) - Number(a.level)).slice(0, 3);
  cands.forEach((a, i) => { v[`cand${i + 1}`] = a.name; v[`cand${i + 1}job`] = jobName(Number(a.id)); });
  const rival = (await all<any>(`SELECT a, b, count FROM threads WHERE season = ? AND kind = 'rivals' AND stage >= 1 ORDER BY count DESC LIMIT 1`, [season]))[0];
  if (rival) { v.rivalA = nm(rival.a); v.rivalB = nm(rival.b); v.rivalCount = Number(rival.count); }
  const siege = (await all<any>(`SELECT key FROM threads WHERE season = ? AND kind = 'siege' AND stage >= 1 ORDER BY count DESC LIMIT 1`, [season]))[0];
  if (siege) v.siegeTown = WORLD.pois[Number(siege.key)]?.name;

  // The first gift a Constellation (a player) gave.
  const g1 = (await all<any>(`SELECT chog_id, kind, ref, author FROM gifts WHERE status = 'done' ORDER BY id LIMIT 1`))[0];
  if (g1) {
    v.giftChog = nm(g1.chog_id) || `Chog #${g1.chog_id}`;
    v.giftName = `the ${g1.kind} “${(g1.kind === "skill" ? SKILL_BY_ID.get(g1.ref)?.name : QUEST_BY_ID.get(g1.ref)?.name) ?? g1.ref}”`;
    v.giftSponsor = label(g1.author);
  }

  // One entry per broken seal, in order: who slew whom, and the threads that make it personal.
  const slays = await all<any>(`SELECT chog_id, other, ref FROM chog_history WHERE season = ? AND kind = 'slay_general' ORDER BY id`, [season]);
  const seal: Env[] = [];
  for (const s of slays) {
    const id = Number(s.chog_id);
    const e: Env = {
      slayer: nm(id), slain: nm(s.other), slainRegion: REGION_NAME.get(String(s.ref)) ?? s.ref, slayerJob: jobName(id),
      slayerJobA: article(jobName(id)), slayerLevel: by.get(id)?.level ?? 1,
    };
    if ((await all<any>(`SELECT 1 FROM threads WHERE season = ? AND kind = 'nemesis' AND key = ? AND stage >= 1`, [season, `${id}-${s.ref}`])).length) e.slayerNemesis = "yes";
    const r = (await all<any>(`SELECT a, b FROM threads WHERE season = ? AND kind = 'rivals' AND stage >= 1 AND (a = ? OR b = ?) ORDER BY count DESC LIMIT 1`, [season, id, id]))[0];
    if (r) e.slayerRival = nm(Number(r.a) === id ? r.b : r.a);
    const sp = (await all<any>(`SELECT author FROM gifts WHERE chog_id = ? AND status = 'done' ORDER BY id LIMIT 1`, [id]))[0];
    if (sp) e.slayerSponsor = label(sp.author);
    seal.push(e);
  }
  v.seal = seal;
  v.slayers = slays.map((s) => nm(s.chog_id)).filter(Boolean).join(", ") || "no one";

  if (st.hero) {
    const id = st.hero;
    v.hero = nm(id) || st.heroName;
    v.heroJob = jobName(id);
    v.heroJobA = article(jobName(id));
    v.heroHome = home(id);
    v.heroLevel = by.get(id)?.level ?? 1;
    v.hero_track = by.get(id)?.track ?? "adventurer";
    const mate = (await all<any>(`SELECT other, COUNT(*) n FROM chog_history WHERE season = ? AND chog_id = ? AND kind = 'party' AND other IS NOT NULL GROUP BY other ORDER BY n DESC LIMIT 1`, [season, id]))[0];
    if (mate) v.heroCompanion = nm(mate.other);
    const r = (await all<any>(`SELECT a, b FROM threads WHERE season = ? AND kind = 'rivals' AND stage >= 1 AND (a = ? OR b = ?) ORDER BY count DESC LIMIT 1`, [season, id, id]))[0];
    if (r) v.heroRival = nm(Number(r.a) === id ? r.b : r.a);
    const sp = (await all<any>(`SELECT author FROM gifts WHERE chog_id = ? AND status = 'done' ORDER BY id LIMIT 1`, [id]))[0];
    if (sp) v.heroSponsor = label(sp.author);
  }
  return v;
}
