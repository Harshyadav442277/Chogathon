// Run N ticks (default 1). Used by the GitHub Actions cron.
//   npm run tick -- 3            three ticks with the auto brain
//   npm run tick -- 5 --offline  force the offline brain
import { migrate, one } from "../src/lib/db";
import { tick, today } from "../src/sim/engine";
import { writeEdition } from "../src/sim/edition";

async function main() {
  const n = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 1);
  const brain = process.argv.includes("--offline") ? "offline" : process.argv.includes("--claude") ? "claude" : "auto";
  await migrate();
  for (let i = 0; i < n; i++) {
    const s = await tick({ brain });
    console.log(JSON.stringify(s));
    const ed = await one(`SELECT day FROM editions WHERE day = ?`, [today()]);
    if (!ed || s.tick % 36 === 0) {
      const e = await writeEdition();
      console.log("edition:", e.headline);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
