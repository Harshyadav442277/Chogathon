// Season simulation prototype (docs/SIM_PLAN.md). Every Chog is an agent with a state; each tick they work,
// wander, quest, meet each other or fight. Demons raid towns and guard the dungeons; the director paces the
// four Demon Generals and the Demon King so the season converges on the King's defeat, and whoever lands
// the final blow (any job) becomes the Hero. Mechanics are deterministic per tick (seeded); text is templated.
import { all, batch, getState, run, setState } from "../lib/db";
import { JOB_BY_ID, startSeason, type Job } from "../sim2/season";
import { WORLD } from "../world/data";
import { mulberry32 } from "../world/terrain";
import { hash } from "../sim/world";
import { narrate } from "./narrate";
import { advanceThreads, emptySignals, ensureThreadSchema } from "./threads";
import { writeChapters, type NovelCtx } from "./novel";
import skillsJson from "../../data/skills.json";
import questsJson from "../../data/quests.json";

export type Skill = { id: string; name: string; school: string; tags: string[]; rank: string; tier: number; power: number; speed: number; desc: string };
export type Quest = {
  id: string; name: string; kind: string; tags: string[]; tier: number; site: string; effort: number; xp: number; gold: number;
  story: number; desc: string; boss?: string; region?: string;
};
export const SKILLS = (skillsJson as { skills: Skill[] }).skills;
export const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
export const QUESTS = (questsJson as { quests: Quest[] }).quests;
export const QUEST_BY_ID = new Map(QUESTS.map((q) => [q.id, q]));
export const MAX_SKILLS = 6;

export const SCHEMA_V3 = [
  `CREATE TABLE IF NOT EXISTS agents (
    chog_id INTEGER PRIMARY KEY, season INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'work', place TEXT NOT NULL DEFAULT '',
    home TEXT NOT NULL DEFAULT '', work TEXT NOT NULL DEFAULT '', quest TEXT, qprog REAL NOT NULL DEFAULT 0, qneed REAL NOT NULL DEFAULT 0,
    qgiver TEXT, skills TEXT NOT NULL DEFAULT '[]', hp INTEGER NOT NULL DEFAULT 100, maxhp INTEGER NOT NULL DEFAULT 100,
    level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, gold INTEGER NOT NULL DEFAULT 20, story INTEGER NOT NULL DEFAULT 0,
    kills INTEGER NOT NULL DEFAULT 0, until INTEGER NOT NULL DEFAULT 0, log TEXT NOT NULL DEFAULT '[]'
  )`,
  `CREATE TABLE IF NOT EXISTS chronicle (id INTEGER PRIMARY KEY AUTOINCREMENT, season INTEGER, tick INTEGER, at INTEGER, kind TEXT, chog INTEGER, text TEXT)`,
  `CREATE TABLE IF NOT EXISTS gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, author TEXT NOT NULL, kind TEXT NOT NULL, chog_id INTEGER NOT NULL,
    ref TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS gifts_author_day ON gifts(author, day)`,
  `CREATE INDEX IF NOT EXISTS gifts_status ON gifts(status)`,
  // A Chog's life, kept across seasons: one structured row per meaningful moment (docs/STORY_PLAN.md §2).
  `CREATE TABLE IF NOT EXISTS chog_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, chog_id INTEGER NOT NULL, season INTEGER NOT NULL, tick INTEGER NOT NULL,
    at INTEGER NOT NULL, kind TEXT NOT NULL, other INTEGER, ref TEXT, text TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS chog_history_chog ON chog_history(chog_id, id DESC)`,
  `CREATE INDEX IF NOT EXISTS chog_history_kind ON chog_history(season, kind)`,
  // Hall of Heroes: one row per finished season.
  `CREATE TABLE IF NOT EXISTS season_archive (
    season INTEGER PRIMARY KEY, hero INTEGER, hero_name TEXT, hero_job TEXT, started INTEGER, ended INTEGER,
    slayers TEXT NOT NULL DEFAULT '[]', top TEXT NOT NULL DEFAULT '[]', sponsors TEXT NOT NULL DEFAULT '[]'
  )`,
];
// Columns added after the first release of the agents table.
const MIGRATIONS = [`ALTER TABLE agents ADD COLUMN dmg INTEGER NOT NULL DEFAULT 0`];

let schemaReady = false;
/** Creates the simulation tables if needed (API routes call this before the first tick has run). */
export async function ensureSimSchema() {
  if (schemaReady) return;
  for (const q of SCHEMA_V3) await run(q);
  for (const m of MIGRATIONS) await run(m).catch(() => {});  // already applied
  await ensureThreadSchema();
  schemaReady = true;
}

