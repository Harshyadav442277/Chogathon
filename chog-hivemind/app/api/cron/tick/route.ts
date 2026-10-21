// Optional HTTP trigger for one tick (for a free external cron like cron-job.org).
import { err, json } from "@/lib/api";
import { migrate, one } from "@/lib/db";
import { tick, today } from "@/sim/engine";
import { writeEdition } from "@/sim/edition";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  const secret = process.env.CRON_SECRET;
  if (!secret || (auth !== `Bearer ${secret}` && key !== secret)) return err("unauthorized", 401);
  await migrate();
  const s = await tick({ agents: Number(process.env.HTTP_TICK_AGENTS || 20) });
  const ed = await one(`SELECT day FROM editions WHERE day = ?`, [today()]);
  if (!ed) await writeEdition();
  return json(s);
}
