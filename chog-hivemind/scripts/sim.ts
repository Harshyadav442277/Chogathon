// Run the world continuously on a laptop (zero-cost fallback for the cron worker).
//   npm run sim -- --every 120     one tick every 120 seconds
import { migrate, one } from "../src/lib/db";
import { tick, today } from "../src/sim/engine";
import { writeEdition } from "../src/sim/edition";

const arg = (name: string, d: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : d;
};

async function main() {
  const every = Number(arg("--every", "120")) * 1000;
  const brain = process.argv.includes("--offline") ? "offline" : "auto";
  await migrate();
  for (;;) {
    const started = Date.now();
    try {
      const s = await tick({ brain });
      console.log(new Date().toISOString(), JSON.stringify(s));
      const ed = await one(`SELECT day FROM editions WHERE day = ?`, [today()]);
      if (!ed || s.tick % 36 === 0) console.log("edition:", (await writeEdition()).headline);
    } catch (e) {
      console.error("tick failed:", e);
    }
    await new Promise((r) => setTimeout(r, Math.max(1000, every - (Date.now() - started))));
  }
}

main();
