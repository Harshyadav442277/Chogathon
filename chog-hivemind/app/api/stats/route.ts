import { currentQuestionAndEvent, leaders, poll, stats, trendingMemes } from "@/lib/queries";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const [s, l, m, p, qe] = await Promise.all([stats(), leaders(10), trendingMemes(6), poll(), currentQuestionAndEvent()]);
  return json({ stats: s, leaders: l, memes: m, poll: p, ...qe });
}
