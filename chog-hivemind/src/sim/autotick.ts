// Self-ticking: GitHub's scheduled workflows run late or not at all on quiet repos, so while anyone is watching,
// the site keeps the world moving itself. Called from the endpoints viewers poll: at most once every 30 s per
// server instance it checks when the season last ticked, and if that was more than SIM_TICK_SECONDS ago it runs
// one tick after the response has been sent. The tick lock (engine.ts) stops overlapping ticks from any source.
// AUTO_TICK=0 turns it off.
import { after } from "next/server";
import { getState } from "@/lib/db";
import { tick } from "./engine";

let lastCheck = 0;

export function maybeTick() {
  if (process.env.AUTO_TICK === "0" || !process.env.TURSO_DATABASE_URL?.startsWith("libsql:")) return;
  const now = Date.now();
  if (now - lastCheck < 30_000) return;
  lastCheck = now;
  after(async () => {
    const last = Number(await getState("sim_last_at", "0"));
    if (now - last < Number(process.env.SIM_TICK_SECONDS || 600) * 1000) return;
    await tick({ agents: Number(process.env.HTTP_TICK_AGENTS || 20) }).catch((e) => console.error("auto tick", e));
  });
}