// ---------------------------------------------------------------------------------------------------------
// Places: "b:<building id>" or "p:<poi index>".
const NATIONS = ["emberforge", "tidecry", "prism", "dreamveil"] as const;
const HOUSE_REGION: Record<string, string> = { laser: "emberforge", teardrop: "tidecry", glass: "prism", moonbeam: "dreamveil" };
const B = WORLD.buildings;
const P = WORLD.pois;
const buildingsOf = (type: string, region?: string) => B.filter((b) => b.type === type && (!region || b.region === region)).map((b) => b.id);
const TOWN_KINDS = new Set(["capital", "town", "village", "district"]);
const townsOf = (region: string) => P.map((p, i) => [p, i] as const).filter(([p]) => TOWN_KINDS.has(p.kind) && p.region === region).map(([, i]) => i);
const wildsOf = (region: string) => P.map((p, i) => [p, i] as const).filter(([p]) => p.kind === "wild" && p.region === region).map(([, i]) => i);
const ALL_TOWNS = P.map((p, i) => [p, i] as const).filter(([p]) => TOWN_KINDS.has(p.kind) && p.region !== "demon").map(([, i]) => i);
const ALL_WILDS = P.map((p, i) => [p, i] as const).filter(([p]) => p.kind === "wild").map(([, i]) => i);
const DUNGEONS = buildingsOf("dungeon");
const CASTLE = buildingsOf("demon_castle")[0] ?? DUNGEONS[0];
const pick = <T,>(list: T[], seed: number): T => list[Math.abs(seed) % list.length];
const regionOfHouse = (house: string) => HOUSE_REGION[house] ?? "capital";
const pickOr = (list: number[], fallback: number[], seed: number) => (list.length ? pick(list, seed) : pick(fallback, seed));
const generalDungeon = (region: string) => buildingsOf("dungeon", region)[0] ?? DUNGEONS[NATIONS.indexOf(region as never) % DUNGEONS.length];

export function placeName(place: string): string {
  const [k, v] = place.split(":");
  const n = Number(v);
  if (k === "b") {
    const b = B[n];
    return b ? (b.type === "demon_castle" ? "the Demon King's castle" : b.name || `${b.type.replace(/_/g, " ")} of ${b.city}`) : "somewhere";
  }
  return P[n]?.name ?? "somewhere";
}

// ---------------------------------------------------------------------------------------------------------
type Agent = {
  id: number; name: string; house: string; job: Job; stats: Record<string, number>;
  state: string; place: string; home: string; work: string; quest: string | null; qprog: number; qneed: number; qgiver: string | null;
  skills: string[]; hp: number; maxhp: number; level: number; xp: number; gold: number; story: number; kills: number; until: number;
  log: string[]; dmg: number;
};

type Boss = { chog: number; region: string; dungeon: number; hp: number; max: number; down: boolean };
export type SeasonState = {
  season: number; started: number; phase: number; generals: Boss[]; king: Boss; seals: number;
  hero: number | null; heroName: string | null; heroAt: number | null; lastStand: boolean;
  raid: { town: number; raiders: number[]; until: number } | null;
  raids?: Record<string, { held: number; lost: number }>;  // per town, for the novel's interludes
};

const SCHOOL_OF: Record<string, string> = {
  main_dps: "blade", sub_dps: "wild", tank: "bulwark", healer: "holy", support: "arcane", buffer: "holy",
  craft: "craft", land: "wild", service: "craft", civic: "bulwark",
};

export const seasonMs = () => Number(process.env.SEASON_HOURS || 168) * 3600_000;
/** Ticks in one season at the simulation's tick interval (SIM_TICK_SECONDS, default 45). */
const ticksPerSeason = () => seasonMs() / 1000 / Number(process.env.SIM_TICK_SECONDS || 45);
/** XP scales with season length so adventurers reach ~level 12-15 by the finale whether a season lasts
 *  two hours (demo) or seven days (judging week). */
const xpMul = () => Math.min(20, Math.max(0.05, 1000 / ticksPerSeason()));
const isDemon = (a: Agent) => a.job.track === "demon";

function power(a: Agent): number {
  const s = a.stats;
  let p = 10 + a.level * 6 + ((s.STR ?? 0) + (s.VIT ?? 0) + (s.AGI ?? 0) + (s.INT ?? 0)) / 2;
  for (const id of a.skills) p += SKILL_BY_ID.get(id)?.power ?? 0;
  return p;
}

function defense(a: Agent): number {
  let d = (a.stats.VIT ?? 0) * 0.03;
  for (const id of a.skills) {
    const k = SKILL_BY_ID.get(id);
    if (k && (k.tags.includes("defense") || k.tags.includes("heal"))) d += k.tier * 0.12;
  }
  return d;
}

/** Quest speed bonus from skills whose tags match the quest (the key "skills decide quest length" rule). */
export function skillMatch(skills: string[], q: Quest): number {
  let m = 0;
  for (const id of skills) {
    const k = SKILL_BY_ID.get(id);
    if (k && k.tags.some((t) => q.tags.includes(t))) m += k.speed;
  }
  return m;
}

/** Expected ticks for an agent to finish a quest (shown in the Status Window). */
export function questTicks(skills: string[], level: number, q: Quest): number {
  return Math.ceil(q.effort / (1 + skillMatch(skills, q) + level * 0.04));
}

// ---------------------------------------------------------------------------------------------------------
async function loadState(season: number, agents: Agent[], now: number): Promise<SeasonState> {
  const raw = await getState("sim_state", "");
  const st = raw ? (JSON.parse(raw) as SeasonState) : null;
  if (st && st.season === season) return st;
  const king = agents.find((a) => a.job.id === "demon_king");
  const gens = agents.filter((a) => a.job.id === "demon_general");
  const fresh: SeasonState = {
    season, started: now, phase: 1, seals: 0, hero: null, heroName: null, heroAt: null, lastStand: false, raid: null,
    king: { chog: king?.id ?? 0, region: "demon", dungeon: CASTLE, hp: 120000, max: 120000, down: false },
    generals: NATIONS.map((r, i) => ({ chog: gens[i]?.id ?? 0, region: r, dungeon: generalDungeon(r), hp: 30000, max: 30000, down: false })),
  };
  await run(`INSERT INTO chronicle(season, tick, at, kind, chog, text) VALUES(?,?,?,?,?,?)`,
    [season, 0, now, "season", null, narrate("season", season, { n: season })]);
  return fresh;
}

