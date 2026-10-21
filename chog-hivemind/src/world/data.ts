// Server-side helpers that place every Chog on the Monadia map.
import worldJson from "../../data/world.json";
import { all, getState } from "../lib/db";
import { hash } from "../sim/world";

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

/** Which POI a Chog is standing at right now. At "home" it lives in a town of its own nation. */
export function poiFor(id: number, house: string, location: string, homeLocation: string): number {
  if (location === homeLocation && location !== "cave") {
    const homes = homesByRegion.get(HOUSE_REGION[house] ?? "capital") ?? [0];
    return homes[hash(`home:${id}`) % homes.length];
  }
  return legacyIndex.get(location) ?? 0;
}

const SPREAD: Record<string, number> = { capital: 9, district: 5, town: 6, village: 4.5, tavern: 4, wild: 5, dungeon: 4, obelisk: 3, dock: 4, lighthouse: 3 };

export function jitter(id: number, poi: WorldPoi): [number, number] {
  const a = ((hash(`ja:${id}`) % 3600) / 3600) * Math.PI * 2;
  const r = 1.8 + ((hash(`jr:${id}`) % 1000) / 1000) * (SPREAD[poi.kind] ?? 4);
  return [+(poi.x + Math.cos(a) * r).toFixed(2), +(poi.z + Math.sin(a) * r).toFixed(2)];
}

const HOUSE_CODE: Record<string, number> = { laser: 0, teardrop: 1, glass: 2, moonbeam: 3 };

export async function positions() {
  const rows = await all<any>(`SELECT id, name, house, location, mood, persona FROM chogs WHERE id > 0 ORDER BY id`);
  const n = rows.length;
  const out = { tick: Number(await getState("tick", "0")), ids: new Array<number>(n), names: new Array<string>(n), x: new Array<number>(n), z: new Array<number>(n), house: new Array<number>(n), poi: new Array<number>(n), mood: new Array<string>(n) };
  rows.forEach((r, k) => {
    const id = Number(r.id);
    const home = (() => { try { return JSON.parse(r.persona).home as string; } catch { return "plaza"; } })();
    const pi = poiFor(id, r.house, r.location, home);
    const [x, z] = jitter(id, WORLD.pois[pi]);
    out.ids[k] = id; out.names[k] = r.name; out.x[k] = x; out.z[k] = z; out.house[k] = HOUSE_CODE[r.house] ?? 0; out.poi[k] = pi; out.mood[k] = r.mood;
  });
  const bubbles = await all<any>(
    `SELECT p.id, p.chog_id, p.kind, p.text FROM posts p WHERE p.chog_id > 0 AND p.kind IN ('post','reply') ORDER BY p.id DESC LIMIT 40`,
  );
  return { ...out, bubbles: bubbles.map((b) => ({ id: Number(b.id), chog: Number(b.chog_id), kind: b.kind, text: b.text })) };
}
