// Season setup: every Chog gets a job (random but seeded, tilted by traits) and fresh level-1 stats.
import jobsJson from "../../data/jobs.json";
import { all, batch, getState, run, setState } from "../lib/db";
import { mulberry32 } from "../world/terrain";

export type Affinity = { trait: string; match: string[]; weight: number };
export type Job = {
  id: string; name: string; track: "civic" | "craft" | "service" | "land" | "adventurer" | "demon";
  role?: string; workplace: string; quota: number; titles: string[]; affinity: Affinity[];
};
export const JOBS = (jobsJson as { jobs: Job[] }).jobs;
export const JOB_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j])) as Record<string, Job>;

export const STATS = ["STR", "VIT", "AGI", "INT", "WIS", "LUK"] as const;
export type Stat = (typeof STATS)[number];
export type Stats = Record<Stat, number>;

/** Role bias: where an adventurer's extra points go. Civilians get a mild bias toward their craft. */
const ROLE_BIAS: Record<string, Partial<Stats>> = {
  tank: { VIT: 4, STR: 2 }, main_dps: { STR: 3, INT: 2, AGI: 1 }, sub_dps: { AGI: 4, LUK: 1 },
  healer: { WIS: 4, VIT: 1 }, support: { INT: 3, LUK: 2 }, buffer: { WIS: 3, LUK: 2 },
  civic: { VIT: 1, STR: 1 }, craft: { STR: 1, INT: 1 }, service: { WIS: 1, LUK: 1 }, land: { VIT: 1, AGI: 1 },
  demon_king: { STR: 6, VIT: 6, INT: 6 }, demon_general: { STR: 4, VIT: 4, INT: 2 }, henchman: { STR: 2, AGI: 1 },
};

export const SCHEMA_V2 = [
  `CREATE TABLE IF NOT EXISTS seasons (n INTEGER PRIMARY KEY, seed INTEGER NOT NULL, started_at INTEGER NOT NULL, chapter INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS chog_season (
    chog_id INTEGER NOT NULL, season INTEGER NOT NULL, job TEXT NOT NULL, role TEXT, track TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, rank TEXT NOT NULL DEFAULT 'F',
    stats TEXT NOT NULL, gold INTEGER NOT NULL DEFAULT 20, hp INTEGER NOT NULL DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'ok', story INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (chog_id, season)
  )`,
  `CREATE INDEX IF NOT EXISTS chog_season_job ON chog_season(season, job)`,
];

function affinityWeight(job: Job, traits: Record<string, string>): number {
  let w = 1;
  for (const a of job.affinity) {
    const v = (traits[a.trait] || "").toLowerCase();
    if (v && a.match.some((m) => v.includes(m))) w *= a.weight;
  }
  return w;
}

function rollStats(rand: () => number, bias: Partial<Stats>): Stats {
  const s = Object.fromEntries(STATS.map((k) => [k, 2])) as Stats; // 12 base points
  for (let i = 0; i < 13; i++) s[STATS[Math.floor(rand() * STATS.length)]]++; // 13 random points = 25 total
  for (const [k, v] of Object.entries(bias)) s[k as Stat] += v as number;
  return s;
}

/**
 * Deterministic assignment: process jobs in a seeded order; each job takes `quota` Chogs from the
 * remaining pool by weighted sampling without replacement (Efraimidis–Spirakis keys u^(1/w)).
 */
export function assignJobs(season: number, chogs: { id: number; traits: Record<string, string> }[]) {
  const rand = mulberry32(0x5eed + season * 7919);
  const order = [...JOBS].sort(() => rand() - 0.5);
  const pool = new Set(chogs.map((c) => c.id));
  const traitsOf = new Map(chogs.map((c) => [c.id, c.traits]));
  const result = new Map<number, Job>();
  for (const job of order) {
    const keys: [number, number][] = [];
    for (const id of pool) keys.push([id, Math.pow(rand(), 1 / affinityWeight(job, traitsOf.get(id) ?? {}))]);
    keys.sort((a, b) => b[1] - a[1]);
    for (const [id] of keys.slice(0, job.quota)) {
      result.set(id, job);
      pool.delete(id);
    }
  }
  // Supply snapshot may be short of 1,969: leftovers (none expected) become wanderers in the guild pool.
  for (const id of pool) result.set(id, JOB_BY_ID.sub_dps);
  return result;
}

export async function currentSeason(): Promise<number> {
  return Number(await getState("season", "0"));
}

/** Start a new season: re-roll every job, reset levels/stats/gold. */
export async function startSeason(n?: number) {
  for (const s of SCHEMA_V2) await run(s);
  const season = n ?? (await currentSeason()) + 1;
  const rows = await all<{ id: number; traits: string }>(`SELECT id, traits FROM chogs WHERE id > 0`);
  const chogs = rows.map((r) => ({ id: Number(r.id), traits: JSON.parse(r.traits) as Record<string, string> }));
  const jobs = assignJobs(season, chogs);
  const rand = mulberry32(0xb0b + season * 104729);
  const stmts = chogs.map((c) => {
    const job = jobs.get(c.id)!;
    const stats = rollStats(rand, ROLE_BIAS[job.role ?? job.track] ?? {});
    return {
      sql: `INSERT INTO chog_season(chog_id, season, job, role, track, stats) VALUES(?,?,?,?,?,?)
            ON CONFLICT(chog_id, season) DO UPDATE SET job = excluded.job, role = excluded.role, track = excluded.track,
            stats = excluded.stats, level = 1, xp = 0, rank = 'F', gold = 20, hp = 100, status = 'ok', story = 0`,
      args: [c.id, season, job.id, job.role ?? null, job.track, JSON.stringify(stats)],
    };
  });
  await batch(stmts);
  await run(`INSERT OR REPLACE INTO seasons(n, seed, started_at, chapter) VALUES(?,?,?,1)`, [season, season * 7919, Date.now()]);
  await setState("season", season);
  return { season, assigned: chogs.length };
}