function initAgent(a: Agent, st: SeasonState) {
  // New season (or first run): a fresh life. Memories (posts) live elsewhere and are kept.
  Object.assign(a, { level: 1, xp: 0, gold: 20, story: 0, kills: 0, quest: null, qprog: 0, qneed: 0, qgiver: null, log: [], dmg: 0 });
  const region = regionOfHouse(a.house);
  a.home = `p:${pickOr(townsOf(region), ALL_TOWNS, hash(`home:${a.id}`))}`;
  const school = SCHOOL_OF[a.job.role ?? a.job.track];
  a.skills = school ? [`${school}_${1 + (hash(`sk:${a.id}`) % 2)}`] : [];
  a.maxhp = 100 + (a.stats.VIT ?? 0) * 5;
  a.hp = a.maxhp;
  if (a.job.id === "demon_king") a.work = `b:${CASTLE}`;
  else if (a.job.id === "demon_general") {
    const g = st.generals.find((x) => x.chog === a.id);
    a.work = `b:${g ? g.dungeon : pick(DUNGEONS, a.id)}`;
  } else if (a.job.id === "cultist") a.work = `b:${CASTLE}`;
  else if (isDemon(a)) a.work = `b:${pick(DUNGEONS, hash(`dg:${a.id}`))}`;
  else {
    const wb = workplaceOf(a);
    a.work = wb >= 0 ? `b:${wb}` : a.home;
  }
  a.state = isDemon(a) ? "idle" : "work";
  a.place = a.work;
  a.until = 0;
}

const WORKPLACE_BUILDING: Record<string, string> = { guild: "guild_hall", castle: "keep" };
function workplaceOf(a: Agent): number {
  const type = WORKPLACE_BUILDING[a.job.workplace] ?? a.job.workplace;
  const region = regionOfHouse(a.house);
  const toCapital = hash(`cap:${a.id}`) % 100 < 22;
  const local = buildingsOf(type, toCapital ? "capital" : region);
  const any = buildingsOf(type);
  if (local.length) return pick(local, hash(`work:${a.id}`));
  return any.length ? pick(any, hash(`work:${a.id}`)) : -1;
}

