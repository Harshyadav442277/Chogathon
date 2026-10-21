// Fast-forward a whole season on a COPY of the database to check that it converges on the Demon King's defeat.
// Usage: npx tsx scripts/season-sim.ts [ticks]   (SEASON_HOURS defaults to 2 here: 160 ticks of 45 s)
import { createClient } from "@libsql/client";
import { existsSync, rmSync } from "node:fs";

process.env.SEASON_HOURS ||= "2";
const TICKS = Number(process.argv[2] || 200);
const COPY = "data/season-sim.db";

async function main() {
  for (const f of [COPY, `${COPY}-wal`, `${COPY}-shm`]) if (existsSync(f)) rmSync(f);
  await createClient({ url: "file:hivemind.db" }).execute(`VACUUM INTO '${COPY}'`);
  process.env.TURSO_DATABASE_URL = `file:${COPY}`;
  const { startSeason } = await import("../src/sim2/season");
  const { simTick } = await import("../src/sim3/sim");
  const { all, getState, setState } = await import("../src/lib/db");
  await setState("sim_state", "");
  const { season } = await startSeason();
  const start = Date.now();
  const t0 = performance.now();
  for (let t = 1; t <= TICKS; t++) {
    const res = await simTick(t, start + t * 45_000);
    if (t % 10 === 0 || res.hero) {
      const st = JSON.parse((await getState("sim_state", "")) || "{}");
      const lv = await all<any>(`SELECT AVG(level) l, MAX(level) m, SUM(quest IS NOT NULL) q, SUM(state='rest') r FROM agents`);
      const gens = (st.generals ?? []).map((g: any) => (g.down ? "X" : `${Math.round((100 * g.hp) / g.max)}%`)).join(" ");
      console.log(`t${t} phase ${res.phase} | generals ${gens} | king ${st.king ? Math.round((100 * st.king.hp) / st.king.max) + "%" : "-"} | avg lvl ${Number(lv[0].l).toFixed(1)} max ${lv[0].m} | questing ${lv[0].q} resting ${lv[0].r} | +${res.lines} lines`);
    }
    if (res.hero) {
      const h = await all<any>(`SELECT c.name, cs.job, a.level FROM chogs c JOIN agents a ON a.chog_id = c.id JOIN chog_season cs ON cs.chog_id = c.id AND cs.season = ? WHERE c.id = ?`, [season, res.hero]);
      console.log(`HERO at tick ${t}: ${h[0]?.name} (${h[0]?.job}, level ${h[0]?.level})`);
      break;
    }
  }
  console.log(`${((performance.now() - t0) / 1000).toFixed(1)} s total`);
  const lines = await all<any>(`SELECT text FROM chronicle ORDER BY id DESC LIMIT 12`);
  for (const l of lines.reverse()) console.log("  ", l.text);
}
main();
