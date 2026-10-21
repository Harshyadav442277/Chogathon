// Server-side helpers that place every Chog on the Monadia map.
import worldJson from "../../data/world.json";
import { all, getState } from "../lib/db";
import { hash } from "../sim/world";
import { JOB_BY_ID } from "../sim2/season";

export type WorldPoi = { id: string; name: string; kind: string; region: string; x: number; y: number; z: number; legacy?: string };
export type WorldData = {
  seed: number;
  regions: { id: string; name: string; house: string | null; x: number; z: number; y: number; accent: string; blurb: string }[];
  pois: WorldPoi[];
  roads: [number, number][];
};

export const WORLD = worldJson as unknown as WorldData;

const HOUSE_REGION: Record<string, string> = { laser: "emberforge", teardrop: "tidecry", glass: "prism", moonbeam: "dreamveil" };
const HOMEABLE = new Set(["capital", "district", "town", "village", "tavern"]);
const legacyIndex = new Map(WORLD.pois.map((p, i) => [p.legacy, i] as const).filter(([k]) => !!k) as [string, number][]);
const homesByRegion = new Map<string, number[]>();
WORLD.pois.forEach((p, i) => {
  if (!HOMEABLE.has(p.kind)) return;
  homesByRegion.set(p.region, [...(homesByRegion.get(p.region) ?? []), i]);
});

// Which kinds of place each workplace lives in (until per-building plots exist).
const WORK_KINDS: Record<string, string[]> = {
  tavern: ["tavern"],
  farm: ["village", "town"], fishery: ["village", "town", "dock"], mine: ["town", "village", "wild"],
  lumberyard: ["village", "town"], stables: ["town", "village"], market: ["district", "town"],
  guild: ["capital"], castle: ["capital", "district"], barracks: ["capital", "district", "town"],
};
const DEFAULT_WORK_KINDS = ["district", "capital", "town"]; // shops, temples, libraries, academies...
const byRegionKind = new Map<string, number[]>();
WORLD.pois.forEach((p, i) => {
  const k = `${p.region}:${p.kind}`;
  byRegionKind.set(k, [...(byRegionKind.get(k) ?? []), i]);
});

/** Which POI a Chog is standing at right now. At "home" it is at its workplace in its own nation. */
export function poiFor(id: number, house: string, location: string, homeLocation: string, workplace?: string): number {
  if (location === homeLocation && location !== "cave") {
    const region = HOUSE_REGION[house] ?? "capital";
    if (workplace) {
      const kinds = WORK_KINDS[workplace] ?? DEFAULT_WORK_KINDS;
      // Adventurers report to the Hive Capital's guild; everyone else works in their own nation.
      const regions = workplace === "guild" ? ["capital", region] : [region, "capital"];
      for (const r of regions) {
        const candidates = kinds.flatMap((k) => byRegionKind.get(`${r}:${k}`) ?? []);
        if (candidates.length) return candidates[hash(`work:${id}`) % candidates.length];
      }
    }
    const homes = homesByRegion.get(region) ?? [0];
    return homes[hash(`home:${id}`) % homes.length];
  }
  return legacyIndex.get(location) ?? 0;
}

// Ring radius per place kind; capitals and districts hold big crowds (the guild alone has ~500 adventurers).
const SPREAD: Record<string, number> = { capital: 22, district: 9, town: 8, village: 5, tavern: 5, wild: 6, dungeon: 5, obelisk: 3, dock: 5, lighthouse: 3 };

export function jitter(id: number, poi: WorldPoi): [number, number] {
  const a = ((hash(`ja:${id}`) % 3600) / 3600) * Math.PI * 2;
  // sqrt for an even disc instead of a dense centre
  const r = 2 + Math.sqrt((hash(`jr:${id}`) % 1000) / 1000) * (SPREAD[poi.kind] ?? 4);
  return [+(poi.x + Math.cos(a) * r).toFixed(2), +(poi.z + Math.sin(a) * r).toFixed(2)];
}

const HOUSE_CODE: Record<string, number> = { laser: 0, teardrop: 1, glass: 2, moonbeam: 3 };

export async function positions() {
  let rows: any[];
  try {
    rows = await all<any>(
      `SELECT c.id, c.name, c.house, c.location, c.mood, c.persona, cs.job FROM chogs c
       LEFT JOIN chog_season cs ON cs.chog_id = c.id AND cs.season = (SELECT CAST(value AS INTEGER) FROM state WHERE key = 'season')
       WHERE c.id > 0 ORDER BY c.id`,
    );
  } catch {
    rows = await all<any>(`SELECT id, name, house, location, mood, persona, NULL AS job FROM chogs WHERE id > 0 ORDER BY id`);
  }
  const n = rows.length;
  const out = { tick: Number(await getState("tick", "0")), season: Number(await getState("season", "0")), ids: new Array<number>(n), names: new Array<string>(n), job: new Array<string>(n), role: new Array<string>(n), state: new Array<string>(n), x: new Array<number>(n), z: new Array<number>(n), house: new Array<number>(n), poi: new Array<number>(n), mood: new Array<string>(n) };
  rows.forEach((r, k) => {
    const id = Number(r.id);
    const home = (() => { try { return JSON.parse(r.persona).home as string; } catch { return "plaza"; } })();
    const job = r.job ? JOB_BY_ID[r.job] : undefined;
    const pi = poiFor(id, r.house, r.location, home, job?.workplace);
    const [x, z] = jitter(id, WORLD.pois[pi]);
    out.ids[k] = id; out.names[k] = r.name; out.x[k] = x; out.z[k] = z; out.house[k] = HOUSE_CODE[r.house] ?? 0; out.poi[k] = pi; out.mood[k] = r.mood; out.job[k] = job?.name ?? "";
    out.role[k] = job?.role ?? "";
    // Activity contract for the character renderer: "work" or "fight" from the server.
    // The client shows "walk" by itself whenever a Chog's position changes between polls.
    out.state[k] = job?.track === "adventurer" && WORLD.pois[pi]?.kind === "dungeon" ? "fight" : "work";
  });
  const bubbles = await all<any>(
    `SELECT p.id, p.chog_id, p.kind, p.text FROM posts p WHERE p.chog_id > 0 AND p.kind IN ('post','reply') ORDER BY p.id DESC LIMIT 40`,
  );
  return { ...out, bubbles: bubbles.map((b) => ({ id: Number(b.id), chog: Number(b.chog_id), kind: b.kind, text: b.text })) };
}