// ---------------------------------------------------------------------------------------------------------
export async function simTick(tick: number, now = Date.now()): Promise<{ lines: number; phase: number; hero: number | null; writes?: number }> {
  await ensureSimSchema();
  const season = Number(await getState("season", "0"));
  if (!season) return { lines: 0, phase: 0, hero: null };
  const rows = await all<any>(
    `SELECT c.id, c.name, c.house, cs.job, cs.stats, a.season AS aseason, a.state, a.place, a.home, a.work, a.quest, a.qprog, a.qneed,
            a.qgiver, a.skills, a.hp, a.maxhp, a.level, a.xp, a.gold, a.story, a.kills, a.until, a.log, a.dmg
     FROM chogs c JOIN chog_season cs ON cs.chog_id = c.id AND cs.season = ?
     LEFT JOIN agents a ON a.chog_id = c.id
     WHERE c.id > 0 ORDER BY c.id`,
    [season],
  );
  const agents: Agent[] = rows.map((r) => ({
    id: Number(r.id), name: String(r.name), house: String(r.house), job: JOB_BY_ID[r.job] ?? JOB_BY_ID.shopkeeper,
    stats: JSON.parse(r.stats || "{}"), state: r.state ?? "", place: r.place ?? "", home: r.home ?? "", work: r.work ?? "",
    quest: r.quest ?? null, qprog: Number(r.qprog ?? 0), qneed: Number(r.qneed ?? 0), qgiver: r.qgiver ?? null,
    skills: JSON.parse(r.skills || "[]"), hp: Number(r.hp ?? 100), maxhp: Number(r.maxhp ?? 100), level: Number(r.level ?? 1),
    xp: Number(r.xp ?? 0), gold: Number(r.gold ?? 20), story: Number(r.story ?? 0), kills: Number(r.kills ?? 0),
    until: Number(r.until ?? 0), log: JSON.parse(r.log || "[]"), dmg: Number(r.dmg ?? 0),
    ...(Number(r.aseason) === season ? {} : { state: "" }),
  }));
  const st = await loadState(season, agents, now);
  const fresh = new Set<number>();
  for (const a of agents) if (!a.state || !a.work) { initAgent(a, st); fresh.add(a.id); }
  const byId = new Map(agents.map((a) => [a.id, a]));
  const rand = mulberry32((tick * 2654435761) >>> 0);
  const lines: { kind: string; chog: number | null; text: string }[] = [];
  const hist: { chog: number; kind: string; other: number | null; ref: string | null; text: string }[] = [];
  /** Remember a moment in this Chog's life (chog_history). */
  const remember = (a: Agent, kind: string, text: string, other: number | null = null, ref: string | null = null) =>
    hist.push({ chog: a.id, kind, other, ref, text });
  for (const id of fresh) {
    const a = byId.get(id)!;
    remember(a, "summoned", isDemon(a)
      ? `Rose in the demon realm as ${article(a.job.name)}, serving the Demon King from ${placeName(a.work)}.`
      : `Summoned to Monadia as ${article(a.job.name)} of ${placeName(a.home)}.`, null, a.job.id);
  }
  const say = (kind: string, a: Agent | null, vars: Record<string, string | number>, toLog = true): string => {
    const text = narrate(kind, hash(`${kind}:${tick}:${a?.id ?? 0}:${lines.length}`), { a: a?.name ?? "", track: a?.job.track, jobid: a?.job.id, ...vars });
    lines.push({ kind, chog: a?.id ?? null, text });
    if (a && toLog) a.log = [`${tick}: ${text}`, ...a.log].slice(0, 8);
    return text;
  };
  const progress = (now - st.started) / seasonMs();
  const sig = emptySignals();
  let raidNow: NovelCtx["raid"] = null;
  let heroArchive: Agent | null = null;
  // Real-time pacing: a late or skipped tick (GitHub Actions can lag) counts for the time that actually
  // passed, within 0.5x..3x, so a 24-hour season keeps its rhythm.
  const lastAt = Number(await getState("sim_last_at", "0"));
  const pace = lastAt ? Math.min(3, Math.max(0.5, (now - lastAt) / (Number(process.env.SIM_TICK_SECONDS || 45) * 1000))) : 1;
  const XM = xpMul() * pace;
  const levelBefore = new Map(agents.map((a) => [a.id, a.level]));
  const before = new Map(agents.map((a) => [a.id, fresh.has(a.id) ? "" : rowKey(a)]));  // new agents always save

  // 1. Player gifts (skills and quests from Constellations), applied before anyone acts.
  const gifts = await all<any>(`SELECT id, kind, chog_id, ref, author FROM gifts WHERE status = 'pending' ORDER BY id LIMIT 200`);
  for (const g of gifts) {
    const a = byId.get(Number(g.chog_id));
    if (!a) continue;
    if (g.kind === "skill" && SKILL_BY_ID.has(g.ref) && !a.skills.includes(g.ref) && a.skills.length < MAX_SKILLS) {
      a.skills.push(g.ref);
      say("gift_skill", a, { skill: SKILL_BY_ID.get(g.ref)!.name });
      sig.gift.push({ chog: a.id, author: String(g.author) });
      remember(a, "gift_skill", `A Constellation (${who(g.author)}) granted the skill "${SKILL_BY_ID.get(g.ref)!.name}".`, null, String(g.author));
    } else if (g.kind === "quest" && QUEST_BY_ID.has(g.ref) && !isDemon(a)) {
      startQuest(a, QUEST_BY_ID.get(g.ref)!, st, String(g.author));
      a.hp = Math.max(a.hp, Math.round(a.maxhp * 0.5));
      say("gift_quest", a, { quest: QUEST_BY_ID.get(g.ref)!.name });
      sig.gift.push({ chog: a.id, author: String(g.author) });
      remember(a, "gift_quest", `A Constellation (${who(g.author)}) set the quest "${QUEST_BY_ID.get(g.ref)!.name}".`, null, String(g.author));
    }
  }
  if (gifts.length) await batch(gifts.map((g) => ({ sql: `UPDATE gifts SET status = 'done' WHERE id = ?`, args: [g.id] })));

  // 2. Director: phase, last stand.
  const generalsUp = st.generals.filter((g) => !g.down).length;
  st.seals = 4 - generalsUp;
  const prevPhase = st.phase;
  st.phase = st.hero ? 4 : generalsUp === 0 ? 3 : progress >= 0.08 ? 2 : 1;
  if (st.phase === 3 && prevPhase === 2) say("march", null, {});
  if (!st.lastStand && !st.king.down && progress >= 0.92) {
    st.lastStand = true;
    say("last_stand", null, {});
  }
  const dmgMul = st.lastStand ? 3 : 1;
  // HP floors: bosses can't fall before their scheduled share of the season (pacing), only after.
  const floor = (b: Boss, target: number) => Math.max(0, b.max * (1 - progress / target));
  const genTarget = (i: number) => 0.35 + i * 0.1;
  const hitBoss = (b: Boss, i: number, dmg: number, a: Agent) => {
    if (b.down) return;
    const f = b === st.king ? floor(b, 0.85) : floor(b, genTarget(i));
    b.hp = Math.max(f, b.hp - dmg);
    if (b.hp <= 0) {
      b.down = true;
      sig.slay.push({ chog: a.id, region: b === st.king ? "king" : b.region });
      const bossName = byId.get(b.chog)?.name ?? "the boss";
      if (b === st.king) {
        st.hero = a.id;
        st.heroName = a.name;
        st.heroAt = tick;
        a.story += 50;
        say("hero", a, { job: a.job.name, n: season });
        remember(a, "hero", `Landed the final blow on ${byId.get(b.chog)?.name ?? "the Demon King"}, the Demon King. Hero of Season ${season}.`, b.chog);
        heroArchive = a;
      } else {
        st.seals += 1;
        a.story += 20;
        say("general_down", a, { boss: `${bossName} the Demon General`, n: st.seals });
        remember(a, "slay_general", `Slew ${bossName}, Demon General of ${cap(b.region)}, breaking seal ${st.seals} of 4.`, b.chog, b.region);
        const gAgent = byId.get(b.chog);
        if (gAgent) remember(gAgent, "fell", `Fell to ${a.name} in the dungeon of ${cap(b.region)}.`, a.id);
        const g = byId.get(b.chog);
        if (g) { g.state = "rest"; g.place = `b:${CASTLE}`; g.hp = 0; }
      }
    }
  };

  // 3. Raids: henchmen attack a town; whoever is home defends it.
  if (st.raid && st.raid.until <= tick) {
    const r = st.raid;
    const raiders = r.raiders.map((id) => byId.get(id)!).filter(Boolean);
    const defenders = agents.filter((a) => !isDemon(a) && a.home === `p:${r.town}` && (a.state === "work" || a.state === "idle")).slice(0, 30);
    const atk = raiders.reduce((s, a) => s + power(a), 0) * (0.8 + rand() * 0.4);
    const def = defenders.reduce((s, a) => s + power(a), 0) * (0.8 + rand() * 0.4);
    const town = P[r.town]?.name ?? "a town";
    if (def >= atk) {
      for (const d of defenders) { d.xp += Math.round(15 * XM); d.story += 1; d.kills += 1; remember(d, "raid_held", `Defended ${town} against ${raiders.length} demons.`, null, String(r.town)); }
      for (const x of raiders) remember(x, "raid_lost", `Raided ${town} and was driven back.`, null, String(r.town));
      for (const x of raiders) { x.hp = 0; x.state = "rest"; x.place = x.work; }
      say("raid_won", defenders[0] ?? null, { place: town });
    } else {
      const hurt = defenders.filter(() => rand() < 0.5);
      for (const d of hurt) { d.hp = Math.max(0, d.hp - 40); remember(d, "raid_hurt", `Was wounded when the demons overran ${town}.`, null, String(r.town)); }
      for (const x of raiders) remember(x, "raid_won", `Raided ${town} and carried off its loot.`, null, String(r.town));
      for (const x of raiders) { x.xp += Math.round(10 * XM); x.state = "idle"; x.place = x.work; }
      say("raid_lost", null, { place: town, n: hurt.length }, false);
    }
    sig.raid.push({ town: r.town, held: def >= atk, defenders: defenders.map((d) => d.id) });
    st.raids ??= {};
    const tally = (st.raids[String(r.town)] ??= { held: 0, lost: 0 });
    if (def >= atk) tally.held += 1; else tally.lost += 1;
    raidNow = { town: r.town, held: def >= atk, size: raiders.length, defender: defenders[0]?.id ?? null };
    st.raid = null;
  } else if (!st.raid && st.phase >= 2 && st.phase < 4 && rand() < 0.2) {
    const ready = agents.filter((a) => a.job.role === "henchman" && a.hp > 0 && a.state !== "rest");
    const n = Math.min(ready.length, 8 + Math.floor(rand() * 10));
    const town = pick(ALL_TOWNS, Math.floor(rand() * 1e9));
    const raiders = ready.sort(() => rand() - 0.5).slice(0, n);
    for (const x of raiders) { x.state = "raid"; x.place = `p:${town}`; }
    st.raid = { town, raiders: raiders.map((x) => x.id), until: tick + 3 };
    say("raid_start", null, { place: P[town]?.name ?? "a town", n });
  }

  // 4. Agents.
  const free: Agent[] = [];
  let narrated = 0;
  let flavored = 0;
  for (const a of agents) {
    const r = mulberry32((tick * 7919 + a.id * 104729) >>> 0);
    if (isDemon(a)) {
      if (a.state === "raid") continue;
      if (a.hp <= 0 || a.state === "rest") {
        a.hp = Math.min(a.maxhp, a.hp + a.maxhp * 0.1);
        if (a.hp >= a.maxhp * 0.9 && !(a.job.id === "demon_general" && st.generals.find((g) => g.chog === a.id)?.down)) { a.state = "idle"; a.place = a.work; }
        continue;
      }
      a.place = a.work;
      a.state = a.job.id === "demon_king" ? (st.phase === 3 ? "fight" : "idle") : r() < 0.3 ? "fight" : "idle";
      continue;
    }
    // Resting heals; injured Chogs go to a temple.
    if (a.hp <= 0 || a.state === "rest") {
      a.state = "rest";
      const temples = buildingsOf("temple", P[Number(a.home.slice(2))]?.region);
      a.place = `b:${temples.length ? pick(temples, a.id) : pick(buildingsOf("temple"), a.id)}`;
      a.hp = Math.min(a.maxhp, Math.round(a.hp + a.maxhp * 0.2));
      if (a.hp >= a.maxhp * 0.9) { a.state = "idle"; a.place = a.home; a.until = tick + 2; }
      continue;
    }
    if (a.quest) {
      const q = QUEST_BY_ID.get(a.quest);
      if (!q) { a.quest = null; continue; }
      a.qprog += (1 + skillMatch(a.skills, q) + a.level * 0.04) * (0.8 + r() * 0.4) * pace;
      const danger = q.boss || q.site === "dungeon" || q.kind === "hunt";
      if (danger) {
        const hurt = q.tier * 5 * (0.4 + r()) / (1 + defense(a));
        a.hp = Math.round(a.hp - hurt);
        if (a.hp <= 0) {
          if (narrated++ < 6) say("quest_fail", a, { quest: q.name, qkind: q.kind });
          if (q.boss === "general" && q.region) sig.ko.push({ chog: a.id, region: q.region });
          remember(a, "quest_fail", `Was knocked out during "${q.name}" and carried to the temple.`, null, q.id);
          a.quest = null; a.state = "rest"; a.qgiver = null;
          continue;
        }
      }
      if (q.boss === "general" || q.boss === "king") {
        const gi = st.generals.findIndex((g) => g.region === q.region);
        const boss = q.boss === "king" ? st.king : st.generals[gi];
        if (!boss || boss.down) { a.quest = null; a.state = "idle"; a.place = a.home; continue; }
        const dmg = Math.round(power(a) * (0.6 + r() * 0.8) * dmgMul);
        a.dmg += dmg;
        sig.hit.push({ chog: a.id, region: q.boss === "king" ? "king" : String(q.region) });
        hitBoss(boss, gi, dmg, a);
        if (r() < 0.04 && narrated++ < 6) say("boss_hit", a, { boss: `${byId.get(boss.chog)?.name ?? "the boss"} the ${q.boss === "king" ? "Demon King" : "Demon General"}`, n: dmg });
      }
      if (a.qprog >= a.qneed) {
        a.xp += Math.round(q.xp * XM); a.gold += q.gold; a.story += q.story;
        if (narrated++ < 10 || a.qgiver) say("quest_done", a, { quest: q.name, place: placeName(a.place), n: q.xp, qkind: q.kind });
        sig.questDone.push({ chog: a.id, gifted: !!a.qgiver });
        remember(a, "quest_done", q.boss === "general" || q.boss === "king"
          ? `Survived "${q.name}", dealing ${a.dmg} damage.` : `Completed "${q.name}" at ${placeName(a.place)}.`, null, q.id);
        a.dmg = 0;
        a.quest = null; a.qgiver = null; a.state = "idle"; a.place = a.home; a.until = tick + 1;
      }
      levelUp(a, say, remember);
      continue;
    }
    if (a.until > tick) continue;
    // Free this tick: quest, meet someone, work or wander.
    const adventurer = a.job.track === "adventurer";
    const pQuest = (adventurer ? 0.3 : 0.04) + Math.min(0.2, a.level * 0.015);
    const roll = r();
    if (roll < pQuest) {
      const q = chooseQuest(a, st, progress, r);
      if (q) {
        startQuest(a, q, st, null);
        if (narrated++ < 8) say("quest_start", a, { quest: q.name, place: placeName(a.place), qkind: q.kind });
        continue;
      }
    }
    if (roll < pQuest + 0.1) { free.push(a); continue; }
    if (r() < 0.7) {
      a.state = "work"; a.place = a.work; a.xp += Math.round(2 * XM); a.gold += 1; a.until = tick + 2 + Math.floor(r() * 4);
      if (flavored < 3 && r() < 0.1) { flavored++; remember(a, "work", say("work", a, { place: placeName(a.work) })); }  // a small scene from the job
    }
    else { a.state = "idle"; a.place = a.home; a.until = tick + 1 + Math.floor(r() * 3); }
    levelUp(a, say, remember);
  }

  // 5. Meetings: pairs from the same town train, trade, gossip, heal or team up.
  const byHome = new Map<string, Agent[]>();
  for (const a of free) byHome.set(a.home, [...(byHome.get(a.home) ?? []), a]);
  let social = 0;
  for (const group of byHome.values()) {
    for (let i = 0; i + 1 < group.length; i += 2) {
      const a = group[i], b = group[i + 1];
      const k = rand();
      const vars = { b: b.name, place: placeName(a.home) };
      a.state = "idle"; b.state = "idle"; a.place = a.home; b.place = a.home; a.until = b.until = tick + 2;
      if (k < 0.3) { sig.spar.push([a.id, b.id]); a.xp += Math.round(6 * XM); b.xp += Math.round(6 * XM); if (social++ < 4) { const t = say("train", a, vars); remember(a, "train", t, b.id); remember(b, "train", t, a.id); } }
      else if (k < 0.5) { a.gold += 2; b.gold = Math.max(0, b.gold - 1); if (social++ < 4) { const t = say("trade", a, vars); remember(a, "trade", t, b.id); remember(b, "trade", t, a.id); } }
      else if (k < 0.75) {
        a.story += 1;
        const g = st.generals.find((x) => !x.down) ?? st.king;
        if (social++ < 4) { const t = say("gossip", a, { ...vars, boss: byId.get(g.chog)?.name ?? "the Demon King" }); remember(a, "gossip", t, b.id); remember(b, "gossip", t, a.id); }
      } else {
        const q = chooseQuest(a, st, progress, rand);
        if (q) {
          startQuest(a, q, st, null);
          startQuest(b, q, st, null);
          b.place = a.place;
          if (social++ < 4) say("party", a, { ...vars, quest: q.name, qkind: q.kind });
          remember(a, "party", `Formed a party with ${b.name} for "${q.name}".`, b.id, q.id);
          remember(b, "party", `Joined ${a.name} on "${q.name}".`, a.id, q.id);
        }
      }
    }
  }

  // A little world colour every few ticks: weather, festivals, odd visitors, rumours.
  if (tick % 4 === 1) {
    const spot = P[hash(`world:${tick}`) % P.length];
    const regionName = WORLD.regions.find((x) => x.id === spot.region)?.name ?? "Monadia";
    say("world", null, { place: spot.name, region: regionName }, false);
  }

  // 6. Story threads: rivals, nemeses, sieges, sponsored Chogs, underdogs.
  if (tick % 10 === 0)
    sig.candidates = agents.filter((a) => !isDemon(a)).sort((a, b) => b.story - a.story || b.level - a.level).slice(0, 5)
      .filter((a) => a.job.track !== "adventurer").map((a) => a.id);
  const genName = (region: string) => {
    const g = region === "king" ? st.king : st.generals.find((x) => x.region === region);
    return g ? `${byId.get(g.chog)?.name ?? "a demon"} the ${region === "king" ? "Demon King" : "Demon General"}` : "a Demon General";
  };
  const threadLines = await advanceThreads(season, tick, sig, (id) => byId.get(id)?.name ?? "someone", (i) => P[i]?.name ?? "a town", genName);
  for (const t of threadLines) {
    lines.push({ kind: "thread", chog: t.chog, text: t.text });
    for (const id of t.actors) {
      const x = byId.get(id);
      if (x) remember(x, "thread", t.text.replace(/^\[THREAD\] /, ""), null, t.kind);
    }
  }

  // 7. The season novel: chapters whose milestone was reached this tick.
  const novelCtx = (seasonEnd: boolean): NovelCtx => ({
    season, tick, now, st, progress, seasonStart: fresh.size > 1000, seasonEnd, raid: raidNow, placeName,
  });
  const chapter = async (end: boolean) => {
    for (const title of await writeChapters(novelCtx(end))) lines.push({ kind: "chapter", chog: null, text: `[CHRONICLE] A new chapter is written: "${title}".` });
  };

  // 8. Season end: once a Hero exists and the season clock is up, a new season re-rolls every job.
  if (st.hero && progress >= 1) {
    await saveAll(agents, season, before, levelBefore);
    await writeHistory(hist, season, tick, now);
    await chapter(true);
    await setState("sim_last_at", now);
    await batch(lines.map((l) => ({ sql: `INSERT INTO chronicle(season, tick, at, kind, chog, text) VALUES(?,?,?,?,?,?)`, args: [season, tick, now, l.kind, l.chog, l.text] })));
    await startSeason(season + 1);
    await setState("sim_state", "");
    return { lines: lines.length, phase: 4, hero: st.hero };
  }

  const writes = await saveAll(agents, season, before, levelBefore);
  await writeHistory(hist, season, tick, now);
  await chapter(false);
  await setState("sim_last_at", now);
  if (heroArchive) await archiveSeason(season, st, heroArchive, agents, now);
  await setState("sim_state", JSON.stringify(st));
  if (lines.length)
    await batch(lines.map((l) => ({ sql: `INSERT INTO chronicle(season, tick, at, kind, chog, text) VALUES(?,?,?,?,?,?)`, args: [season, tick, now, l.kind, l.chog, l.text] })));
  return { lines: lines.length, phase: st.phase, hero: st.hero, writes: writes + hist.length + lines.length };
}

