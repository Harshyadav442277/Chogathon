// Server-side helpers that place every Chog on the Monadia map.
// At "home" a Chog stands outside the building of its job (its nation's smithy, guild hall, farm...).
// When the simulation sends it somewhere else (legacy location), it stands at that place instead.
import worldJson from "../../data/world.json";
import { all, getState } from "../lib/db";
import { hash } from "../sim/world";
import { JOB_BY_ID, JOBS } from "../sim2/season";

/** Job index in data/jobs.json order: the character renderer picks outfit, tool and work action by it. */
const JOB_INDEX = new Map(JOBS.map((j, i) => [j.id, i]));
import { height } from "./terrain";

export type WorldPoi = { id: string; name: string; kind: string; region: string; x: number; y: number; z: number; legacy?: string; city?: string };
export type WorldBuilding = { id: number; type: string; name: string; city: string; region: string; x: number; z: number; rot: number; s: number };
export type WorldData = {
  seed: number;
  regions: { id: string; name: string; house: string | null; x: number; z: number; y: number; accent: string; blurb: string }[];
  pois: WorldPoi[];
  buildings: WorldBuilding[];
};

export const WORLD = worldJson as unknown as WorldData;

const HOUSE_REGION: Record<string, string> = { laser: "emberforge", teardrop: "tidecry", glass: "prism", moonbeam: "dreamveil" };
const legacyIndex = new Map(WORLD.pois.map((p, i) => [p.legacy, i] as const).filter(([k]) => !!k) as [string, number][]);
const poiByName = new Map(WORLD.pois.map((p, i) => [p.name, i]));

// Job workplace -> building type in world.json (most names are identical).
const WORKPLACE_BUILDING: Record<string, string> = { guild: "guild_hall", castle: "keep" };
const buildingsBy = new Map<string, number[]>(); // "type:region" -> building ids
const buildingsByType = new Map<string, number[]>();
for (const b of WORLD.buildings ?? []) {
  const k = `${b.type}:${b.region}`;
  buildingsBy.set(k, [...(buildingsBy.get(k) ?? []), b.id]);
  buildingsByType.set(b.type, [...(buildingsByType.get(b.type) ?? []), b.id]);
}

/** The building a Chog works at, or -1. Some adventurers and administrators serve in the Hive Capital. */
export function workplaceBuilding(id: number, house: string, workplace?: string): number {
  if (!workplace) return -1;
  const type = WORKPLACE_BUILDING[workplace] ?? workplace;
  const region = HOUSE_REGION[house] ?? "capital";
  // About a quarter of every trade works in the Hive Capital (if it has that building), so its shops are lively too.
  const toCapital = hash(`cap:${id}`) % 100 < ((workplace === "guild" || workplace === "castle") ? 30 : 22);
  const pick = (list?: number[]) => (list && list.length ? list[hash(`work:${id}`) % list.length] : -1);
  if (toCapital) {
    const hq = pick(buildingsBy.get(`${workplace === "castle" ? "castle" : type}:capital`));
    if (hq >= 0) return hq;
  }
  return pick(buildingsBy.get(`${type}:${region}`)) >= 0 ? pick(buildingsBy.get(`${type}:${region}`)) : pick(buildingsByType.get(type));
}

/** Legacy: which POI a Chog is at when it is away from its workplace. */
export function poiFor(location: string): number {
  return legacyIndex.get(location) ?? 0;
}

const SPREAD: Record<string, number> = { capital: 16, district: 8, town: 7, village: 5, tavern: 5, wild: 6, dungeon: 5, obelisk: 3, dock: 5, lighthouse: 3 };

const spotCache = new Map<string, [number, number]>();

/** A dry spot near (cx, cz): tries a few angles/radii so nobody stands in a lake or river. Cached: a Chog's
 *  spot depends only on its id and the place, and the terrain height function is expensive. */
function dryNear(id: number, cx: number, cz: number, spread: number, minR = 2): [number, number] {
  const key = `${id}:${cx}:${cz}`;
  const hit = spotCache.get(key);
  if (hit) return hit;
  if (spotCache.size > 50000) spotCache.clear();
  const spot = findDry(id, cx, cz, spread, minR);
  spotCache.set(key, spot);
  return spot;
}

