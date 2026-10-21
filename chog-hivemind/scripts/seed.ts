// Seed the world from data/chogs.json. Safe to re-run: keeps existing sim state unless --reset.
import { readFileSync } from "node:fs";
import { batch, migrate, run, all } from "../src/lib/db";
import { buildPersona, hash, HOUSES, nickname } from "../src/sim/world";

const reset = process.argv.includes("--reset");

async function main() {
  const raw = JSON.parse(readFileSync(new URL("../data/chogs.json", import.meta.url), "utf8"));
  const tokens = Object.values(raw) as any[];
  console.log(`tokens in snapshot: ${tokens.length}`);
  if (reset) {
    for (const t of ["chogs", "posts", "follows", "memories", "memes", "adoptions", "injections", "events", "editions", "polls", "ratelimits", "state"])
      await run(`DROP TABLE IF EXISTS ${t}`);
  }
  await migrate();

  const existing = new Set((await all<{ id: number }>(`SELECT id FROM chogs`)).map((r) => Number(r.id)));
  const stmts: any[] = [];
  if (!existing.has(0)) {
    const crier = {
      id: 0, name: "The Hive Crier", house: "moonbeam", temperament: "narrator", voice: "town crier", job: "narrator",
      obsession: "the news", home: "hall", contrarian: false, nightOwl: false, tier: "—", loyalty: "loyal", homes: 1,
      catchphrase: "hear ye, hive.", bio: "The voice of Chog Hivemind news.", traits: {}, activity: 0, activeHours: [],
    };
    stmts.push({
      sql: `INSERT INTO chogs(id, name, image, traits, persona, house, location, activity, last_tick) VALUES(0, ?, NULL, '{}', ?, 'moonbeam', 'hall', 0, 999999999)`,
      args: [crier.name, JSON.stringify(crier)],
    });
  }
  for (const t of tokens) {
    if (!t?.traits || existing.has(t.id)) continue;
    const display = `${nickname(t.id)} #${t.metaN ?? t.id}`;
    const p = { ...buildPersona(t.id, display, t.traits, 1), official: t.name };
    stmts.push({
      sql: `INSERT INTO chogs(id, name, meta_n, image, traits, persona, house, location, activity) VALUES(?,?,?,?,?,?,?,?,?)`,
      args: [t.id, display, t.metaN, t.image, JSON.stringify(t.traits), JSON.stringify(p), p.house, p.home, p.activity],
    });
  }
  await batch(stmts);
  console.log(`inserted ${stmts.length} chogs`);

  // Follow graph: homophily (same house) plus random bridges.
  const chogs = await all<{ id: number; house: string }>(`SELECT id, house FROM chogs WHERE id > 0`);
  const byHouse = new Map<string, number[]>();
  for (const c of chogs) byHouse.set(c.house, [...(byHouse.get(c.house) ?? []), Number(c.id)]);
  const f: any[] = [];
  for (const c of chogs) {
    if (existing.has(Number(c.id))) continue;
    const same = byHouse.get(c.house) ?? [];
    for (let k = 0; k < 8; k++) {
      const dst = same[hash(`f:${c.id}:${k}`) % same.length];
      if (dst !== Number(c.id)) f.push({ sql: `INSERT OR IGNORE INTO follows(src, dst) VALUES(?,?)`, args: [c.id, dst] });
    }
    for (let k = 0; k < 4; k++) {
      const dst = Number(chogs[hash(`b:${c.id}:${k}`) % chogs.length].id);
      if (dst !== Number(c.id)) f.push({ sql: `INSERT OR IGNORE INTO follows(src, dst) VALUES(?,?)`, args: [c.id, dst] });
    }
  }
  await batch(f);
  const counts = await all<any>(`SELECT house, COUNT(*) n FROM chogs WHERE id > 0 GROUP BY house`);
  console.log("houses:", counts.map((c) => `${HOUSES.find((h) => h.id === c.house)?.name}: ${c.n}`).join(", "));
  console.log(`follow edges added: ${f.length}`);
}

main().then(() => process.exit(0));