/** Title tier for a level: a new title every 3 levels (titles in data/jobs.json). */
export const titleTier = (level: number) => Math.min(4, Math.floor((level - 1) / 3));

function levelUp(a: Agent, say: (k: string, a: Agent, v: Record<string, string | number>) => void,
  remember: (a: Agent, kind: string, text: string, other?: number | null, ref?: string | null) => void) {
  while (a.xp >= a.level * 50) {
    a.xp -= a.level * 50;
    const tier = titleTier(a.level);
    a.level += 1;
    a.maxhp += 8;
    if (a.level >= 4) say("level_up", a, { n: a.level });
    remember(a, "level", `Reached level ${a.level}.`, null, String(a.level));
    if (titleTier(a.level) > tier) remember(a, "title", `Earned the title "${a.job.titles[titleTier(a.level)]}".`, null, a.job.titles[titleTier(a.level)]);
  }
}

const article = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
/** Short public label for a gift's author: 0x12ab…cd34, or "a judge". */
const who = (author: unknown) => {
  const s = String(author);
  return s.startsWith("judge") ? "a judge" : s.startsWith("0x") ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
};

function chooseQuest(a: Agent, st: SeasonState, progress: number, r: () => number): Quest | null {
  const maxTier = Math.min(5, 1 + Math.floor(a.level / 3), 1 + Math.floor(progress * 6));
  const strong = a.level >= (a.job.track === "adventurer" ? 4 : 6);
  const pool: [Quest, number][] = [];
  for (const q of QUESTS) {
    let ok = q.tier <= maxTier;
    if (q.boss === "general") ok = st.phase === 2 && strong && !st.generals.find((g) => g.region === q.region)?.down;
    if (q.boss === "king") ok = st.phase === 3 && a.level >= (a.job.track === "adventurer" ? 5 : 6);
    if (q.boss === "seal") ok = st.phase >= 2 && a.level >= 5;
    if (!ok) continue;
    pool.push([q, (1 + 3 * skillMatch(a.skills, q)) * (q.boss ? 3 : 1)]);
  }
  if (!pool.length) return null;
  let t = r() * pool.reduce((s, [, w]) => s + w, 0);
  for (const [q, w] of pool) if ((t -= w) <= 0) return q;
  return pool[pool.length - 1][0];
}

