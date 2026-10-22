// Story threads (docs/STORY_PLAN.md §3): character arcs that open, grow and pay off, driven by what the
// simulation did this tick. Deterministic; every stage has fixed lines with pointers.
import { all, batch, run } from "../lib/db";
import { narrate } from "./narrate";

export type Signals = {
  spar: [number, number][];                       // two Chogs trained together
  ko: { chog: number; region: string }[];          // knocked out on a Demon General's quest
  hit: { chog: number; region: string }[];         // struck a general ("king" for the Demon King)
  slay: { chog: number; region: string }[];        // slew a general ("king" = became Hero)
  raid: { town: number; held: boolean; defenders: number[] }[];
  gift: { chog: number; author: string }[];
  questDone: { chog: number; gifted: boolean }[];
  candidates: number[];                           // current top hero candidates (non-demons), best first
};

export const emptySignals = (): Signals => ({ spar: [], ko: [], hit: [], slay: [], raid: [], gift: [], questDone: [], candidates: [] });

type Thread = { id?: number; kind: string; key: string; a: number; b: number | null; stage: number; count: number; data: Record<string, any>; dirty?: boolean };

export const THREAD_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT, season INTEGER NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL,
    a INTEGER NOT NULL, b INTEGER, stage INTEGER NOT NULL DEFAULT 0, count INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL DEFAULT '{}', updated INTEGER NOT NULL DEFAULT 0, UNIQUE(season, kind, key)
  )`,
];

export type ThreadOut = { kind: string; chog: number | null; text: string; actors: number[] };

/**
 * Advance every thread with this tick's signals. `name(id)` and `town(i)` resolve pointers; `general(region)` gives
 * the general's name. Returns lines for the chronicle (and the actors' histories).
 */
export async function advanceThreads(
  season: number, tick: number, sig: Signals,
  name: (id: number) => string, town: (i: number) => string, general: (region: string) => string,
): Promise<ThreadOut[]> {
  const rows = await all<any>(`SELECT * FROM threads WHERE season = ? AND stage < 9`, [season]);
  const map = new Map<string, Thread>();
  for (const r of rows) map.set(`${r.kind}:${r.key}`, { id: Number(r.id), kind: r.kind, key: r.key, a: Number(r.a), b: r.b == null ? null : Number(r.b), stage: Number(r.stage), count: Number(r.count), data: JSON.parse(r.data || "{}") });
  const get = (kind: string, key: string, a: number, b: number | null = null) => {
    const k = `${kind}:${key}`;
    let t = map.get(k);
    if (!t) { t = { kind, key, a, b, stage: 0, count: 0, data: {}, dirty: true }; map.set(k, t); }
    return t;
  };
  const out: ThreadOut[] = [];
  const line = (t: Thread, kind: string, vars: Record<string, string | number>, actors: number[]) => {
    out.push({ kind, chog: actors[0] ?? null, actors, text: narrate(kind, tick * 31 + t.a, vars) });
    t.dirty = true;
  };
  const byKind = (kind: string) => [...map.values()].filter((t) => t.kind === kind);

  // Rivals: sparring partners who keep meeting.
  for (const [x, y] of sig.spar) {
    const [a, b] = x < y ? [x, y] : [y, x];
    const t = get("rivals", `${a}-${b}`, a, b);
    t.count += 1; t.dirty = true;
    const v = { a: name(a), b: name(b) };
    if (t.stage === 0 && t.count >= 2) { t.stage = 1; line(t, "rivals_open", v, [a, b]); }
    else if (t.stage === 1 && t.count >= 4) { t.stage = 2; line(t, "rivals_grow", v, [a, b]); }
  }
  // Nemesis: a Demon General that keeps knocking the same Chog out.
  for (const k of sig.ko) {
    const t = get("nemesis", `${k.chog}-${k.region}`, k.chog);
    t.count += 1; t.data.region = k.region; t.dirty = true;
    if (t.stage === 0 && t.count >= 2) { t.stage = 1; line(t, "nemesis_open", { a: name(k.chog), boss: general(k.region) }, [k.chog]); }
  }
  for (const h of sig.hit) {
    const t = map.get(`nemesis:${h.chog}-${h.region}`);
    if (t && t.stage === 1) { t.stage = 2; line(t, "nemesis_return", { a: name(h.chog), boss: general(h.region) }, [h.chog]); }
  }
  // Raids: towns under siege.
  for (const r of sig.raid) {
    const t = get("siege", String(r.town), r.defenders[0] ?? 0);
    t.data.town = r.town; t.dirty = true;
    t.count += 1;
    if (t.stage === 0 && t.count >= 2) { t.stage = 1; t.data.held = 0; line(t, "siege_open", { place: town(r.town), n: t.count }, []); }
    else if (!r.held) t.data.held = 0;
    else if (t.stage >= 1) {
      t.data.held = (t.data.held ?? 0) + 1;
      if (t.data.held >= 2) { t.stage = 9; line(t, "siege_payoff", { place: town(r.town), a: name(r.defenders[0] ?? 0) }, r.defenders.slice(0, 1)); }
    }
  }
  // Sponsored: a Constellation's first gift to a Chog.
  for (const g of sig.gift) {
    const t = get("sponsor", `${g.chog}-${g.author}`, g.chog);
    if (t.stage === 0) { t.stage = 1; t.data.author = g.author; line(t, "sponsor_open", { a: name(g.chog) }, [g.chog]); }
  }
  for (const q of sig.questDone) {
    if (!q.gifted) continue;
    for (const t of byKind("sponsor")) if (t.a === q.chog && t.stage === 1) { t.stage = 2; line(t, "sponsor_step", { a: name(q.chog) }, [q.chog]); }
  }
  // Underdog: a non-adventurer among the top hero candidates.
  for (const id of sig.candidates.slice(0, 5)) {
    const t = get("underdog", String(id), id);
    if (t.stage === 0) { t.stage = 1; line(t, "underdog_open", { a: name(id) }, [id]); }
  }
  // Payoffs for slayers and the Hero.
  for (const sl of sig.slay) {
    const v = { a: name(sl.chog), boss: sl.region === "king" ? "the Demon King" : general(sl.region) };
    for (const t of [...map.values()]) {
      if (t.stage >= 9) continue;
      const mine = t.a === sl.chog || t.b === sl.chog;
      if (!mine) continue;
      if (t.kind === "nemesis" && t.data.region === sl.region) { t.stage = 9; line(t, "nemesis_payoff", v, [sl.chog]); }
      else if (t.kind === "rivals" && t.stage >= 1) { t.stage = 9; line(t, "rivals_payoff", { ...v, b: name(t.a === sl.chog ? t.b! : t.a) }, [sl.chog, t.a === sl.chog ? t.b! : t.a]); }
      else if (t.kind === "sponsor" && t.stage >= 1) { t.stage = 9; line(t, "sponsor_payoff", v, [sl.chog]); }
      else if (t.kind === "underdog" && t.stage >= 1) { t.stage = 9; line(t, "underdog_payoff", v, [sl.chog]); }
    }
  }

  const dirty = [...map.values()].filter((t) => t.dirty);
  const stmts = dirty.map((t) => ({
    sql: `INSERT INTO threads(season, kind, key, a, b, stage, count, data, updated) VALUES(?,?,?,?,?,?,?,?,?)
          ON CONFLICT(season, kind, key) DO UPDATE SET stage = excluded.stage, count = excluded.count, data = excluded.data, updated = excluded.updated`,
    args: [season, t.kind, t.key, t.a, t.b, t.stage, t.count, JSON.stringify(t.data), tick],
  }));
  for (let i = 0; i < stmts.length; i += 500) await batch(stmts.slice(i, i + 500));
  return out;
}

export async function ensureThreadSchema() {
  for (const q of THREAD_SCHEMA) await run(q);
}
