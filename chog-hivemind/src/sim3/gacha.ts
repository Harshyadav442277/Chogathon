// Daily gacha for Constellations (NFT holders): each UTC day a player pulls a hand of skills and quests, then
// bestows a few of them. Defaults: pull 5 + 5, bestow 2 skills + 2 quests to Chogs you own. Env overrides:
// GACHA_PULL_SKILLS, GACHA_PULL_QUESTS, GACHA_GIVE_SKILLS, GACHA_GIVE_QUESTS, GACHA_OWN_ONLY=0 (any Chog).
// The pull is seeded by wallet + day + season: asking again returns the same hand (no re-rolls).
import { allOwners } from "../lib/chain";
import { mulberry32 } from "../world/terrain";
import { hash } from "../sim/world";
import { QUESTS, SKILLS, type Quest, type Skill } from "./sim";

const envInt = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d);
export const GACHA = {
  pullSkills: envInt("GACHA_PULL_SKILLS", 5),
  pullQuests: envInt("GACHA_PULL_QUESTS", 5),
  giveSkills: envInt("GACHA_GIVE_SKILLS", 2),
  giveQuests: envInt("GACHA_GIVE_QUESTS", 2),
  ownOnly: process.env.GACHA_OWN_ONLY !== "0",
};

export const GACHA_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS pulls (
    author TEXT NOT NULL, day TEXT NOT NULL, season INTEGER NOT NULL, skills TEXT NOT NULL, quests TEXT NOT NULL,
    used TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL, PRIMARY KEY (author, day)
  )`,
];

/** Rarity by tier 1..5 (F/E-rank common, S-rank rare). Index = tier - 1. */
const RARITY = [40, 28, 18, 10, 4];
const QUEST_POOL = QUESTS.filter((q) => !q.boss || q.boss === "seal");

function draw<T>(items: T[], weight: (t: T) => number, n: number, r: () => number): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length) {
    let t = r() * pool.reduce((s, x) => s + weight(x), 0);
    let k = 0;
    for (; k < pool.length - 1; k++) if ((t -= weight(pool[k])) <= 0) break;
    out.push(pool.splice(k, 1)[0]);
  }
  return out;
}

/** Today's hand for a player: deterministic, weighted by rarity, no duplicates. */
export function rollPull(author: string, day: string, season: number): { skills: string[]; quests: string[] } {
  const r = mulberry32(hash(`pull:${author}:${day}:${season}`));
  return {
    skills: draw(SKILLS, (s: Skill) => RARITY[s.tier - 1] ?? 1, GACHA.pullSkills, r).map((s) => s.id),
    quests: draw(QUEST_POOL, (q: Quest) => RARITY[Math.min(5, q.tier) - 1] ?? 1, GACHA.pullQuests, r).map((q) => q.id),
  };
}

let ownersCache: { at: number; map: Map<number, string> } | null = null;

/** Chog ids held by `address` (live ownerOf snapshot via Multicall, cached 10 minutes). */
export async function ownedChogs(address: string): Promise<number[]> {
  if (!ownersCache || Date.now() - ownersCache.at > 600_000) {
    try {
      ownersCache = { at: Date.now(), map: await allOwners() };
    } catch {
      if (!ownersCache) return [];
    }
  }
  const a = address.toLowerCase();
  return [...ownersCache.map.entries()].filter(([, o]) => o === a).map(([id]) => id);
}
