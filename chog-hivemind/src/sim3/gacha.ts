// Star Pulls (gacha) for Constellations, the NFT holders. Each season a player gets GACHA_PULLS pulls (default 5);
// every pull reveals one card, a skill or a quest, weighted by rarity. Every card pulled can be bestowed once,
// on a Chog the player holds (GACHA_OWN_ONLY=0: any Chog). Seasons last a day, so this refreshes daily.
// A card is seeded by wallet + season + pull number: the same pull always reveals the same card.
import { allOwners } from "../lib/chain";
import { mulberry32 } from "../world/terrain";
import { hash } from "../sim/world";
import { QUESTS, SKILLS, type Quest, type Skill } from "./sim";

export const GACHA = {
  pulls: process.env.GACHA_PULLS ? Number(process.env.GACHA_PULLS) : 5,
  ownOnly: process.env.GACHA_OWN_ONLY !== "0",
};

export const GACHA_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS season_pulls (
    author TEXT NOT NULL, season INTEGER NOT NULL, cards TEXT NOT NULL DEFAULT '[]', used TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL, PRIMARY KEY (author, season)
  )`,
];

export type Card = { kind: "skill" | "quest"; id: string };

/** Rarity by tier 1..5 (common .. legendary). Index = tier - 1. */
const RARITY = [40, 28, 18, 10, 4];
const QUEST_POOL = QUESTS.filter((q) => !q.boss || q.boss === "seal");

function weighted<T>(items: T[], weight: (t: T) => number, r: () => number): T {
  let t = r() * items.reduce((s, x) => s + weight(x), 0);
  for (const x of items) if ((t -= weight(x)) <= 0) return x;
  return items[items.length - 1];
}

/** The card revealed by pull number `n` (0-based) for this player and season. Avoids repeating earlier cards. */
export function drawCard(author: string, season: number, n: number, already: Card[]): Card {
  const r = mulberry32(hash(`card:${author}:${season}:${n}`));
  for (let attempt = 0; attempt < 8; attempt++) {
    const card: Card = r() < 0.55
      ? { kind: "skill", id: weighted(SKILLS, (s: Skill) => RARITY[s.tier - 1] ?? 1, r).id }
      : { kind: "quest", id: weighted(QUEST_POOL, (q: Quest) => RARITY[Math.min(5, q.tier) - 1] ?? 1, r).id };
    if (!already.some((c) => c.kind === card.kind && c.id === card.id)) return card;
  }
  return { kind: "skill", id: SKILLS[n % SKILLS.length].id };
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