function startQuest(a: Agent, q: Quest, st: SeasonState, giver: string | null) {
  a.quest = q.id;
  a.qprog = 0;
  a.qneed = q.effort;
  a.qgiver = giver;
  a.until = 0;
  const region = P[Number(a.home.slice(2))]?.region ?? "capital";
  if (q.boss === "king") a.place = `b:${st.king.dungeon}`;
  else if (q.boss === "general") a.place = `b:${st.generals.find((g) => g.region === q.region)?.dungeon ?? DUNGEONS[0]}`;
  else if (q.site === "dungeon") a.place = `b:${pickOr(buildingsOf("dungeon", region), DUNGEONS, hash(`qd:${a.id}:${q.id}`))}`;
  else if (q.site === "wild") a.place = `p:${pickOr(wildsOf(region), ALL_WILDS, hash(`qw:${a.id}:${q.id}`))}`;
  else a.place = a.home;
  a.state = q.boss || q.site === "dungeon" || q.kind === "hunt" ? "fight" : "quest";
}

const rowKey = (a: Agent) => JSON.stringify([a.state, a.place, a.home, a.work, a.quest, a.qprog, a.qneed, a.qgiver, a.skills, a.hp, a.maxhp,
  a.level, a.xp, a.gold, a.story, a.kills, a.until, a.log, a.dmg]);

