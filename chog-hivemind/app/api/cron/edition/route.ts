// Daily Hive Times (Vercel Hobby cron: once a day).
import { err, json } from "@/lib/api";
import { writeEdition } from "@/sim/edition";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return err("unauthorized", 401);
  const e = await writeEdition();
  return json({ headline: e.headline });
}
