import { cachedJson } from "@/lib/cache";
import { all, getState, one, run } from "@/lib/db";
import { GRAPH, NODE_BY_ID } from "@/story/chronicle";
import { NOVEL, NOVEL_SCHEMA } from "@/sim3/novel";

export const dynamic = "force-dynamic";

// The season novel written so far: GET /api/v2/novel?season=N (default: the current season).
// Also: arc (this season's premise), total (about how many beats the season will tell) and the list of seasons.
export async function GET(req: Request) {
  for (const q of NOVEL_SCHEMA) await run(q);
  const current = Number(await getState("season", "0"));
  const season = Number(new URL(req.url).searchParams.get("season") ?? current) || current;
  return cachedJson(req, `novel-${season}`, async () => {
    const chapters = (await all<any>(`SELECT chapter, ord, title, text, tick, at FROM novel WHERE season = ? ORDER BY tick, ord`, [season]))
      .filter((c) => NODE_BY_ID.has(String(c.chapter)));  // beats retired from the graph are hidden
    const seasons = await all<any>(`SELECT DISTINCT season FROM novel ORDER BY season DESC`);
    const arcId = String((await one<any>(`SELECT arc FROM story WHERE season = ?`, [season]))?.arc ?? "lantern");
    const arc = GRAPH.arcs.find((a) => a.id === arcId) ?? GRAPH.arcs[0];
    // Expected length: one beat per slot (or per unslotted node), weighted by its chance.
    const slots = new Map<string, number>();
    for (const n of GRAPH.nodes) {
      if (n.arc && !(Array.isArray(n.arc) ? n.arc.includes(arc.id) : n.arc === arc.id)) continue;
      const k = n.slot ?? `#${n.id}`;
      slots.set(k, Math.max(slots.get(k) ?? 0, n.chance ?? 1));
    }
    const total = Math.round([...slots.values()].reduce((s, c) => s + c, 0));
    let n = 0;  // story chapters are numbered in the order they happened; interludes and epilogues are not
    return {
      title: NOVEL.title, season, arc: { id: arc.id, title: arc.title, blurb: arc.blurb }, total, seasons: seasons.map((s) => Number(s.season)),
      chapters: chapters.map((c) => {
        const raw = String(c.title).replace(/^Chapter \d+ · /, "");
        const plain = /^(Interlude|Epilogue|Prologue)/.test(raw);
        return { id: c.chapter, number: plain ? null : ++n, title: plain ? raw : `Chapter ${n} · ${raw}`, text: c.text, tick: Number(c.tick), at: Number(c.at) };
      }),
    };
  });
}