/** Writes only the agents that changed this tick (most working Chogs don't), plus level changes to
 *  chog_season (the free database tier counts every row written). Returns the number of rows written. */
async function saveAll(agents: Agent[], season: number, before: Map<number, string>, levelBefore: Map<number, number>) {
  const changed = agents.filter((a) => before.get(a.id) !== rowKey(a));
  const stmts = changed.map((a) => ({
    sql: `INSERT INTO agents(chog_id, season, state, place, home, work, quest, qprog, qneed, qgiver, skills, hp, maxhp, level, xp, gold, story, kills, until, log, dmg)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(chog_id) DO UPDATE SET season=excluded.season, state=excluded.state, place=excluded.place, home=excluded.home, work=excluded.work,
            quest=excluded.quest, qprog=excluded.qprog, qneed=excluded.qneed, qgiver=excluded.qgiver, skills=excluded.skills, hp=excluded.hp,
            maxhp=excluded.maxhp, level=excluded.level, xp=excluded.xp, gold=excluded.gold, story=excluded.story, kills=excluded.kills,
            until=excluded.until, log=excluded.log, dmg=excluded.dmg`,
    args: [a.id, season, a.state, a.place, a.home, a.work, a.quest, +a.qprog.toFixed(2), a.qneed, a.qgiver, JSON.stringify(a.skills),
      Math.max(0, Math.round(a.hp)), a.maxhp, a.level, a.xp, a.gold, a.story, a.kills, a.until, JSON.stringify(a.log), a.dmg],
  }));
  for (let i = 0; i < stmts.length; i += 500) await batch(stmts.slice(i, i + 500));
  // Mirror into the season table that older panels read, only when the level changed (titles and levels).
  const mirror = changed.filter((a) => levelBefore.get(a.id) !== a.level).map((a) => ({ sql: `UPDATE chog_season SET level = ?, xp = ?, gold = ?, hp = ?, story = ? WHERE chog_id = ? AND season = ?`,
    args: [a.level, a.xp, a.gold, Math.max(0, Math.round(a.hp)), a.story, a.id, season] }));
  for (let i = 0; i < mirror.length; i += 500) await batch(mirror.slice(i, i + 500));
  return changed.length + mirror.length;
}

