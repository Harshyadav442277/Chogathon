import { err, json } from "@/lib/api";
import { setSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({}));
  if (!process.env.JUDGE_CODE || code !== process.env.JUDGE_CODE) return err("Wrong judge code.", 401);
  await setSession({ address: "judge", judge: true });
  return json({ ok: true });
}
