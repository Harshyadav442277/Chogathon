// Start (or restart) a season: re-roll every Chog's job and reset its progress.
//   npm run season            next season
//   npm run season -- 1       (re)start season 1
import { migrate, all } from "../src/lib/db";
import { startSeason } from "../src/sim2/season";

async function main() {
  await migrate();
  const n = process.argv.find((a) => /^\d+$/.test(a));
  const r = await startSeason(n ? Number(n) : undefined);
  console.log(`season ${r.season}: assigned ${r.assigned} Chogs`);
  const byJob = await all<any>(`SELECT job, COUNT(*) n FROM chog_season WHERE season = ? GROUP BY job ORDER BY n DESC`, [r.season]);
  console.log(byJob.map((j) => `${j.job}:${j.n}`).join("  "));
}

main().then(() => process.exit(0));