async function writeHistory(hist: { chog: number; kind: string; other: number | null; ref: string | null; text: string }[], season: number, tick: number, now: number) {
  const stmts = hist.map((h) => ({
    sql: `INSERT INTO chog_history(chog_id, season, tick, at, kind, other, ref, text) VALUES(?,?,?,?,?,?,?,?)`,
    args: [h.chog, season, tick, now, h.kind, h.other, h.ref, h.text],
  }));
  for (let i = 0; i < stmts.length; i += 500) await batch(stmts.slice(i, i + 500));
}

/** Hall of Heroes: the Hero, who slew each general, the top Chogs and the Constellations behind the Hero. */
async function archiveSeason(season: number, st: SeasonState, hero: Agent, agents: Agent[], now: number) {
  const slayers = await all<any>(
    `SELECT h.chog_id id, c.name, h.ref region FROM chog_history h JOIN chogs c ON c.id = h.chog_id WHERE h.season = ? AND h.kind = 'slay_general'`, [season]);
  const top = agents.filter((a) => !isDemon(a)).sort((a, b) => b.story - a.story || b.level - a.level).slice(0, 10)
    .map((a) => ({ id: a.id, name: a.name, job: a.job.name, level: a.level, story: a.story }));
  const sponsors = await all<any>(`SELECT DISTINCT author FROM gifts WHERE chog_id = ? AND status = 'done'`, [hero.id]);
  await run(
    `INSERT OR REPLACE INTO season_archive(season, hero, hero_name, hero_job, started, ended, slayers, top, sponsors) VALUES(?,?,?,?,?,?,?,?,?)`,
    [season, hero.id, hero.name, hero.job.name, st.started, now,
      JSON.stringify(slayers.map((x) => ({ id: Number(x.id), name: x.name, region: x.region }))), JSON.stringify(top),
      JSON.stringify(sponsors.map((x) => who(x.author)))],
  );
}