function findDry(id: number, cx: number, cz: number, spread: number, minR: number): [number, number] {
  for (let k = 0; k < 10; k++) {
    const a = ((hash(`ja:${id}:${k}`) % 3600) / 3600) * Math.PI * 2;
    const r = minR + Math.sqrt((hash(`jr:${id}:${k}`) % 1000) / 1000) * spread;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (height(x, z) > 1.0) return [+x.toFixed(2), +z.toFixed(2)];
  }
  return [cx, cz];
}

/** Standing spot in front of a building's door (buildings face +Z in local space, rotated by b.rot). */
function atBuilding(id: number, b: WorldBuilding): [number, number] {
  const front = 5.5 * b.s;
  const fx = b.x + Math.sin(b.rot) * front, fz = b.z + Math.cos(b.rot) * front;
  return dryNear(id, fx, fz, 3.5, 0.5);
}

export function jitter(id: number, poi: WorldPoi): [number, number] {
  return dryNear(id, poi.x, poi.z, SPREAD[poi.kind] ?? 4);
}

const HOUSE_CODE: Record<string, number> = { laser: 0, teardrop: 1, glass: 2, moonbeam: 3 };

export async function positions() {
  let rows: any[];
  try {
    rows = await all<any>(
      `SELECT c.id, c.name, c.house, c.location, c.mood, json_extract(c.persona, '$.home') AS home, cs.job FROM chogs c
       LEFT JOIN chog_season cs ON cs.chog_id = c.id AND cs.season = (SELECT CAST(value AS INTEGER) FROM state WHERE key = 'season')
       WHERE c.id > 0 ORDER BY c.id`,
    );
  } catch {
    rows = await all<any>(`SELECT id, name, house, location, mood, json_extract(persona, '$.home') AS home, NULL AS job FROM chogs WHERE id > 0 ORDER BY id`);
  }
  const n = rows.length;
  const out = {
    tick: Number(await getState("tick", "0")), season: Number(await getState("season", "0")),
    ids: new Array<number>(n), names: new Array<string>(n), job: new Array<string>(n), track: new Array<string>(n), role: new Array<string>(n), state: new Array<string>(n),
    x: new Array<number>(n), z: new Array<number>(n), jobi: new Array<number>(n), house: new Array<number>(n), poi: new Array<number>(n), building: new Array<number>(n), mood: new Array<string>(n),
  };
  rows.forEach((r, k) => {
    const id = Number(r.id);
    const home = (r.home as string) ?? "plaza";
    const job = r.job ? JOB_BY_ID[r.job] : undefined;
    const atWork = r.location === home && r.location !== "cave";
    const bi = atWork ? workplaceBuilding(id, r.house, job?.workplace) : -1;
    let pi: number, x: number, z: number;
    if (bi >= 0) {
      const b = WORLD.buildings[bi];
      [x, z] = atBuilding(id, b);
      pi = poiByName.get(b.city) ?? 0;
    } else {
      pi = poiFor(r.location);
      [x, z] = jitter(id, WORLD.pois[pi]);
    }
    out.ids[k] = id; out.names[k] = r.name; out.x[k] = x; out.z[k] = z; out.house[k] = HOUSE_CODE[r.house] ?? 0;
    out.poi[k] = pi; out.building[k] = bi; out.mood[k] = r.mood; out.job[k] = job?.name ?? "";
    out.track[k] = job?.track ?? "";
    out.role[k] = job?.role ?? "";
    out.jobi[k] = r.job ? (JOB_INDEX.get(r.job) ?? -1) : -1;
    // Activity contract for the character renderer: "work" or "fight" from the server.
    // The client shows "walk" by itself whenever a Chog's position changes between polls.
    out.state[k] = job?.track === "adventurer" && WORLD.pois[pi]?.kind === "dungeon" ? "fight" : "work";
  });
  const bubbles = await all<any>(
    `SELECT p.id, p.chog_id, p.kind, p.text FROM posts p WHERE p.chog_id > 0 AND p.kind IN ('post','reply') ORDER BY p.id DESC LIMIT 40`,
  );
  return { ...out, bubbles: bubbles.map((b) => ({ id: Number(b.id), chog: Number(b.chog_id), kind: b.kind, text: b.text })) };
}
