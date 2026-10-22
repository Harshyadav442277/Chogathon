// The season novel (docs/STORY_PLAN.md §4): fixed chapters of prose in data/novel.json, each triggered by a
// milestone and filled with that season's Chogs and events. {pointer} is replaced by a value; [[pointer|text]]
// is kept only when the pointer has a value. Deterministic; no model.
import { all, batch, run } from "../lib/db";
import { JOB_BY_ID } from "../sim2/season";
import { WORLD } from "../world/data";
import { hash } from "../sim/world";
import novelJson from "../../data/novel.json";
import type { SeasonState } from "./sim";

type Chapter = { id: string; trigger: string; title: string; text: string };
export const NOVEL = novelJson as { title: string; chapters: Chapter[] };

export const NOVEL_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS novel (
    season INTEGER NOT NULL, chapter TEXT NOT NULL, ord INTEGER NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL,
    tick INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (season, chapter)
  )`,
];

export type NovelCtx = {
  season: number; tick: number; now: number; st: SeasonState; progress: number;
  seasonStart: boolean; seasonEnd: boolean;
  raid: { town: number; held: boolean; size: number; defender: number | null } | null;
  placeName: (place: string) => string;
};

const REGION_NAME = new Map(WORLD.regions.map((r) => [r.id, r.name]));
const article = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);

function triggered(c: Chapter, ctx: NovelCtx, questsDone: () => Promise<number>): Promise<boolean> | boolean {
  const { st } = ctx;
  const t = c.trigger;
  if (t === "season_start") return ctx.seasonStart;
  if (t === "season_end") return ctx.seasonEnd;
  if (t === "first_raid") return !!ctx.raid;
  if (t === "phase_2") return st.phase >= 2;
  if (t === "phase_3") return st.phase >= 3;
  if (t === "last_stand") return st.lastStand;
  if (t === "hero") return !!st.hero;
  if (t.startsWith("seals_")) return st.seals >= Number(t.slice(6));
  if (t.startsWith("progress_")) return ctx.progress >= Number(t.slice(9)) / 100;
  if (t.startsWith("quests_")) return questsDone().then((n) => n >= Number(t.slice(7)));
  return false;
}

/** Writes every chapter whose milestone has been reached this tick; returns their titles (for the Star Stream). */
export async function writeChapters(ctx: NovelCtx): Promise<string[]> {
  for (const q of NOVEL_SCHEMA) await run(q);
  const written = new Set((await all<any>(`SELECT chapter FROM novel WHERE season = ?`, [ctx.season])).map((r) => String(r.chapter)));
  let quests: number | null = null;
  const questsDone = async () => (quests ??= Number((await all<any>(`SELECT COUNT(*) n FROM chog_history WHERE season = ? AND kind = 'quest_done'`, [ctx.season]))[0]?.n ?? 0));
  const due: [Chapter, number][] = [];
  for (const [i, c] of NOVEL.chapters.entries()) {
    if (written.has(c.id)) continue;
    if (await triggered(c, ctx, questsDone)) due.push([c, i]);
  }
  if (!due.length) return [];
  const p = await pointers(ctx);
  await batch(due.map(([c, i]) => ({
    sql: `INSERT OR IGNORE INTO novel(season, chapter, ord, title, text, tick, at) VALUES(?,?,?,?,?,?,?)`,
    args: [ctx.season, c.id, i, c.title, render(c.text, { ...p, ...(c.trigger.startsWith("seals_") ? p.seal[Number(c.trigger.slice(6)) - 1] ?? {} : {}) }), ctx.tick, ctx.now],
  })));
  return due.map(([c]) => c.title);
}

export function render(text: string, v: Record<string, unknown>): string {
  const val = (k: string) => (v[k] == null ? "" : String(v[k]));
  return text
    .replace(/\[\[(\w+)\|([^\]]*)\]\]/g, (_, k, inner) => (val(k) ? inner : ""))
    .replace(/\{(\w+)\}/g, (_, k) => val(k) || "someone")
    .replace(/s's/g, "s'")  // "Emberforge Peaks's" -> "Emberforge Peaks'"
    .replace(/ {2,}/g, " ")
    .replace(/\n\n\n+/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------------------------------------
async function pointers(ctx: NovelCtx): Promise<Record<string, any>> {
  const { season, st } = ctx;
  const agents = await all<any>(
    `SELECT a.chog_id id, c.name, cs.job, cs.track, a.home, a.level, a.story FROM agents a JOIN chogs c ON c.id = a.chog_id
     JOIN chog_season cs ON cs.chog_id = a.chog_id AND cs.season = a.season WHERE a.season = ?`, [season]);
  const by = new Map(agents.map((a) => [Number(a.id), a]));
  const nm = (id: number | null | undefined) => (id != null && by.get(Number(id))?.name) || "";
  const jobName = (id: number) => JOB_BY_ID[by.get(id)?.job]?.name ?? "Chog";
  const home = (id: number) => (by.get(id) ? ctx.placeName(String(by.get(id).home)) : "Monadia");
  const heroes = agents.filter((a) => a.track !== "demon");
  const v: Record<string, any> = { season, king: nm(st.king.chog), seals: st.seals, kingHp: Math.round((100 * st.king.hp) / st.king.max) };
  st.generals.forEach((g, i) => { v[`g${i + 1}`] = nm(g.chog); v[`r${i + 1}`] = REGION_NAME.get(g.region) ?? g.region; });

  // Three witnesses of the summoning: picked by a seeded hash, so every season shows different Chogs.
  const w = [...heroes].sort((a, b) => hash(`w:${season}:${a.id}`) - hash(`w:${season}:${b.id}`)).slice(0, 3);
  w.forEach((a, i) => { v[`w${i + 1}`] = a.name; v[`w${i + 1}job`] = jobName(Number(a.id)); v[`w${i + 1}home`] = home(Number(a.id)); });

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
  if (ctx.raid) {
    v.raidTown = WORLD.pois[ctx.raid.town]?.name ?? "a town";
    v.raidSize = ctx.raid.size;
    v.raidOutcome = ctx.raid.held
      ? `${nm(ctx.raid.defender) || "A farmer with a pitchfork"} was the first onto the wall, and the others followed. By midnight the demons broke and fled back into the dark, leaving pitchforks and pride behind.`
      : `The defenders were too few and too new. ${v.raidTown} burned until morning, and the demons went home laughing, their sacks full.`;
  }
  const cands = [...heroes].sort((a, b) => Number(b.story) - Number(a.story) || Number(b.level) - Number(a.level)).slice(0, 3);
  cands.forEach((a, i) => { v[`cand${i + 1}`] = a.name; v[`cand${i + 1}job`] = jobName(Number(a.id)); });
  const rival = (await all<any>(`SELECT a, b, count FROM threads WHERE season = ? AND kind = 'rivals' AND stage >= 1 ORDER BY count DESC LIMIT 1`, [season]))[0];
  if (rival) { v.rivalA = nm(rival.a); v.rivalB = nm(rival.b); v.rivalCount = Number(rival.count); }
  const siege = (await all<any>(`SELECT key FROM threads WHERE season = ? AND kind = 'siege' AND stage >= 1 ORDER BY count DESC LIMIT 1`, [season]))[0];
  if (siege) v.siegeTown = WORLD.pois[Number(siege.key)]?.name;

  // One entry per broken seal, in order: who slew whom, and the threads that make it personal.
  const slays = await all<any>(`SELECT chog_id, other, ref FROM chog_history WHERE season = ? AND kind = 'slay_general' ORDER BY id`, [season]);
  v.seal = [];
  for (const s of slays) {
    const id = Number(s.chog_id);
    const e: Record<string, any> = {
      slayer: nm(id), slain: nm(s.other), slainRegion: REGION_NAME.get(String(s.ref)) ?? s.ref, slayerJob: jobName(id),
      slayerJobA: article(jobName(id)), slayerLevel: by.get(id)?.level ?? 1,
    };
    const nem = await all<any>(`SELECT 1 FROM threads WHERE season = ? AND kind = 'nemesis' AND key = ? AND stage >= 1`, [season, `${id}-${s.ref}`]);
    if (nem.length) e.slayerNemesis = "yes";
    const r = (await all<any>(`SELECT a, b FROM threads WHERE season = ? AND kind = 'rivals' AND stage >= 1 AND (a = ? OR b = ?) ORDER BY count DESC LIMIT 1`, [season, id, id]))[0];
    if (r) e.slayerRival = nm(Number(r.a) === id ? r.b : r.a);
    const sp = (await all<any>(`SELECT author FROM gifts WHERE chog_id = ? AND status = 'done' ORDER BY id LIMIT 1`, [id]))[0];
    if (sp) e.slayerSponsor = label(sp.author);
    v.seal.push(e);
  }
  v.slayers = slays.map((s) => nm(s.chog_id)).filter(Boolean).join(", ") || "no one";

  if (st.hero) {
    const id = st.hero;
    v.hero = nm(id) || st.heroName;
    v.heroJob = jobName(id);
    v.heroJobA = article(jobName(id));
    v.heroHome = home(id);
    v.heroLevel = by.get(id)?.level ?? 1;
    const mate = (await all<any>(`SELECT other, COUNT(*) n FROM chog_history WHERE season = ? AND chog_id = ? AND kind = 'party' AND other IS NOT NULL GROUP BY other ORDER BY n DESC LIMIT 1`, [season, id]))[0];
    if (mate) v.heroCompanion = nm(mate.other);
    const r = (await all<any>(`SELECT a, b FROM threads WHERE season = ? AND kind = 'rivals' AND stage >= 1 AND (a = ? OR b = ?) ORDER BY count DESC LIMIT 1`, [season, id, id]))[0];
    if (r) v.heroRival = nm(Number(r.a) === id ? r.b : r.a);
    const sp = (await all<any>(`SELECT author FROM gifts WHERE chog_id = ? AND status = 'done' ORDER BY id LIMIT 1`, [id]))[0];
    if (sp) v.heroSponsor = label(sp.author);
  }
  return v;
}

const label = (author: unknown) => {
  const s = String(author);
  return s.startsWith("judge") ? "a judge" : s.startsWith("0x") ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
};
