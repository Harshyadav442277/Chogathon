import { cachedJson } from "@/lib/cache";
import { all, getState } from "@/lib/db";
import { ensureSimSchema, seasonMs, type SeasonState } from "@/sim3/sim";

export const dynamic = "force-dynamic";

const PHASES = ["", "The Summoning", "The Dungeons Open", "March on the Castle", "The Hero Emerges"];

// Season overview for the HUD: phase, seals, boss HP, hero candidates, what everyone is doing, latest chronicle.
export async function GET(req: Request) {
  await ensureSimSchema();
  return cachedJson(req, "season", async () => {
    const raw = await getState("sim_state", "");
    const st = raw ? (JSON.parse(raw) as SeasonState) : null;
    const season = Number(await getState("season", "0"));
    const names = async (ids: number[]) =>
      ids.length ? new Map((await all<any>(`SELECT id, name FROM chogs WHERE id IN (${ids.map(() => "?").join(",")})`, ids)).map((r) => [Number(r.id), r.name])) : new Map();
    const bossIds = st ? [st.king.chog, ...st.generals.map((g) => g.chog)] : [];
    const nm = await names(bossIds);
    const candidates = await all<any>(
      `SELECT a.chog_id id, c.name, cs.job, a.level, a.story FROM agents a JOIN chogs c ON c.id = a.chog_id
       JOIN chog_season cs ON cs.chog_id = a.chog_id AND cs.season = a.season
       WHERE a.season = ? AND cs.track != 'demon' ORDER BY a.story DESC, a.level DESC LIMIT 8`, [season]);
    const counts = await all<any>(`SELECT state, COUNT(*) n FROM agents WHERE season = ? GROUP BY state`, [season]);
    const chronicle = await all<any>(`SELECT tick, kind, chog, text FROM chronicle WHERE season = ? ORDER BY id DESC LIMIT 40`, [season]);
    const progress = st ? Math.min(1, (Date.now() - st.started) / seasonMs()) : 0;
    return {
      season, phase: st?.phase ?? 0, phaseName: PHASES[st?.phase ?? 0] ?? "", progress, seasonHours: seasonMs() / 3600_000,
      startedAt: st?.started ?? null, seals: st?.seals ?? 0, lastStand: st?.lastStand ?? false,
      king: st ? { id: st.king.chog, name: nm.get(st.king.chog) ?? "", hp: st.king.hp, max: st.king.max, down: st.king.down } : null,
      generals: st ? st.generals.map((g) => ({ id: g.chog, name: nm.get(g.chog) ?? "", region: g.region, hp: g.hp, max: g.max, down: g.down })) : [],
      hero: st?.hero ? { id: st.hero, name: st.heroName } : null,
      raid: st?.raid ? { town: st.raid.town, raiders: st.raid.raiders.length } : null,
      candidates: candidates.map((c) => ({ id: Number(c.id), name: c.name, job: c.job, level: Number(c.level), story: Number(c.story) })),
      states: Object.fromEntries(counts.map((c) => [c.state, Number(c.n)])),
      chronicle: chronicle.map((c) => ({ tick: Number(c.tick), kind: c.kind, chog: c.chog == null ? null : Number(c.chog), text: c.text })),
    };
  }, { maxAgeMs: 15_000 });
}
