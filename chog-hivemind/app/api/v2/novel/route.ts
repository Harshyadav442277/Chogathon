import { cachedJson } from "@/lib/cache";
import { all, getState } from "@/lib/db";
import { NOVEL, NOVEL_SCHEMA } from "@/sim3/novel";
import { run } from "@/lib/db";

export const dynamic = "force-dynamic";

// The season novel written so far: GET /api/v2/novel?season=N (default: the current season).
export async function GET(req: Request) {
  for (const q of NOVEL_SCHEMA) await run(q);
  const current = Number(await getState("season", "0"));
  const season = Number(new URL(req.url).searchParams.get("season") ?? current) || current;
  return cachedJson(req, `novel-${season}`, async () => {
    const chapters = await all<any>(`SELECT chapter, ord, title, text, tick, at FROM novel WHERE season = ? ORDER BY tick, ord`, [season]);
    const seasons = await all<any>(`SELECT DISTINCT season FROM novel ORDER BY season DESC`);
    return {
      title: NOVEL.title, season, total: NOVEL.chapters.length, seasons: seasons.map((s) => Number(s.season)),
      chapters: (() => {
        let n = 0;  // story chapters are numbered in the order they happened; interludes and the epilogue are not
        const known = new Set(NOVEL.chapters.map((c) => c.id));  // chapters retired from data/novel.json are hidden
        return chapters.filter((c) => known.has(String(c.chapter))).map((c) => {
          const raw = String(c.title).replace(/^Chapter \d+ · /, "");  // chapters stored before titles lost their numbers
          const plain = /^(Interlude|Epilogue)/.test(raw);
          return { id: c.chapter, number: plain ? null : ++n, title: plain ? raw : `Chapter ${n} · ${raw}`, text: c.text, tick: Number(c.tick), at: Number(c.at) };
        });
      })(),
    };
  });
}
